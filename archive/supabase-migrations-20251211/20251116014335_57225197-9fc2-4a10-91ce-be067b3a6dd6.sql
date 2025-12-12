-- Create daily_pep_talks table
CREATE TABLE IF NOT EXISTS public.daily_pep_talks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mentor_slug TEXT NOT NULL,
  topic_category TEXT NOT NULL,
  emotional_triggers TEXT[] NOT NULL DEFAULT '{}',
  intensity TEXT NOT NULL,
  title TEXT NOT NULL,
  summary TEXT NOT NULL,
  script TEXT NOT NULL,
  audio_url TEXT NOT NULL,
  for_date DATE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create index for efficient lookups
CREATE INDEX IF NOT EXISTS idx_daily_pep_talks_date_mentor 
ON public.daily_pep_talks(for_date, mentor_slug);

-- Enable RLS
ALTER TABLE public.daily_pep_talks ENABLE ROW LEVEL SECURITY;

-- Anyone can view daily pep talks
CREATE POLICY "Anyone can view daily pep talks"
ON public.daily_pep_talks
FOR SELECT
USING (true);

-- Admins can manage daily pep talks
CREATE POLICY "Admins can manage daily pep talks"
ON public.daily_pep_talks
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

-- Add columns to pep_talks table if they don't exist
ALTER TABLE public.pep_talks 
ADD COLUMN IF NOT EXISTS mentor_slug TEXT,
ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'manual',
ADD COLUMN IF NOT EXISTS for_date DATE NULL,
ADD COLUMN IF NOT EXISTS intensity TEXT;

-- Create index for efficient filtering
CREATE INDEX IF NOT EXISTS idx_pep_talks_source_date 
ON public.pep_talks(source, for_date);

-- Create user_daily_pushes table for delivery tracking
CREATE TABLE IF NOT EXISTS public.user_daily_pushes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  daily_pep_talk_id UUID NOT NULL REFERENCES public.daily_pep_talks(id) ON DELETE CASCADE,
  scheduled_at TIMESTAMPTZ NOT NULL,
  delivered_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.user_daily_pushes ENABLE ROW LEVEL SECURITY;

-- Users can view their own pushes
CREATE POLICY "Users can view own pushes"
ON public.user_daily_pushes
FOR SELECT
USING (auth.uid() = user_id);

-- Create index for efficient delivery queries
CREATE INDEX IF NOT EXISTS idx_user_daily_pushes_scheduled 
ON public.user_daily_pushes(scheduled_at, delivered_at);

-- Add daily push settings to profiles if not exists
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS daily_push_enabled BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS daily_push_window TEXT DEFAULT 'morning',
ADD COLUMN IF NOT EXISTS daily_push_time TIME DEFAULT '08:00',
ADD COLUMN IF NOT EXISTS timezone TEXT DEFAULT 'UTC';