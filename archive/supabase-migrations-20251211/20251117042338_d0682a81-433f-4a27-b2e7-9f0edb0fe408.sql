-- Add difficulty to habits table
ALTER TABLE public.habits 
ADD COLUMN difficulty text DEFAULT 'medium' CHECK (difficulty IN ('easy', 'medium', 'hard'));

-- Create daily_missions table
CREATE TABLE public.daily_missions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  mission_type text NOT NULL,
  mission_text text NOT NULL,
  xp_reward integer NOT NULL DEFAULT 10,
  mission_date date NOT NULL DEFAULT CURRENT_DATE,
  completed boolean DEFAULT false,
  completed_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.daily_missions ENABLE ROW LEVEL SECURITY;

-- RLS policies for daily_missions
CREATE POLICY "Users can view their own missions"
  ON public.daily_missions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own missions"
  ON public.daily_missions FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own missions"
  ON public.daily_missions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Index for faster queries
CREATE INDEX idx_daily_missions_user_date ON public.daily_missions(user_id, mission_date);

-- Add streak_count to profiles for tracking
ALTER TABLE public.profiles
ADD COLUMN current_habit_streak integer DEFAULT 0,
ADD COLUMN longest_habit_streak integer DEFAULT 0;