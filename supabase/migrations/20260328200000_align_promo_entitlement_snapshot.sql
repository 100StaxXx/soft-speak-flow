-- Align promo redemption with the service-managed entitlement snapshot.
-- Authenticated users may redeem for themselves, and trusted service flows may
-- redeem on behalf of a user, but the resulting premium state lives only in
-- account_entitlements.

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

  SELECT r.id, r.granted_until
  INTO v_existing_redemption
  FROM public.promo_code_redemptions AS r
  WHERE r.user_id = p_user_id
  LIMIT 1;

  IF FOUND THEN
    RETURN QUERY SELECT
      false,
      'used'::TEXT,
      'A promo code has already been redeemed for this account'::TEXT,
      v_existing_redemption.granted_until;
    RETURN;
  END IF;

  SELECT s.id
  INTO v_active_subscription
  FROM public.subscriptions AS s
  WHERE s.user_id = p_user_id
    AND s.status IN ('active', 'trialing')
    AND s.current_period_end > v_now
    AND COALESCE(s.source, 'receipt') <> 'promo_code'
  LIMIT 1;

  IF FOUND THEN
    RETURN QUERY SELECT
      false,
      'already_active'::TEXT,
      'Your account already has an active subscription'::TEXT,
      NULL::TIMESTAMPTZ;
    RETURN;
  END IF;

  SELECT pc.*
  INTO v_promo
  FROM public.promo_codes AS pc
  WHERE pc.code = v_code
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

  INSERT INTO public.account_entitlements (
    user_id,
    source,
    status,
    plan,
    is_active,
    started_at,
    ends_at,
    metadata
  )
  VALUES (
    p_user_id,
    'promo_code',
    'active',
    'promo',
    true,
    v_now,
    v_granted_until,
    jsonb_build_object(
      'redeemed_code', v_code,
      'updated_by', CASE
        WHEN auth.role() = 'service_role' THEN 'service_role'
        ELSE 'self_service'
      END
    )
  )
  ON CONFLICT (user_id) DO UPDATE
  SET
    source = EXCLUDED.source,
    status = EXCLUDED.status,
    plan = EXCLUDED.plan,
    is_active = EXCLUDED.is_active,
    started_at = COALESCE(public.account_entitlements.started_at, EXCLUDED.started_at),
    ends_at = GREATEST(COALESCE(public.account_entitlements.ends_at, EXCLUDED.ends_at), EXCLUDED.ends_at),
    metadata = COALESCE(public.account_entitlements.metadata, '{}'::jsonb) || EXCLUDED.metadata,
    updated_at = NOW();

  RETURN QUERY SELECT true, 'success'::TEXT, 'Promo code applied successfully'::TEXT, v_granted_until;
EXCEPTION
  WHEN unique_violation THEN
    RETURN QUERY SELECT false, 'used'::TEXT, 'A promo code has already been redeemed for this account'::TEXT, NULL::TIMESTAMPTZ;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.redeem_promo_code_secure(UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.redeem_promo_code_secure(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.redeem_promo_code_secure(UUID, TEXT) TO service_role;
