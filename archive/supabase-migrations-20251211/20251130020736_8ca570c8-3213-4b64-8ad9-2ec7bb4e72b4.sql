-- Add energy_forecast column to user_daily_horoscopes table
ALTER TABLE public.user_daily_horoscopes
ADD COLUMN IF NOT EXISTS energy_forecast JSONB DEFAULT NULL;