-- Create user_bad_habits table for tracking bad habits users want to break
CREATE TABLE public.user_bad_habits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  icon TEXT DEFAULT '🚫',
  habit_theme TEXT NOT NULL,
  times_resisted INTEGER DEFAULT 0,
  current_streak INTEGER DEFAULT 0,
  longest_streak INTEGER DEFAULT 0,
  last_resisted_at TIMESTAMPTZ,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.user_bad_habits ENABLE ROW LEVEL SECURITY;

-- RLS policies for user_bad_habits
CREATE POLICY "Users can view their own bad habits"
  ON public.user_bad_habits FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own bad habits"
  ON public.user_bad_habits FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own bad habits"
  ON public.user_bad_habits FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own bad habits"
  ON public.user_bad_habits FOR DELETE
  USING (auth.uid() = user_id);

-- Create resist_log table for tracking resist attempts
CREATE TABLE public.resist_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  habit_id UUID NOT NULL REFERENCES public.user_bad_habits(id) ON DELETE CASCADE,
  encounter_id UUID REFERENCES public.astral_encounters(id) ON DELETE SET NULL,
  result TEXT NOT NULL,
  xp_earned INTEGER DEFAULT 0,
  care_boost NUMERIC(3,2) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.resist_log ENABLE ROW LEVEL SECURITY;

-- RLS policies for resist_log
CREATE POLICY "Users can view their own resist logs"
  ON public.resist_log FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own resist logs"
  ON public.resist_log FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Add indexes for performance
CREATE INDEX idx_user_bad_habits_user_id ON public.user_bad_habits(user_id);
CREATE INDEX idx_user_bad_habits_active ON public.user_bad_habits(user_id, is_active);
CREATE INDEX idx_resist_log_user_id ON public.resist_log(user_id);
CREATE INDEX idx_resist_log_habit_id ON public.resist_log(habit_id);