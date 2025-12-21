-- Add mentor_story column for the longer narrative story
ALTER TABLE public.weekly_recaps 
ADD COLUMN IF NOT EXISTS mentor_story text;