-- Promo code access system for non-subscription entitlement unlocks

CREATE TABLE IF NOT EXISTS public.promo_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  label TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  grant_days INTEGER NOT NULL DEFAULT 30 CHECK (grant_days > 0),
  max_redemptions INTEGER CHECK (max_redemptions IS NULL OR max_redemptions > 0),
  redeemed_count INTEGER NOT NULL DEFAULT 0 CHECK (redeemed_count >= 0),
  expires_at TIMESTAMPTZ,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT promo_codes_uppercase_code CHECK (code = UPPER(code))
);

CREATE TABLE IF NOT EXISTS public.promo_code_redemptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  promo_code_id UUID NOT NULL REFERENCES public.promo_codes(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  redeemed_code TEXT NOT NULL,
  redeemed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  granted_until TIMESTAMPTZ NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT promo_code_redemptions_uppercase_code CHECK (redeemed_code = UPPER(redeemed_code)),
  CONSTRAINT promo_code_redemptions_one_per_user UNIQUE (user_id),
  CONSTRAINT promo_code_redemptions_unique_code_user UNIQUE (promo_code_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_promo_codes_code ON public.promo_codes(code);
CREATE INDEX IF NOT EXISTS idx_promo_codes_active ON public.promo_codes(is_active, expires_at);
CREATE INDEX IF NOT EXISTS idx_promo_code_redemptions_user ON public.promo_code_redemptions(user_id);
CREATE INDEX IF NOT EXISTS idx_promo_code_redemptions_until ON public.promo_code_redemptions(granted_until);

ALTER TABLE public.promo_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.promo_code_redemptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role can manage promo codes" ON public.promo_codes;
CREATE POLICY "Service role can manage promo codes"
  ON public.promo_codes
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

DROP POLICY IF EXISTS "Service role can manage promo redemptions" ON public.promo_code_redemptions;
CREATE POLICY "Service role can manage promo redemptions"
  ON public.promo_code_redemptions
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

DROP POLICY IF EXISTS "Users can view own promo redemptions" ON public.promo_code_redemptions;
CREATE POLICY "Users can view own promo redemptions"
  ON public.promo_code_redemptions
  FOR SELECT
  USING (auth.uid() = user_id);

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
  IF auth.uid() IS NULL OR auth.uid() <> p_user_id THEN
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

  -- Keep existing active paid subscriptions unchanged.
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

GRANT EXECUTE ON FUNCTION public.redeem_promo_code_secure(UUID, TEXT) TO authenticated;

-- Seed initial promo code: BigFella2026 => one free year (365 days)
INSERT INTO public.promo_codes (
  code,
  label,
  is_active,
  grant_days,
  max_redemptions,
  metadata
)
VALUES (
  'BIGFELLA2026',
  'Big Fella 2026',
  true,
  365,
  NULL,
  jsonb_build_object('campaign', 'bigfella2026', 'notes', 'One free year access')
)
ON CONFLICT (code) DO UPDATE
SET
  label = EXCLUDED.label,
  is_active = EXCLUDED.is_active,
  grant_days = EXCLUDED.grant_days,
  max_redemptions = EXCLUDED.max_redemptions,
  metadata = EXCLUDED.metadata,
  updated_at = NOW();
