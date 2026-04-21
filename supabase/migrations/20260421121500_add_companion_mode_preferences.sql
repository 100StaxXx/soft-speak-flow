ALTER TABLE public.user_ai_preferences
ADD COLUMN IF NOT EXISTS companion_mode text NOT NULL DEFAULT 'alpha',
ADD COLUMN IF NOT EXISTS companion_mode_adaptation_enabled boolean NOT NULL DEFAULT true;

ALTER TABLE public.user_ai_preferences
DROP CONSTRAINT IF EXISTS user_ai_preferences_companion_mode_check;

ALTER TABLE public.user_ai_preferences
ADD CONSTRAINT user_ai_preferences_companion_mode_check
CHECK (companion_mode IN ('alpha', 'calm', 'strategic', 'chaotic', 'mentor'));
