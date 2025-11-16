-- Create mood_logs table to track user mood selections
CREATE TABLE IF NOT EXISTS public.mood_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  mood TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS mood_logs_user_created_idx ON public.mood_logs(user_id, created_at DESC);

-- Enable RLS
ALTER TABLE public.mood_logs ENABLE ROW LEVEL SECURITY;

-- Users can view their own mood logs
CREATE POLICY "Users can view own mood logs"
ON public.mood_logs
FOR SELECT
USING (auth.uid() = user_id);

-- Users can insert their own mood logs
CREATE POLICY "Users can insert own mood logs"
ON public.mood_logs
FOR INSERT
WITH CHECK (auth.uid() = user_id);