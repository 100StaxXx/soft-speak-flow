-- Add birth time and location fields to profiles for advanced astrology
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS birth_time time without time zone,
ADD COLUMN IF NOT EXISTS birth_location text;

COMMENT ON COLUMN public.profiles.birth_time IS 'Optional birth time for calculating rising sign and houses';
COMMENT ON COLUMN public.profiles.birth_location IS 'Optional birth location (city, country) for advanced astrology calculations';