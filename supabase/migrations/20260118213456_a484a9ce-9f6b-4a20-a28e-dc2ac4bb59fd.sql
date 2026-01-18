-- Add location column to daily_tasks table
ALTER TABLE public.daily_tasks 
ADD COLUMN location TEXT DEFAULT NULL;