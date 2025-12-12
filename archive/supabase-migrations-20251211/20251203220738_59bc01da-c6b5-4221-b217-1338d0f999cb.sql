-- Add new columns for Sun unique sections
ALTER TABLE user_cosmic_deep_dives ADD COLUMN IF NOT EXISTS core_identity TEXT;
ALTER TABLE user_cosmic_deep_dives ADD COLUMN IF NOT EXISTS life_purpose TEXT;
ALTER TABLE user_cosmic_deep_dives ADD COLUMN IF NOT EXISTS natural_strengths TEXT[];
ALTER TABLE user_cosmic_deep_dives ADD COLUMN IF NOT EXISTS growth_areas TEXT[];

-- Add new columns for Moon unique sections
ALTER TABLE user_cosmic_deep_dives ADD COLUMN IF NOT EXISTS emotional_landscape TEXT;
ALTER TABLE user_cosmic_deep_dives ADD COLUMN IF NOT EXISTS comfort_needs TEXT;
ALTER TABLE user_cosmic_deep_dives ADD COLUMN IF NOT EXISTS intuitive_gifts TEXT;
ALTER TABLE user_cosmic_deep_dives ADD COLUMN IF NOT EXISTS emotional_triggers TEXT[];

-- Add new columns for Rising unique sections
ALTER TABLE user_cosmic_deep_dives ADD COLUMN IF NOT EXISTS your_aura TEXT;
ALTER TABLE user_cosmic_deep_dives ADD COLUMN IF NOT EXISTS first_impressions TEXT;
ALTER TABLE user_cosmic_deep_dives ADD COLUMN IF NOT EXISTS social_superpowers TEXT;
ALTER TABLE user_cosmic_deep_dives ADD COLUMN IF NOT EXISTS presentation_tips TEXT[];