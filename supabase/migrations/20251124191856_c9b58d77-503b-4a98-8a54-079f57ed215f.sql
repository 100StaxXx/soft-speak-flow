-- Add activity feed table for epic member activities
CREATE TABLE IF NOT EXISTS public.epic_activity_feed (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  epic_id UUID NOT NULL REFERENCES public.epics(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  activity_type TEXT NOT NULL, -- 'habit_completed', 'milestone_reached', 'joined_epic', etc.
  activity_data JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.epic_activity_feed ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view activity for epics they're members of or public epics
CREATE POLICY "Users can view epic activity they have access to"
ON public.epic_activity_feed
FOR SELECT
USING (
  epic_id IN (
    SELECT id FROM public.epics 
    WHERE is_public = true OR user_id = auth.uid()
  ) OR
  epic_id IN (
    SELECT epic_id FROM public.epic_members 
    WHERE user_id = auth.uid()
  )
);

-- Create index for performance
CREATE INDEX idx_epic_activity_feed_epic_id ON public.epic_activity_feed(epic_id);
CREATE INDEX idx_epic_activity_feed_created_at ON public.epic_activity_feed(created_at DESC);