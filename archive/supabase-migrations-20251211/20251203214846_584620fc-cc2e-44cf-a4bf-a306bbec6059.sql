-- Add placement-specific insight columns to user_cosmic_deep_dives
ALTER TABLE public.user_cosmic_deep_dives 
ADD COLUMN IF NOT EXISTS emotional_insight text,
ADD COLUMN IF NOT EXISTS social_insight text,
ADD COLUMN IF NOT EXISTS mental_insight text,
ADD COLUMN IF NOT EXISTS action_insight text,
ADD COLUMN IF NOT EXISTS love_insight text;