-- Phase 1 security hardening for premium, promo, storage, and AI asset authz.

-- ---------------------------------------------------------------------------
-- Apple transaction binding: lock each original App Store transaction to one
-- app account so receipts/restores cannot be rebound to a different user.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.apple_transaction_bindings (
  original_transaction_id TEXT PRIMARY KEY,
  bound_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  app_account_token UUID,
  latest_transaction_id TEXT NOT NULL,
  product_id TEXT,
  environment TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  first_bound_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_verified_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_apple_transaction_bindings_user_id
  ON public.apple_transaction_bindings(bound_user_id);

ALTER TABLE public.apple_transaction_bindings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role manages apple transaction bindings" ON public.apple_transaction_bindings;
CREATE POLICY "Service role manages apple transaction bindings"
  ON public.apple_transaction_bindings
  FOR ALL
  USING (is_service_role())
  WITH CHECK (is_service_role());

CREATE UNIQUE INDEX IF NOT EXISTS idx_payment_history_unique_intent_id
  ON public.payment_history (stripe_payment_intent_id)
  WHERE stripe_payment_intent_id IS NOT NULL;

-- ---------------------------------------------------------------------------
-- Journey path cache must be per-user because the prompt includes user-specific
-- companion context.
-- ---------------------------------------------------------------------------
ALTER TABLE public.epic_journey_paths
  DROP CONSTRAINT IF EXISTS epic_journey_paths_epic_id_milestone_index_key;

ALTER TABLE public.epic_journey_paths
  ADD CONSTRAINT epic_journey_paths_epic_id_user_id_milestone_index_key
  UNIQUE (epic_id, user_id, milestone_index);

CREATE INDEX IF NOT EXISTS idx_epic_journey_paths_user_epic_milestone
  ON public.epic_journey_paths(user_id, epic_id, milestone_index DESC);

-- ---------------------------------------------------------------------------
-- Promo codes: disable repo-seeded code, move redemption behind edge-layer
-- throttling, and log attempts for abuse detection.
-- ---------------------------------------------------------------------------
UPDATE public.promo_codes
SET
  is_active = false,
  updated_at = NOW(),
  metadata = jsonb_set(
    COALESCE(metadata, '{}'::jsonb),
    '{disabled_reason}',
    '"repo_seed_disabled_2026_03_28"'::jsonb,
    true
  )
WHERE code = 'BIGFELLA2026'
   OR COALESCE(metadata->>'campaign', '') = 'bigfella2026';

CREATE TABLE IF NOT EXISTS public.promo_code_redemption_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  ip_address TEXT,
  promo_code TEXT NOT NULL,
  succeeded BOOLEAN NOT NULL DEFAULT false,
  outcome TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_promo_code_redemption_attempts_user_time
  ON public.promo_code_redemption_attempts(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_promo_code_redemption_attempts_ip_time
  ON public.promo_code_redemption_attempts(ip_address, created_at DESC);

ALTER TABLE public.promo_code_redemption_attempts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role manages promo redemption attempts" ON public.promo_code_redemption_attempts;
CREATE POLICY "Service role manages promo redemption attempts"
  ON public.promo_code_redemption_attempts
  FOR ALL
  USING (is_service_role())
  WITH CHECK (is_service_role());

CREATE OR REPLACE FUNCTION public.redeem_promo_code_secure(
  p_user_id UUID,
  p_promo_code TEXT
)
RETURNS TABLE(success BOOLEAN, status TEXT, message TEXT, access_expires_at TIMESTAMPTZ)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_now TIMESTAMPTZ := NOW();
  v_code TEXT := UPPER(TRIM(COALESCE(p_promo_code, '')));
  v_promo RECORD;
  v_existing_redemption RECORD;
  v_granted_until TIMESTAMPTZ;
  v_active_subscription RECORD;
BEGIN
  IF auth.role() <> 'service_role' AND (auth.uid() IS NULL OR auth.uid() <> p_user_id) THEN
    RETURN QUERY SELECT false, 'unauthorized'::TEXT, 'Unauthorized request'::TEXT, NULL::TIMESTAMPTZ;
    RETURN;
  END IF;

  IF v_code = '' THEN
    RETURN QUERY SELECT false, 'invalid'::TEXT, 'Enter a valid promo code'::TEXT, NULL::TIMESTAMPTZ;
    RETURN;
  END IF;

  SELECT id, granted_until
  INTO v_existing_redemption
  FROM public.promo_code_redemptions
  WHERE user_id = p_user_id
  LIMIT 1;

  IF FOUND THEN
    RETURN QUERY SELECT
      false,
      'used'::TEXT,
      'A promo code has already been redeemed for this account'::TEXT,
      v_existing_redemption.granted_until;
    RETURN;
  END IF;

  SELECT id
  INTO v_active_subscription
  FROM public.subscriptions
  WHERE user_id = p_user_id
    AND status IN ('active', 'trialing')
    AND current_period_end > v_now
    AND COALESCE(source, 'receipt') <> 'promo_code'
  LIMIT 1;

  IF FOUND THEN
    RETURN QUERY SELECT
      false,
      'already_active'::TEXT,
      'Your account already has an active subscription'::TEXT,
      NULL::TIMESTAMPTZ;
    RETURN;
  END IF;

  SELECT *
  INTO v_promo
  FROM public.promo_codes
  WHERE code = v_code
  FOR UPDATE;

  IF NOT FOUND OR v_promo.is_active IS NOT TRUE THEN
    RETURN QUERY SELECT false, 'invalid'::TEXT, 'Invalid promo code'::TEXT, NULL::TIMESTAMPTZ;
    RETURN;
  END IF;

  IF v_promo.expires_at IS NOT NULL AND v_promo.expires_at < v_now THEN
    RETURN QUERY SELECT false, 'expired'::TEXT, 'This promo code has expired'::TEXT, NULL::TIMESTAMPTZ;
    RETURN;
  END IF;

  IF v_promo.max_redemptions IS NOT NULL AND v_promo.redeemed_count >= v_promo.max_redemptions THEN
    RETURN QUERY SELECT false, 'used'::TEXT, 'This promo code has reached its redemption limit'::TEXT, NULL::TIMESTAMPTZ;
    RETURN;
  END IF;

  v_granted_until := v_now + make_interval(days => GREATEST(COALESCE(v_promo.grant_days, 30), 1));

  INSERT INTO public.promo_code_redemptions (
    promo_code_id,
    user_id,
    redeemed_code,
    redeemed_at,
    granted_until
  ) VALUES (
    v_promo.id,
    p_user_id,
    v_code,
    v_now,
    v_granted_until
  );

  UPDATE public.promo_codes
  SET
    redeemed_count = redeemed_count + 1,
    updated_at = v_now
  WHERE id = v_promo.id;

  UPDATE public.profiles
  SET
    is_premium = true,
    subscription_status = 'active',
    subscription_started_at = COALESCE(subscription_started_at, v_now),
    subscription_expires_at = GREATEST(COALESCE(subscription_expires_at, v_now), v_granted_until),
    updated_at = v_now
  WHERE id = p_user_id;

  RETURN QUERY SELECT true, 'success'::TEXT, 'Promo code applied successfully'::TEXT, v_granted_until;
EXCEPTION
  WHEN unique_violation THEN
    RETURN QUERY SELECT false, 'used'::TEXT, 'A promo code has already been redeemed for this account'::TEXT, NULL::TIMESTAMPTZ;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.redeem_promo_code_secure(UUID, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.redeem_promo_code_secure(UUID, TEXT) TO service_role;

-- ---------------------------------------------------------------------------
-- Public storage buckets must not be user-writable without a path ownership
-- constraint. Journey paths and mentor audio are service-generated assets.
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Authenticated users can upload mentor audio" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload journey path images" ON storage.objects;
DROP POLICY IF EXISTS "Service role can manage journey path images" ON storage.objects;
DROP POLICY IF EXISTS "Service role can manage mentor audio" ON storage.objects;

CREATE POLICY "Service role can manage journey path images"
  ON storage.objects
  FOR ALL
  USING (bucket_id = 'journey-paths' AND auth.role() = 'service_role')
  WITH CHECK (bucket_id = 'journey-paths' AND auth.role() = 'service_role');

CREATE POLICY "Service role can manage mentor audio"
  ON storage.objects
  FOR ALL
  USING (bucket_id = 'mentor-audio' AND auth.role() = 'service_role')
  WITH CHECK (bucket_id = 'mentor-audio' AND auth.role() = 'service_role');
