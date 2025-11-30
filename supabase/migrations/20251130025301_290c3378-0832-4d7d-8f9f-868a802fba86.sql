-- Add placement_insights column to user_daily_horoscopes table
ALTER TABLE user_daily_horoscopes 
ADD COLUMN IF NOT EXISTS placement_insights jsonb DEFAULT NULL;

COMMENT ON COLUMN user_daily_horoscopes.placement_insights IS 'Daily insights for each astrological placement (sun, moon, rising, mercury, mars, venus)';