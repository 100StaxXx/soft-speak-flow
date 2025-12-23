-- Fix: Protect subscription and payment fields from client-side modification
-- This prevents users from bypassing premium paywall by modifying subscription_status, etc.

-- Drop existing UPDATE policy
DROP POLICY IF EXISTS "Users can update own profile (restricted)" ON public.profiles;

-- Create improved UPDATE policy that protects subscription/payment fields
-- Users can update their profile, but NOT referral fields, subscription fields, or payment identifiers
CREATE POLICY "Users can update own profile (restricted)"
ON public.profiles FOR UPDATE
USING (auth.uid() = id AND auth.uid() IS NOT NULL)
WITH CHECK (
  auth.uid() = id AND auth.uid() IS NOT NULL
  -- Protect referral fields (existing)
  AND referral_count IS NOT DISTINCT FROM (SELECT referral_count FROM profiles WHERE id = auth.uid())
  AND referral_code IS NOT DISTINCT FROM (SELECT referral_code FROM profiles WHERE id = auth.uid())
  -- Protect Stripe/payment fields
  AND stripe_customer_id IS NOT DISTINCT FROM (SELECT stripe_customer_id FROM profiles WHERE id = auth.uid())
  -- Protect subscription status fields
  AND subscription_status IS NOT DISTINCT FROM (SELECT subscription_status FROM profiles WHERE id = auth.uid())
  AND subscription_started_at IS NOT DISTINCT FROM (SELECT subscription_started_at FROM profiles WHERE id = auth.uid())
  AND subscription_expires_at IS NOT DISTINCT FROM (SELECT subscription_expires_at FROM profiles WHERE id = auth.uid())
  -- Protect trial fields
  AND trial_started_at IS NOT DISTINCT FROM (SELECT trial_started_at FROM profiles WHERE id = auth.uid())
  AND trial_ends_at IS NOT DISTINCT FROM (SELECT trial_ends_at FROM profiles WHERE id = auth.uid())
  -- Note: paypal_email is intentionally NOT protected - users may need to set/update for creator payouts
);