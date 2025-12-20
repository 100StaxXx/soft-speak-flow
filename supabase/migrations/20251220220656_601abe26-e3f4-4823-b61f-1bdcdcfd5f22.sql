-- SECURITY FIX: Create secure referral code application RPC
-- This function handles the complete referral process server-side
-- to avoid exposing owner_user_id to the client

CREATE OR REPLACE FUNCTION public.apply_referral_code_secure(
  p_user_id UUID,
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
BEGIN
  -- Validate the referral code
  SELECT rc.id, rc.code, rc.owner_type, rc.owner_user_id, rc.is_active
  INTO v_code_record
  FROM referral_codes rc
  WHERE UPPER(rc.code) = UPPER(p_referral_code)
    AND rc.is_active = true
  LIMIT 1;
  
  IF NOT FOUND THEN
    RETURN QUERY SELECT false AS success, 'Invalid referral code'::TEXT AS message;
    RETURN;
  END IF;
  
  -- Check if user is trying to use their own code
  IF v_code_record.owner_type = 'user' AND v_code_record.owner_user_id = p_user_id THEN
    RETURN QUERY SELECT false AS success, 'Cannot use your own referral code'::TEXT AS message;
    RETURN;
  END IF;
  
  -- Check if user has already used a referral code
  SELECT EXISTS(
    SELECT 1 FROM profiles 
    WHERE id = p_user_id 
    AND referred_by_code IS NOT NULL
  ) INTO v_already_referred;
  
  IF v_already_referred THEN
    RETURN QUERY SELECT false AS success, 'You have already used a referral code'::TEXT AS message;
    RETURN;
  END IF;
  
  -- Get the referrer ID for user-type codes
  v_referrer_id := v_code_record.owner_user_id;
  
  -- Update the user's profile with the referral code
  UPDATE profiles
  SET 
    referred_by_code = UPPER(p_referral_code),
    referred_by = v_referrer_id
  WHERE id = p_user_id;
  
  -- Increment the referral count for user-type codes
  IF v_code_record.owner_type = 'user' AND v_referrer_id IS NOT NULL THEN
    UPDATE profiles
    SET referral_count = COALESCE(referral_count, 0) + 1
    WHERE id = v_referrer_id;
  END IF;
  
  -- For influencer codes, increment the signups counter
  IF v_code_record.owner_type = 'influencer' THEN
    UPDATE referral_codes
    SET total_signups = COALESCE(total_signups, 0) + 1
    WHERE id = v_code_record.id;
  END IF;
  
  RETURN QUERY SELECT true AS success, 'Referral code applied successfully'::TEXT AS message;
END;
$$;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION public.apply_referral_code_secure(UUID, TEXT) TO authenticated;

-- SECURITY FIX: Drop the insecure validate_referral_code function
-- that exposes owner_user_id to clients
DROP FUNCTION IF EXISTS public.validate_referral_code(TEXT);