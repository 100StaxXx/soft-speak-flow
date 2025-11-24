-- Create epic_members table to track users in shared epics
CREATE TABLE IF NOT EXISTS public.epic_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  epic_id uuid NOT NULL REFERENCES public.epics(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  joined_at timestamp with time zone NOT NULL DEFAULT now(),
  total_contribution integer NOT NULL DEFAULT 0,
  last_activity_at timestamp with time zone DEFAULT now(),
  UNIQUE(epic_id, user_id)
);

-- Enable RLS
ALTER TABLE public.epic_members ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view members of epics they're in or public epics"
  ON public.epic_members FOR SELECT
  USING (
    epic_id IN (
      SELECT id FROM public.epics 
      WHERE is_public = true OR user_id = auth.uid()
    )
    OR user_id = auth.uid()
  );

CREATE POLICY "Users can join public epics"
  ON public.epic_members FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND epic_id IN (SELECT id FROM public.epics WHERE is_public = true)
  );

CREATE POLICY "Epic creators can remove members"
  ON public.epic_members FOR DELETE
  USING (
    epic_id IN (SELECT id FROM public.epics WHERE user_id = auth.uid())
    OR user_id = auth.uid()
  );

-- Create index for faster lookups
CREATE INDEX idx_epic_members_epic_id ON public.epic_members(epic_id);
CREATE INDEX idx_epic_members_user_id ON public.epic_members(user_id);

-- Create epic_discord_events table to track what's been posted
CREATE TABLE IF NOT EXISTS public.epic_discord_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  epic_id uuid NOT NULL REFERENCES public.epics(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  event_data jsonb NOT NULL DEFAULT '{}',
  posted_at timestamp with time zone NOT NULL DEFAULT now(),
  webhook_response text
);

-- Enable RLS
ALTER TABLE public.epic_discord_events ENABLE ROW LEVEL SECURITY;

-- Only admins can view discord events
CREATE POLICY "Admins can view discord events"
  ON public.epic_discord_events FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Create index
CREATE INDEX idx_epic_discord_events_epic_id ON public.epic_discord_events(epic_id);