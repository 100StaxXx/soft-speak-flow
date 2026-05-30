UPDATE public.referral_codes
SET
  affiliate_provider = 'supabase',
  payout_method = CASE
    WHEN payout_method = 'winwinkit' THEN 'paypal'
    ELSE payout_method
  END,
  provider_status = COALESCE(provider_status, 'active'),
  provider_synced_at = COALESCE(provider_synced_at, now())
WHERE affiliate_provider = 'winwinkit'
   OR payout_method = 'winwinkit';

UPDATE public.affiliate_conversions
SET provider = 'supabase'
WHERE provider = 'winwinkit';

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'referral_codes_affiliate_provider_check'
  ) THEN
    ALTER TABLE public.referral_codes
      DROP CONSTRAINT referral_codes_affiliate_provider_check;
  END IF;

  ALTER TABLE public.referral_codes
    ADD CONSTRAINT referral_codes_affiliate_provider_check
    CHECK (affiliate_provider IS NULL OR affiliate_provider IN ('tolt', 'supabase'));
END;
$$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'affiliate_conversions_provider_check'
  ) THEN
    ALTER TABLE public.affiliate_conversions
      DROP CONSTRAINT affiliate_conversions_provider_check;
  END IF;

  ALTER TABLE public.affiliate_conversions
    ADD CONSTRAINT affiliate_conversions_provider_check
    CHECK (provider IN ('tolt', 'supabase'));
END;
$$;

CREATE OR REPLACE FUNCTION public.get_applied_referral_code_state(
  p_user_id UUID
)
RETURNS TABLE(
  code TEXT,
  owner_type TEXT,
  affiliate_provider TEXT,
  is_active BOOLEAN,
  apple_offer_code_status TEXT,
  apple_offer_campaign_identifier TEXT,
  apple_offer_code_expires_at DATE,
  is_apple_offer_eligible BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL OR auth.uid() <> p_user_id THEN
    RAISE EXCEPTION 'Cannot fetch referral code state for another user'
      USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT
    rc.code,
    rc.owner_type,
    rc.affiliate_provider,
    COALESCE(rc.is_active, false) AS is_active,
    rc.apple_offer_code_status,
    rc.apple_offer_campaign_identifier,
    rc.apple_offer_code_expires_at,
    (
      COALESCE(rc.is_active, false)
      AND rc.owner_type = 'influencer'
      AND rc.apple_offer_code_status = 'active'
      AND (
        rc.apple_offer_code_expires_at IS NULL
        OR rc.apple_offer_code_expires_at >= CURRENT_DATE
      )
    ) AS is_apple_offer_eligible
  FROM public.profiles p
  LEFT JOIN public.referral_codes rc
    ON UPPER(rc.code) = UPPER(COALESCE(p.referred_by_code, ''))
  WHERE p.id = p_user_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_applied_referral_code_state(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_applied_referral_code_state(UUID) TO authenticated;
