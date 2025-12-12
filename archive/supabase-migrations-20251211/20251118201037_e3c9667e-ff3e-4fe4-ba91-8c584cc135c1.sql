-- Add onboarding progress tracking to profiles table
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS onboarding_step TEXT DEFAULT 'questionnaire',
ADD COLUMN IF NOT EXISTS onboarding_data JSONB DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.profiles.onboarding_step IS 'Current step in onboarding: questionnaire, mentor_reveal, companion, complete';
COMMENT ON COLUMN public.profiles.onboarding_data IS 'Additional onboarding state data for resuming progress';