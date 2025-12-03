-- Improve trial system with better documentation and safety checks
-- This migration adds comments and improves the trial_ends_at trigger

-- Update the trial end date function with better documentation
CREATE OR REPLACE FUNCTION public.set_trial_end_date()
RETURNS TRIGGER AS $$
BEGIN
  -- Set trial_ends_at to 7 days from now if not already set
  -- This gives new users a 7-day free trial with full premium access
  -- 
  -- TRIAL ABUSE PREVENTION NOTE:
  -- Currently, users could theoretically create multiple accounts to get multiple trials.
  -- For future enhancement, consider:
  --   1. Tracking trials by email address (not just user_id) to prevent re-registration abuse
  --   2. Device fingerprinting (though this has privacy implications)
  --   3. Payment method verification (requires storing payment info, contradicts "no CC required")
  --   4. IP-based rate limiting (can have false positives with shared networks)
  --
  -- The current approach balances user experience (frictionless trial) with abuse risk.
  -- Most users won't exploit this, and the 7-day window limits the impact.
  
  IF NEW.trial_ends_at IS NULL THEN
    NEW.trial_ends_at := NOW() + INTERVAL '7 days';
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Add comment to profiles table about trial_ends_at field
COMMENT ON COLUMN public.profiles.trial_ends_at IS 
  'UTC timestamp when the user''s 7-day free trial ends. Set automatically on account creation. Users have premium access while NOW() <= trial_ends_at OR they have an active subscription.';

-- Add comment to explain the trial system
COMMENT ON TRIGGER set_trial_on_profile_create ON public.profiles IS
  'Automatically sets trial_ends_at to NOW() + 7 days for new users, granting them a 7-day free trial with full premium access.';

-- Add index on trial_ends_at for efficient queries
-- This helps with queries like "find users whose trial expires today" for reminder emails
CREATE INDEX IF NOT EXISTS idx_profiles_trial_ends_at ON public.profiles(trial_ends_at) 
  WHERE trial_ends_at IS NOT NULL;

-- Add index on subscription_status for efficient filtering
CREATE INDEX IF NOT EXISTS idx_profiles_subscription_status ON public.profiles(subscription_status) 
  WHERE subscription_status IS NOT NULL;
