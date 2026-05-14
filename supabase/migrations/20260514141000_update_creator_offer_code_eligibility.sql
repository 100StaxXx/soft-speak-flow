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
      AND LOWER(COALESCE(rc.apple_offer_campaign_identifier, '')) = 'referrals'
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
