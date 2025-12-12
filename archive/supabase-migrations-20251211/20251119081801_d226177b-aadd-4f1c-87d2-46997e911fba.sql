-- Migrate companion attributes to Mind/Body/Soul system
-- Rename columns in user_companion table
ALTER TABLE user_companion 
  RENAME COLUMN energy TO body;

ALTER TABLE user_companion 
  RENAME COLUMN focus TO mind;

ALTER TABLE user_companion 
  RENAME COLUMN balance TO soul;

-- Merge resilience into soul (average the values where both exist)
UPDATE user_companion 
SET soul = LEAST(100, COALESCE(soul, 0) + COALESCE(resilience, 0) / 2)
WHERE resilience IS NOT NULL;

-- Drop resilience column
ALTER TABLE user_companion 
  DROP COLUMN IF EXISTS resilience;

-- Update column comments for clarity
COMMENT ON COLUMN user_companion.body IS 'Physical energy, movement, and action (0-100)';
COMMENT ON COLUMN user_companion.mind IS 'Mental focus, clarity, and productivity (0-100)';
COMMENT ON COLUMN user_companion.soul IS 'Inner peace, emotional balance, and resilience (0-100)';