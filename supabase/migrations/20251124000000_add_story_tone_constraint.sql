-- Add constraint to validate story_tone values
-- This ensures only valid story tones can be stored

ALTER TABLE public.user_companion 
DROP CONSTRAINT IF EXISTS user_companion_story_tone_check;

ALTER TABLE public.user_companion 
ADD CONSTRAINT user_companion_story_tone_check 
CHECK (story_tone IN ('soft_gentle', 'epic_adventure', 'emotional_heartfelt', 'dark_intense', 'whimsical_playful'));

-- Add comment for documentation
COMMENT ON CONSTRAINT user_companion_story_tone_check ON public.user_companion 
IS 'Validates story_tone against allowed values from CompanionPersonalization component';
