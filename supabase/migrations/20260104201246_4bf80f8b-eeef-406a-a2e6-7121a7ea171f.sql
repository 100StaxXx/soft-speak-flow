ALTER TABLE user_ai_learning
ADD COLUMN IF NOT EXISTS engagement_hours integer[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS energy_by_hour jsonb DEFAULT '{}'::jsonb,
ADD COLUMN IF NOT EXISTS overwhelm_signals integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS work_style_signals jsonb DEFAULT '[]'::jsonb;