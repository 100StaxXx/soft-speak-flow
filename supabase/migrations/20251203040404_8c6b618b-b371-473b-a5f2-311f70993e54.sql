-- Phase 1: Guild Story Reads tracking table
CREATE TABLE public.guild_story_reads (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  story_id UUID NOT NULL REFERENCES public.guild_stories(id) ON DELETE CASCADE,
  read_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, story_id)
);

-- Enable RLS
ALTER TABLE public.guild_story_reads ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view own story reads"
  ON public.guild_story_reads FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own story reads"
  ON public.guild_story_reads FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own story reads"
  ON public.guild_story_reads FOR DELETE
  USING (auth.uid() = user_id);

-- Phase 2: Muted Guild Users table
CREATE TABLE public.muted_guild_users (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  muted_user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  epic_id UUID REFERENCES public.epics(id) ON DELETE CASCADE,
  muted_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, muted_user_id, epic_id)
);

-- Enable RLS
ALTER TABLE public.muted_guild_users ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view own mutes"
  ON public.muted_guild_users FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own mutes"
  ON public.muted_guild_users FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own mutes"
  ON public.muted_guild_users FOR DELETE
  USING (auth.uid() = user_id);

-- Phase 3: Shout Push Log for rate limiting (1 push per sender per recipient per day)
CREATE TABLE public.shout_push_log (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  sender_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  recipient_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  epic_id UUID NOT NULL REFERENCES public.epics(id) ON DELETE CASCADE,
  sent_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.shout_push_log ENABLE ROW LEVEL SECURITY;

-- Service role policy for edge function
CREATE POLICY "Service can manage shout push logs"
  ON public.shout_push_log FOR ALL
  USING (public.is_service_role());

-- Index for efficient daily lookups
CREATE INDEX idx_shout_push_log_daily ON public.shout_push_log (sender_id, recipient_id, epic_id, sent_at);

-- Enable realtime for epic_activity_feed
ALTER PUBLICATION supabase_realtime ADD TABLE public.epic_activity_feed;