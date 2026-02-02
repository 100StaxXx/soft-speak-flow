-- Add recurrence_end_date column to daily_tasks table
ALTER TABLE public.daily_tasks 
ADD COLUMN recurrence_end_date date DEFAULT NULL;