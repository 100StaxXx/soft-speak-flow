-- Migration to add missing table definitions that exist in database but lack migration files
-- These tables are referenced in code and exist in the database, but need proper version control

-- Create user_reflections table
CREATE TABLE IF NOT EXISTS public.user_reflections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reflection_date DATE NOT NULL,
  mood TEXT NOT NULL,
  note TEXT,
  ai_reply TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, reflection_date)
);

-- Enable RLS
ALTER TABLE public.user_reflections ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view own reflections"
  ON public.user_reflections FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own reflections"
  ON public.user_reflections FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own reflections"
  ON public.user_reflections FOR UPDATE
  USING (auth.uid() = user_id);

-- Index for efficient lookups
CREATE INDEX IF NOT EXISTS idx_user_reflections_user_date 
  ON public.user_reflections(user_id, reflection_date DESC);

-- Create daily_quotes table
CREATE TABLE IF NOT EXISTS public.daily_quotes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  for_date DATE NOT NULL,
  mentor_slug TEXT NOT NULL,
  quote_id UUID NOT NULL REFERENCES public.quotes(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(for_date, mentor_slug)
);

-- Enable RLS
ALTER TABLE public.daily_quotes ENABLE ROW LEVEL SECURITY;

-- Anyone can view daily quotes
CREATE POLICY "Anyone can view daily quotes"
  ON public.daily_quotes FOR SELECT
  USING (true);

-- Admins can manage daily quotes
CREATE POLICY "Admins can manage daily quotes"
  ON public.daily_quotes FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Index for efficient lookups
CREATE INDEX IF NOT EXISTS idx_daily_quotes_date_mentor 
  ON public.daily_quotes(for_date, mentor_slug);

-- Create user_daily_quote_pushes table
CREATE TABLE IF NOT EXISTS public.user_daily_quote_pushes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  daily_quote_id UUID NOT NULL REFERENCES public.daily_quotes(id) ON DELETE CASCADE,
  scheduled_at TIMESTAMPTZ NOT NULL,
  delivered_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.user_daily_quote_pushes ENABLE ROW LEVEL SECURITY;

-- Users can view their own quote pushes
CREATE POLICY "Users can view own quote pushes"
  ON public.user_daily_quote_pushes FOR SELECT
  USING (auth.uid() = user_id);

-- Service role can manage quote pushes (for edge functions)
CREATE POLICY "Service can manage quote pushes"
  ON public.user_daily_quote_pushes FOR ALL
  USING (public.is_service_role());

-- Index for efficient delivery queries
CREATE INDEX IF NOT EXISTS idx_user_daily_quote_pushes_scheduled 
  ON public.user_daily_quote_pushes(scheduled_at, delivered_at);

-- Create challenge_tasks table
CREATE TABLE IF NOT EXISTS public.challenge_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  challenge_id UUID NOT NULL REFERENCES public.challenges(id) ON DELETE CASCADE,
  day_number INTEGER NOT NULL CHECK (day_number > 0),
  task_title TEXT NOT NULL,
  task_description TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(challenge_id, day_number)
);

-- Enable RLS
ALTER TABLE public.challenge_tasks ENABLE ROW LEVEL SECURITY;

-- Anyone can view challenge tasks
CREATE POLICY "Anyone can view challenge tasks"
  ON public.challenge_tasks FOR SELECT
  USING (true);

-- Admins can manage challenge tasks
CREATE POLICY "Admins can manage challenge tasks"
  ON public.challenge_tasks FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Index for efficient lookups
CREATE INDEX IF NOT EXISTS idx_challenge_tasks_challenge_day 
  ON public.challenge_tasks(challenge_id, day_number);

