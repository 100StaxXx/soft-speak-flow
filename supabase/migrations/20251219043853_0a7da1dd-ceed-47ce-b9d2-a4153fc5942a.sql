-- Fix: Remove the overly permissive public SELECT policy on referral_codes
-- This policy exposes sensitive influencer data (PayPal emails, revenue, personal info)
-- Code validation is now handled by the secure validate_referral_code_public() RPC function

-- Drop the dangerous policy that allows anyone to read all fields
DROP POLICY IF EXISTS "Anyone can check if code exists" ON public.referral_codes;

-- Also drop the old policy name if it exists
DROP POLICY IF EXISTS "Anyone can validate codes" ON public.referral_codes;

-- Clean up duplicate owner policies (keep only one)
DROP POLICY IF EXISTS "Users view own code" ON public.referral_codes;
DROP POLICY IF EXISTS "Users can view their own referral codes" ON public.referral_codes;

-- The remaining policies are secure:
-- 1. "Admins can view all codes" - uses has_role() check
-- 2. "Owners can view their own codes" - uses owner_user_id = auth.uid()
-- 3. "Service role has full access to referral codes" - uses is_service_role()
-- 4. "Service creates codes" - INSERT only for service role

-- Verify the validate_referral_code_public function exists for public code validation
-- This function only returns is_valid, code, and owner_type - no sensitive data
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc 
    WHERE proname = 'validate_referral_code_public'
  ) THEN
    RAISE EXCEPTION 'validate_referral_code_public function must exist for code validation';
  END IF;
END
$$;