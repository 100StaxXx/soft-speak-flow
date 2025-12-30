-- Add description and estimated_minutes columns to habits table
ALTER TABLE public.habits 
ADD COLUMN IF NOT EXISTS description TEXT;

ALTER TABLE public.habits 
ADD COLUMN IF NOT EXISTS estimated_minutes INTEGER;