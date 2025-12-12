-- Add cosmic_tip column to user_daily_horoscopes table
ALTER TABLE public.user_daily_horoscopes 
ADD COLUMN IF NOT EXISTS cosmic_tip text;