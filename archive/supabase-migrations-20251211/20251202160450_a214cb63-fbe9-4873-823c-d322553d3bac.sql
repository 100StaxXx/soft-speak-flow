-- Set trial_ends_at for new users automatically
CREATE OR REPLACE FUNCTION public.set_trial_end_date()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.trial_ends_at IS NULL THEN
    NEW.trial_ends_at := NOW() + INTERVAL '7 days';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create trigger for new profile insertions
DROP TRIGGER IF EXISTS set_trial_on_profile_create ON public.profiles;
CREATE TRIGGER set_trial_on_profile_create
  BEFORE INSERT ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.set_trial_end_date();

-- Backfill existing users with grace period (7 days from now)
UPDATE public.profiles 
SET trial_ends_at = NOW() + INTERVAL '7 days'
WHERE trial_ends_at IS NULL;