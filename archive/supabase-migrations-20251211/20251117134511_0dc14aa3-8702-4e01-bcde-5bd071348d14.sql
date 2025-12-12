-- Add color consistency fields to user_companion table
ALTER TABLE user_companion 
ADD COLUMN IF NOT EXISTS eye_color text,
ADD COLUMN IF NOT EXISTS fur_color text;

-- Update existing companions with default values based on their favorite color
UPDATE user_companion
SET 
  eye_color = COALESCE(eye_color, 'glowing ' || favorite_color),
  fur_color = COALESCE(fur_color, favorite_color)
WHERE eye_color IS NULL OR fur_color IS NULL;