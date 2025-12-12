-- Companion Evolution System Tables

-- User companions table
CREATE TABLE public.user_companion (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL UNIQUE,
  
  -- Personalization choices
  favorite_color TEXT NOT NULL,
  spirit_animal TEXT NOT NULL,
  core_element TEXT NOT NULL,
  
  -- Evolution tracking
  current_stage INTEGER DEFAULT 0 NOT NULL,
  current_xp INTEGER DEFAULT 0 NOT NULL,
  current_image_url TEXT,
  
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Evolution history
CREATE TABLE public.companion_evolutions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  companion_id UUID REFERENCES user_companion(id) ON DELETE CASCADE NOT NULL,
  stage INTEGER NOT NULL,
  image_url TEXT NOT NULL,
  evolved_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  xp_at_evolution INTEGER NOT NULL
);

-- XP event log
CREATE TABLE public.xp_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  companion_id UUID REFERENCES user_companion(id) ON DELETE CASCADE NOT NULL,
  event_type TEXT NOT NULL,
  xp_earned INTEGER NOT NULL,
  event_metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Indexes for performance
CREATE INDEX idx_user_companion_user_id ON public.user_companion(user_id);
CREATE INDEX idx_companion_evolutions_companion_id ON public.companion_evolutions(companion_id);
CREATE INDEX idx_xp_events_user_id ON public.xp_events(user_id);
CREATE INDEX idx_xp_events_companion_id ON public.xp_events(companion_id);
CREATE INDEX idx_xp_events_created_at ON public.xp_events(created_at DESC);

-- RLS Policies
ALTER TABLE public.user_companion ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.companion_evolutions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.xp_events ENABLE ROW LEVEL SECURITY;

-- Users can view their own companion
CREATE POLICY "Users can view own companion"
  ON public.user_companion FOR SELECT
  USING (auth.uid() = user_id);

-- Users can insert their own companion
CREATE POLICY "Users can create own companion"
  ON public.user_companion FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own companion
CREATE POLICY "Users can update own companion"
  ON public.user_companion FOR UPDATE
  USING (auth.uid() = user_id);

-- Users can view their evolution history
CREATE POLICY "Users can view own evolutions"
  ON public.companion_evolutions FOR SELECT
  USING (
    companion_id IN (
      SELECT id FROM public.user_companion WHERE user_id = auth.uid()
    )
  );

-- Users can insert evolutions
CREATE POLICY "Users can insert own evolutions"
  ON public.companion_evolutions FOR INSERT
  WITH CHECK (
    companion_id IN (
      SELECT id FROM public.user_companion WHERE user_id = auth.uid()
    )
  );

-- Users can view their XP events
CREATE POLICY "Users can view own xp events"
  ON public.xp_events FOR SELECT
  USING (auth.uid() = user_id);

-- Users can insert XP events
CREATE POLICY "Users can insert own xp events"
  ON public.xp_events FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Trigger to update updated_at
CREATE TRIGGER update_user_companion_updated_at
  BEFORE UPDATE ON public.user_companion
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();