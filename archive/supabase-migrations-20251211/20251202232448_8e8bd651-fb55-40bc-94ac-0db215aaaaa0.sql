-- Drop the existing overly permissive policy
DROP POLICY IF EXISTS "Anyone can view active referral codes" ON public.referral_codes;

-- Create a more restrictive policy that only allows single-code validation
-- Users can only select a referral code when they provide the exact code in their query
CREATE POLICY "Users can validate a specific referral code"
ON public.referral_codes
FOR SELECT
USING (
  -- Allow users to look up their own referral code
  (owner_type = 'user' AND owner_user_id = auth.uid())
  OR
  -- Allow single-code validation queries (code must be specified in WHERE clause)
  -- This prevents full table scans while allowing code validation
  is_active = true
);

-- Note: The above still technically allows SELECT, but we'll add a security definer function
-- to properly validate codes without exposing the table

-- Create a secure function for referral code validation
CREATE OR REPLACE FUNCTION public.validate_referral_code(p_code TEXT)
RETURNS TABLE (
  id UUID,
  code TEXT,
  owner_type TEXT,
  owner_user_id UUID,
  is_active BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    rc.id,
    rc.code,
    rc.owner_type,
    rc.owner_user_id,
    rc.is_active
  FROM referral_codes rc
  WHERE rc.code = p_code
    AND rc.is_active = true
  LIMIT 1;
END;
$$;

-- Now make the policy more restrictive - only allow users to see their own codes
DROP POLICY IF EXISTS "Users can validate a specific referral code" ON public.referral_codes;

CREATE POLICY "Users can view their own referral codes"
ON public.referral_codes
FOR SELECT
USING (
  owner_type = 'user' AND owner_user_id = auth.uid()
);

-- Allow service role full access for admin operations
CREATE POLICY "Service role has full access to referral codes"
ON public.referral_codes
FOR ALL
USING (is_service_role())
WITH CHECK (is_service_role());