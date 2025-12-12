-- Add cosmic profile fields to profiles table
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS moon_sign text,
ADD COLUMN IF NOT EXISTS rising_sign text,
ADD COLUMN IF NOT EXISTS mercury_sign text,
ADD COLUMN IF NOT EXISTS mars_sign text,
ADD COLUMN IF NOT EXISTS venus_sign text,
ADD COLUMN IF NOT EXISTS cosmic_profile_generated_at timestamp with time zone;