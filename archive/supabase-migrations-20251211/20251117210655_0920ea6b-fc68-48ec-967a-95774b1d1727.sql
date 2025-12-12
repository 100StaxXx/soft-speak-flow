-- Add difficulty column to daily_tasks
ALTER TABLE public.daily_tasks 
ADD COLUMN difficulty TEXT DEFAULT 'medium' CHECK (difficulty IN ('easy', 'medium', 'hard'));