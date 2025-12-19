-- Fix: Replace public SELECT policy on referral_codes with secure RPC function
-- This prevents exposure of sensitive influencer data (emails, payout info, revenue)

-- First, drop the overly permissive policy
DROP POLICY IF EXISTS "Anyone can validate codes" ON public.referral_codes;

-- Create a secure RPC function that only returns whether a code is valid
-- This prevents information leakage about influencer data
CREATE OR REPLACE FUNCTION public.validate_referral_code_public(p_code TEXT)
RETURNS TABLE(
  is_valid BOOLEAN,
  code TEXT,
  owner_type TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only return minimal information needed for code validation
  -- Do NOT expose email, payout info, or revenue data
  RETURN QUERY
  SELECT 
    true AS is_valid,
    rc.code,
    rc.owner_type
  FROM referral_codes rc
  WHERE UPPER(rc.code) = UPPER(p_code)
    AND rc.is_active = true
  LIMIT 1;
  
  -- If no rows returned, return a single row indicating invalid
  IF NOT FOUND THEN
    RETURN QUERY SELECT false AS is_valid, NULL::TEXT AS code, NULL::TEXT AS owner_type;
  END IF;
END;
$$;

-- Grant execute permission to authenticated and anon users for validation
GRANT EXECUTE ON FUNCTION public.validate_referral_code_public(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.validate_referral_code_public(TEXT) TO anon;

-- Ensure owners can still see their own referral code data
-- Keep existing owner policies but verify they exist
DO $$
BEGIN
  -- Check if owner policy exists, if not create it
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'referral_codes' 
    AND policyname = 'Owners can view their own codes'
  ) THEN
    CREATE POLICY "Owners can view their own codes"
    ON public.referral_codes FOR SELECT
    USING (owner_user_id = auth.uid());
  END IF;
END
$$;

-- Add policy for admins to view all codes (for admin dashboard)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'referral_codes' 
    AND policyname = 'Admins can view all codes'
  ) THEN
    CREATE POLICY "Admins can view all codes"
    ON public.referral_codes FOR SELECT
    USING (public.has_role(auth.uid(), 'admin'));
  END IF;
END
$$;