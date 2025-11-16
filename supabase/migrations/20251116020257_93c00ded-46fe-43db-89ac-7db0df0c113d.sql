-- Add daily quote push settings to profiles table
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS daily_quote_push_enabled boolean DEFAULT true,
ADD COLUMN IF NOT EXISTS daily_quote_push_window text DEFAULT 'afternoon',
ADD COLUMN IF NOT EXISTS daily_quote_push_time time without time zone DEFAULT '14:00:00';