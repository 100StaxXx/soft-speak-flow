-- Change topic_category from TEXT to TEXT[] to support multiple categories
ALTER TABLE pep_talks 
ALTER COLUMN topic_category TYPE TEXT[] 
USING CASE 
  WHEN topic_category IS NULL THEN NULL
  ELSE ARRAY[topic_category]
END;

-- Add check constraint to limit to 4 categories max
ALTER TABLE pep_talks 
ADD CONSTRAINT max_four_categories 
CHECK (topic_category IS NULL OR array_length(topic_category, 1) <= 4);