-- Add astral encounters toggle to profiles
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS astral_encounters_enabled boolean DEFAULT true;