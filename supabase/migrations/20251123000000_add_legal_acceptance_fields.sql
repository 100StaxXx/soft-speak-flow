-- Add legal acceptance tracking fields to profiles table
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS terms_accepted_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS terms_accepted_version TEXT,
ADD COLUMN IF NOT EXISTS privacy_accepted_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS privacy_accepted_version TEXT,
ADD COLUMN IF NOT EXISTS age_confirmed BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS age_confirmed_at TIMESTAMPTZ;

-- Add comment for documentation
COMMENT ON COLUMN public.profiles.terms_accepted_at IS 'Timestamp when user accepted Terms of Service';
COMMENT ON COLUMN public.profiles.terms_accepted_version IS 'Version of Terms of Service that was accepted';
COMMENT ON COLUMN public.profiles.privacy_accepted_at IS 'Timestamp when user accepted Privacy Policy';
COMMENT ON COLUMN public.profiles.privacy_accepted_version IS 'Version of Privacy Policy that was accepted';
COMMENT ON COLUMN public.profiles.age_confirmed IS 'Whether user confirmed they are 13 or older';
COMMENT ON COLUMN public.profiles.age_confirmed_at IS 'Timestamp when user confirmed their age';

-- Create index for querying users by legal acceptance
CREATE INDEX IF NOT EXISTS idx_profiles_legal_acceptance 
ON public.profiles(terms_accepted_at, privacy_accepted_at) 
WHERE terms_accepted_at IS NOT NULL AND privacy_accepted_at IS NOT NULL;
