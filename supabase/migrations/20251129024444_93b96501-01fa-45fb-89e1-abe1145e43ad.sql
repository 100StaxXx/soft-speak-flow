-- Create guild_stories table for collaborative companion stories
CREATE TABLE public.guild_stories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  epic_id UUID NOT NULL REFERENCES public.epics(id) ON DELETE CASCADE,
  chapter_number INTEGER NOT NULL DEFAULT 1,
  chapter_title TEXT NOT NULL,
  intro_line TEXT NOT NULL,
  main_story TEXT NOT NULL,
  companion_spotlights JSONB NOT NULL DEFAULT '[]'::jsonb,
  climax_moment TEXT NOT NULL,
  bond_lesson TEXT NOT NULL,
  next_hook TEXT,
  trigger_type TEXT NOT NULL,
  generated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Add index for efficient epic lookups
CREATE INDEX idx_guild_stories_epic ON public.guild_stories(epic_id);
CREATE INDEX idx_guild_stories_created ON public.guild_stories(created_at DESC);

-- Enable RLS
ALTER TABLE public.guild_stories ENABLE ROW LEVEL SECURITY;

-- RLS Policies: Guild members can view stories for their guilds
CREATE POLICY "Users can view guild stories for their epics"
  ON public.guild_stories
  FOR SELECT
  USING (
    epic_id IN (
      SELECT epic_id FROM public.epic_members WHERE user_id = auth.uid()
    )
    OR
    epic_id IN (
      SELECT id FROM public.epics WHERE user_id = auth.uid()
    )
  );

-- Service role can insert stories
CREATE POLICY "Service can insert guild stories"
  ON public.guild_stories
  FOR INSERT
  WITH CHECK (is_service_role());

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.guild_stories;