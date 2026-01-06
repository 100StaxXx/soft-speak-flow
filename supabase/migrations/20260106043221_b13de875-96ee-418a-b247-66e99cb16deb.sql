-- Add column to control whether completed tasks stay in place or move to bottom
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS completed_tasks_stay_in_place BOOLEAN DEFAULT true;