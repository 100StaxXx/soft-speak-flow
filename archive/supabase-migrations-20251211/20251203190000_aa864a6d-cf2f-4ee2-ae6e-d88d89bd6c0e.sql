-- Create table for quiz feedback on cosmic deep dives
CREATE TABLE public.cosmic_deep_dive_feedback (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  placement TEXT NOT NULL,
  sign TEXT NOT NULL,
  resonates BOOLEAN NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.cosmic_deep_dive_feedback ENABLE ROW LEVEL SECURITY;

-- Users can insert their own feedback
CREATE POLICY "Users can insert own feedback"
ON public.cosmic_deep_dive_feedback
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Users can view their own feedback
CREATE POLICY "Users can view own feedback"
ON public.cosmic_deep_dive_feedback
FOR SELECT
USING (auth.uid() = user_id);

-- Create index for lookups
CREATE INDEX idx_cosmic_feedback_user_placement ON public.cosmic_deep_dive_feedback(user_id, placement, sign);