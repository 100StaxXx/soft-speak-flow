-- Create table for storing user daily horoscopes
CREATE TABLE IF NOT EXISTS public.user_daily_horoscopes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  for_date date NOT NULL DEFAULT CURRENT_DATE,
  zodiac text NOT NULL,
  horoscope_text text NOT NULL,
  is_personalized boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone DEFAULT now(),
  UNIQUE(user_id, for_date)
);

-- Enable RLS
ALTER TABLE public.user_daily_horoscopes ENABLE ROW LEVEL SECURITY;

-- Users can view their own horoscopes
CREATE POLICY "Users can view own horoscopes"
  ON public.user_daily_horoscopes
  FOR SELECT
  USING (auth.uid() = user_id);

-- Users can insert their own horoscopes
CREATE POLICY "Users can insert own horoscopes"
  ON public.user_daily_horoscopes
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Create index for faster lookups
CREATE INDEX idx_user_daily_horoscopes_user_date 
  ON public.user_daily_horoscopes(user_id, for_date);