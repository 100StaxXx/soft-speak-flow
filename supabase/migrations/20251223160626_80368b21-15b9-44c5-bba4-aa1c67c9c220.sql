-- Create morning_briefings table to store AI-generated personalized briefings
CREATE TABLE public.morning_briefings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  briefing_date DATE NOT NULL DEFAULT CURRENT_DATE,
  mentor_id UUID REFERENCES public.mentors(id),
  content TEXT NOT NULL,
  inferred_goals JSONB DEFAULT '[]'::jsonb,
  todays_focus TEXT,
  action_prompt TEXT,
  data_snapshot JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  viewed_at TIMESTAMP WITH TIME ZONE,
  dismissed_at TIMESTAMP WITH TIME ZONE,
  CONSTRAINT unique_user_briefing_date UNIQUE (user_id, briefing_date)
);

-- Enable RLS
ALTER TABLE public.morning_briefings ENABLE ROW LEVEL SECURITY;

-- Users can only see their own briefings
CREATE POLICY "Users can view their own briefings"
ON public.morning_briefings
FOR SELECT
USING (auth.uid() = user_id);

-- Users can insert their own briefings
CREATE POLICY "Users can create their own briefings"
ON public.morning_briefings
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Users can update their own briefings (for viewed_at, dismissed_at)
CREATE POLICY "Users can update their own briefings"
ON public.morning_briefings
FOR UPDATE
USING (auth.uid() = user_id);

-- Create index for faster lookups
CREATE INDEX idx_morning_briefings_user_date ON public.morning_briefings(user_id, briefing_date DESC);