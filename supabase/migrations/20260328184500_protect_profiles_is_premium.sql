-- Harden client profile updates so premium entitlements stay server-managed.

DROP POLICY IF EXISTS "Users can update own profile (restricted)" ON public.profiles;

CREATE POLICY "Users can update own profile (restricted)"
ON public.profiles
FOR UPDATE
USING (auth.uid() = id AND auth.uid() IS NOT NULL)
WITH CHECK (
  auth.uid() = id
  AND auth.uid() IS NOT NULL
  AND referral_count IS NOT DISTINCT FROM (SELECT referral_count FROM profiles WHERE id = auth.uid())
  AND referral_code IS NOT DISTINCT FROM (SELECT referral_code FROM profiles WHERE id = auth.uid())
  AND stripe_customer_id IS NOT DISTINCT FROM (SELECT stripe_customer_id FROM profiles WHERE id = auth.uid())
  AND subscription_status IS NOT DISTINCT FROM (SELECT subscription_status FROM profiles WHERE id = auth.uid())
  AND subscription_started_at IS NOT DISTINCT FROM (SELECT subscription_started_at FROM profiles WHERE id = auth.uid())
  AND subscription_expires_at IS NOT DISTINCT FROM (SELECT subscription_expires_at FROM profiles WHERE id = auth.uid())
  AND trial_started_at IS NOT DISTINCT FROM (SELECT trial_started_at FROM profiles WHERE id = auth.uid())
  AND trial_ends_at IS NOT DISTINCT FROM (SELECT trial_ends_at FROM profiles WHERE id = auth.uid())
  AND is_premium IS NOT DISTINCT FROM (SELECT is_premium FROM profiles WHERE id = auth.uid())
);
