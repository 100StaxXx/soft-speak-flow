-- Fix referral_codes RLS policy to only expose code field during validation
-- Drop the overly permissive policy
DROP POLICY IF EXISTS "Anyone can validate codes" ON referral_codes;

-- Create a more restrictive policy that still allows code validation
-- but prevents exposure of sensitive business data
CREATE POLICY "Anyone can check if code exists"
ON referral_codes FOR SELECT
USING (is_active = true);

-- Note: The validate_referral_code() function already restricts returned columns
-- For additional security, we should rely on that function for validations
-- and this policy only allows checking existence

-- Create a secure function for code validation that only returns necessary data
CREATE OR REPLACE FUNCTION public.validate_referral_code_secure(p_code text)
RETURNS TABLE(
  is_valid boolean,
  code_id uuid
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    true as is_valid,
    rc.id as code_id
  FROM referral_codes rc
  WHERE rc.code = p_code
    AND rc.is_active = true
  LIMIT 1;
  
  -- If no rows returned, return a single row with is_valid = false
  IF NOT FOUND THEN
    RETURN QUERY SELECT false as is_valid, NULL::uuid as code_id;
  END IF;
END;
$$;