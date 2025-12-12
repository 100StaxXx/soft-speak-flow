-- Activity Feed: Unified timeline of all user activities with mentor commentary
CREATE TABLE public.activity_feed (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  activity_type TEXT NOT NULL, -- 'habit_completed', 'mood_logged', 'pep_talk_listened', 'chat_message', 'reflection_completed'
  activity_data JSONB NOT NULL DEFAULT '{}',
  mentor_comment TEXT,
  mentor_voice_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  is_read BOOLEAN DEFAULT false
);

-- Daily Check-ins: Morning, midday, evening structured interactions
CREATE TABLE public.daily_check_ins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  check_in_type TEXT NOT NULL, -- 'morning', 'midday', 'evening'
  check_in_date DATE NOT NULL DEFAULT CURRENT_DATE,
  mood TEXT,
  intention TEXT,
  reflection TEXT,
  mentor_response TEXT,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, check_in_type, check_in_date)
);

-- Mentor Nudges: Proactive messages from mentor
CREATE TABLE public.mentor_nudges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  nudge_type TEXT NOT NULL, -- 'habit_reminder', 'encouragement', 'challenge', 'check_in'
  message TEXT NOT NULL,
  voice_url TEXT,
  context JSONB DEFAULT '{}',
  delivered_at TIMESTAMPTZ DEFAULT now(),
  read_at TIMESTAMPTZ,
  dismissed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RLS Policies for activity_feed
ALTER TABLE public.activity_feed ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own activity feed"
  ON public.activity_feed FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own activity"
  ON public.activity_feed FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own activity"
  ON public.activity_feed FOR UPDATE
  USING (auth.uid() = user_id);

-- RLS Policies for daily_check_ins
ALTER TABLE public.daily_check_ins ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own check-ins"
  ON public.daily_check_ins FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own check-ins"
  ON public.daily_check_ins FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own check-ins"
  ON public.daily_check_ins FOR UPDATE
  USING (auth.uid() = user_id);

-- RLS Policies for mentor_nudges
ALTER TABLE public.mentor_nudges ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own nudges"
  ON public.mentor_nudges FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update own nudges"
  ON public.mentor_nudges FOR UPDATE
  USING (auth.uid() = user_id);

-- Indexes for performance
CREATE INDEX idx_activity_feed_user_created ON public.activity_feed(user_id, created_at DESC);
CREATE INDEX idx_daily_check_ins_user_date ON public.daily_check_ins(user_id, check_in_date DESC);
CREATE INDEX idx_mentor_nudges_user_delivered ON public.mentor_nudges(user_id, delivered_at DESC) WHERE dismissed_at IS NULL;