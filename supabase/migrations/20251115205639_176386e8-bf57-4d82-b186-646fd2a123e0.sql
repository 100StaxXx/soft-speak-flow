-- Add emotional_trigger and intensity columns to quotes table
ALTER TABLE quotes 
ADD COLUMN emotional_triggers text[] DEFAULT '{}',
ADD COLUMN intensity text;

-- Add index for better query performance on emotional triggers
CREATE INDEX idx_quotes_emotional_triggers ON quotes USING GIN(emotional_triggers);

-- Add index for intensity
CREATE INDEX idx_quotes_intensity ON quotes (intensity);

-- Update existing quotes to have default values
UPDATE quotes 
SET emotional_triggers = '{}' 
WHERE emotional_triggers IS NULL;

COMMENT ON COLUMN quotes.emotional_triggers IS 'Array of emotional triggers this quote addresses (e.g., Exhausted, Self-Doubt, Frustrated)';
COMMENT ON COLUMN quotes.intensity IS 'Intensity level of the quote (gentle, moderate, intense)';