-- Add story_tone to user_companion table
ALTER TABLE user_companion
ADD COLUMN story_tone TEXT DEFAULT 'epic_adventure' NOT NULL;