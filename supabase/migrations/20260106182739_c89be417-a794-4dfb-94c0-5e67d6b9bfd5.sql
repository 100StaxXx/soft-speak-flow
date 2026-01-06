-- Add block_type and is_anchor columns to daily_tasks
ALTER TABLE public.daily_tasks 
ADD COLUMN IF NOT EXISTS block_type text,
ADD COLUMN IF NOT EXISTS is_anchor boolean DEFAULT false;

-- Create daily_plan_sessions table to track planning sessions
CREATE TABLE IF NOT EXISTS public.daily_plan_sessions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  plan_date date NOT NULL,
  energy_level text,
  flex_time_hours numeric,
  protected_habits jsonb DEFAULT '[]'::jsonb,
  protected_epics jsonb DEFAULT '[]'::jsonb,
  day_shape text,
  generation_context jsonb,
  tasks_generated integer DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS on daily_plan_sessions
ALTER TABLE public.daily_plan_sessions ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for daily_plan_sessions
CREATE POLICY "Users can view their own plan sessions"
ON public.daily_plan_sessions
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own plan sessions"
ON public.daily_plan_sessions
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own plan sessions"
ON public.daily_plan_sessions
FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own plan sessions"
ON public.daily_plan_sessions
FOR DELETE
USING (auth.uid() = user_id);

-- Add index for faster lookups
CREATE INDEX IF NOT EXISTS idx_daily_plan_sessions_user_date 
ON public.daily_plan_sessions(user_id, plan_date);