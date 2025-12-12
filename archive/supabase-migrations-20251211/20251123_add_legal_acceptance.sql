-- Add legal acceptance tracking to profiles table
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS legal_accepted_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS legal_accepted_version TEXT;

-- Add comments for clarity
COMMENT ON COLUMN public.profiles.legal_accepted_at IS 'Timestamp when user accepted terms and privacy policy';
COMMENT ON COLUMN public.profiles.legal_accepted_version IS 'Version of legal documents accepted by user';

-- Update trigger to handle timezone detection on user creation
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, created_at, updated_at, timezone)
  VALUES (
    NEW.id,
    NEW.email,
    NOW(),
    NOW(),
    COALESCE(NEW.raw_user_meta_data->>'timezone', 'UTC')
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

-- Add index for faster legal acceptance queries
CREATE INDEX IF NOT EXISTS idx_profiles_legal_acceptance 
ON public.profiles(legal_accepted_at, legal_accepted_version)
WHERE legal_accepted_at IS NOT NULL;