-- Add topic_category and emotional_triggers columns to pep_talks
ALTER TABLE pep_talks 
ADD COLUMN IF NOT EXISTS topic_category TEXT,
ADD COLUMN IF NOT EXISTS emotional_triggers TEXT[] DEFAULT '{}';

-- Migrate existing category data to topic_category (lowercase)
UPDATE pep_talks 
SET topic_category = LOWER(category)
WHERE topic_category IS NULL AND category IS NOT NULL;

-- Add comments for documentation
COMMENT ON COLUMN pep_talks.topic_category IS 'Area of life: discipline, confidence, physique, focus, mindset, business';
COMMENT ON COLUMN pep_talks.emotional_triggers IS 'Array of emotional states from 12 defined triggers';