-- Add zodiac sign and birthdate to profiles
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS birthdate date,
ADD COLUMN IF NOT EXISTS zodiac_sign text;

-- Add zodiac to onboarding_data for the reveal
COMMENT ON COLUMN profiles.birthdate IS 'User birthdate for zodiac sign calculation';
COMMENT ON COLUMN profiles.zodiac_sign IS 'User zodiac sign (aries, taurus, gemini, etc.)';