-- Add next_encounter_quest_count to profiles for random encounter timing
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS next_encounter_quest_count integer;