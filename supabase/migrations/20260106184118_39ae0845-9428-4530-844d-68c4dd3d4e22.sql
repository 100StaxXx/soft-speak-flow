-- Create daily planning preferences table for memory system
CREATE TABLE public.daily_planning_preferences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  default_energy_level text DEFAULT 'medium',
  default_flex_hours numeric DEFAULT 6,
  default_day_shape text DEFAULT 'auto',
  wake_time time DEFAULT '07:00',
  wind_down_time time DEFAULT '21:00',
  auto_protect_streaks boolean DEFAULT true,
  preferred_work_blocks jsonb DEFAULT '[]'::jsonb,
  times_used integer DEFAULT 0,
  last_used_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.daily_planning_preferences ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view their own preferences"
ON public.daily_planning_preferences FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own preferences"
ON public.daily_planning_preferences FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own preferences"
ON public.daily_planning_preferences FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own preferences"
ON public.daily_planning_preferences FOR DELETE
USING (auth.uid() = user_id);

-- Create trigger for updated_at
CREATE TRIGGER update_daily_planning_preferences_updated_at
BEFORE UPDATE ON public.daily_planning_preferences
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();