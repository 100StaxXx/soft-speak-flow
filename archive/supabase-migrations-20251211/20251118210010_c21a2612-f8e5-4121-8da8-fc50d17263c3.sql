-- Create table for companion story chapters
CREATE TABLE public.companion_stories (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  companion_id uuid NOT NULL REFERENCES public.user_companion(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  stage integer NOT NULL CHECK (stage >= 0 AND stage <= 20),
  chapter_title text NOT NULL,
  intro_line text NOT NULL,
  main_story text NOT NULL,
  bond_moment text NOT NULL,
  life_lesson text NOT NULL,
  lore_expansion jsonb NOT NULL DEFAULT '[]'::jsonb,
  next_hook text NOT NULL,
  tone_preference text NOT NULL DEFAULT 'heroic',
  generated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(companion_id, stage)
);

-- Enable RLS
ALTER TABLE public.companion_stories ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view own stories"
  ON public.companion_stories
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own stories"
  ON public.companion_stories
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own stories"
  ON public.companion_stories
  FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own stories"
  ON public.companion_stories
  FOR DELETE
  USING (auth.uid() = user_id);

-- Index for faster queries
CREATE INDEX idx_companion_stories_companion_stage ON public.companion_stories(companion_id, stage);
CREATE INDEX idx_companion_stories_user ON public.companion_stories(user_id);