-- Remove caller-controlled user identifiers from referral application and
-- bind writes strictly to the authenticated profile.

DROP FUNCTION IF EXISTS public.apply_referral_code_secure(UUID, TEXT);

CREATE OR REPLACE FUNCTION public.apply_referral_code_secure(
  p_referral_code TEXT
)
RETURNS TABLE(success BOOLEAN, message TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_code_record RECORD;
  v_referrer_id UUID;
  v_already_referred BOOLEAN;
  v_user_id UUID := auth.uid();
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required'
      USING ERRCODE = '42501';
  END IF;

  SELECT rc.id, rc.code, rc.owner_type, rc.owner_user_id, rc.is_active
  INTO v_code_record
  FROM public.referral_codes rc
  WHERE UPPER(rc.code) = UPPER(p_referral_code)
    AND rc.is_active = true
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN QUERY SELECT false AS success, 'Invalid referral code'::TEXT AS message;
    RETURN;
  END IF;

  IF v_code_record.owner_type = 'user' AND v_code_record.owner_user_id = v_user_id THEN
    RETURN QUERY SELECT false AS success, 'Cannot use your own referral code'::TEXT AS message;
    RETURN;
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE id = v_user_id
      AND referred_by_code IS NOT NULL
  ) INTO v_already_referred;

  IF v_already_referred THEN
    RETURN QUERY SELECT false AS success, 'You have already used a referral code'::TEXT AS message;
    RETURN;
  END IF;

  v_referrer_id := v_code_record.owner_user_id;

  UPDATE public.profiles
  SET
    referred_by_code = UPPER(p_referral_code),
    referred_by = v_referrer_id
  WHERE id = v_user_id;

  IF v_code_record.owner_type = 'user' AND v_referrer_id IS NOT NULL THEN
    UPDATE public.profiles
    SET referral_count = COALESCE(referral_count, 0) + 1
    WHERE id = v_referrer_id;
  END IF;

  IF v_code_record.owner_type = 'influencer' THEN
    UPDATE public.referral_codes
    SET total_signups = COALESCE(total_signups, 0) + 1
    WHERE id = v_code_record.id;
  END IF;

  RETURN QUERY SELECT true AS success, 'Referral code applied successfully'::TEXT AS message;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.apply_referral_code_secure(TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.apply_referral_code_secure(TEXT) TO authenticated;
