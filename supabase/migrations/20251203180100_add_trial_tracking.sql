-- Add trial_started_at for abuse prevention tracking
-- This field is set once and never changed, unlike trial_ends_at which could be extended

ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS trial_started_at TIMESTAMPTZ;

-- Update the trigger to set trial_started_at (immutable once set)
CREATE OR REPLACE FUNCTION public.set_trial_end_date()
RETURNS TRIGGER AS $$
BEGIN
  -- Only set trial dates if not already set (prevents reset on update)
  IF NEW.trial_ends_at IS NULL THEN
    NEW.trial_ends_at := NOW() + INTERVAL '7 days';
  END IF;
  
  -- Set trial_started_at immutably (for abuse tracking)
  IF NEW.trial_started_at IS NULL THEN
    NEW.trial_started_at := NOW();
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Backfill existing users with trial_started_at based on their created_at
UPDATE public.profiles 
SET trial_started_at = created_at
WHERE trial_started_at IS NULL AND created_at IS NOT NULL;

-- Add comment explaining the field
COMMENT ON COLUMN public.profiles.trial_started_at IS 
  'UTC timestamp when user''s trial first started. Set once on account creation and never changed. Used for abuse prevention and analytics. Differs from trial_ends_at which could be extended via promotions.';

-- Create index for analytics queries (e.g., "how many trials started this month?")
CREATE INDEX IF NOT EXISTS idx_profiles_trial_started_at ON public.profiles(trial_started_at) 
  WHERE trial_started_at IS NOT NULL;
