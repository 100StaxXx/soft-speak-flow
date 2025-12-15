-- Create evening_reflections table
CREATE TABLE public.evening_reflections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  reflection_date date NOT NULL DEFAULT CURRENT_DATE,
  mood text NOT NULL,
  wins text,
  gratitude text,
  mentor_response text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, reflection_date)
);

-- Enable RLS
ALTER TABLE public.evening_reflections ENABLE ROW LEVEL SECURITY;

-- RLS policies for evening_reflections
CREATE POLICY "Users can view own evening reflections"
  ON public.evening_reflections FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own evening reflections"
  ON public.evening_reflections FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own evening reflections"
  ON public.evening_reflections FOR UPDATE
  USING (auth.uid() = user_id);

-- Create weekly_recaps table
CREATE TABLE public.weekly_recaps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  week_start_date date NOT NULL,
  week_end_date date NOT NULL,
  mood_data jsonb DEFAULT '{"morning": [], "evening": [], "trend": "stable"}'::jsonb,
  gratitude_themes text[] DEFAULT '{}'::text[],
  win_highlights text[] DEFAULT '{}'::text[],
  stats jsonb DEFAULT '{"checkIns": 0, "reflections": 0, "quests": 0, "habits": 0}'::jsonb,
  mentor_insight text,
  created_at timestamptz NOT NULL DEFAULT now(),
  viewed_at timestamptz,
  UNIQUE(user_id, week_start_date)
);

-- Enable RLS
ALTER TABLE public.weekly_recaps ENABLE ROW LEVEL SECURITY;

-- RLS policies for weekly_recaps
CREATE POLICY "Users can view own weekly recaps"
  ON public.weekly_recaps FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own weekly recaps"
  ON public.weekly_recaps FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own weekly recaps"
  ON public.weekly_recaps FOR UPDATE
  USING (auth.uid() = user_id);