-- Add trial_started_at column to track when trial was first granted (for abuse prevention)
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS trial_started_at TIMESTAMPTZ;

-- Update existing profiles to set trial_started_at from created_at (backfill)
UPDATE public.profiles 
SET trial_started_at = created_at 
WHERE trial_started_at IS NULL;

-- Update the trigger to set trial_started_at once on creation
CREATE OR REPLACE FUNCTION public.set_trial_end_date()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.trial_ends_at IS NULL THEN
    NEW.trial_ends_at := NOW() + INTERVAL '7 days';
  END IF;
  -- Only set trial_started_at once (on first insert)
  IF NEW.trial_started_at IS NULL THEN
    NEW.trial_started_at := NOW();
  END IF;
  RETURN NEW;
END;
$function$;