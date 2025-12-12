-- Add column to store the initial Stage 0 image URL
ALTER TABLE user_companion 
ADD COLUMN IF NOT EXISTS initial_image_url TEXT;

-- Update existing companions to store their current image as initial
-- (for companions still at stage 0)
UPDATE user_companion 
SET initial_image_url = current_image_url 
WHERE current_stage = 0 AND initial_image_url IS NULL;

-- For companions that have evolved, we'll need to reconstruct from evolution records
-- Update companions with their first evolution's previous image
WITH first_evolutions AS (
  SELECT 
    companion_id,
    image_url,
    ROW_NUMBER() OVER (PARTITION BY companion_id ORDER BY stage ASC) as rn
  FROM companion_evolutions
  WHERE stage = 1
)
UPDATE user_companion uc
SET initial_image_url = COALESCE(uc.current_image_url, fe.image_url)
FROM first_evolutions fe
WHERE uc.id = fe.companion_id 
  AND fe.rn = 1 
  AND uc.current_stage > 0
  AND uc.initial_image_url IS NULL;