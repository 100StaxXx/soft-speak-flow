-- Create evolution thresholds table (single source of truth)
CREATE TABLE IF NOT EXISTS evolution_thresholds (
  stage INT PRIMARY KEY,
  xp_required BIGINT NOT NULL,
  stage_name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE evolution_thresholds ENABLE ROW LEVEL SECURITY;

-- Public read access (all users can see thresholds)
CREATE POLICY "Anyone can view evolution thresholds"
  ON evolution_thresholds
  FOR SELECT
  TO authenticated
  USING (true);

-- Insert the 21-stage evolution system
INSERT INTO evolution_thresholds (stage, xp_required, stage_name) VALUES
  (0, 0, 'Egg'),
  (1, 10, 'Hatchling'),
  (2, 120, 'Sproutling'),
  (3, 250, 'Cub'),
  (4, 500, 'Juvenile'),
  (5, 1200, 'Apprentice'),
  (6, 2500, 'Scout'),
  (7, 5000, 'Fledgling'),
  (8, 10000, 'Warrior'),
  (9, 20000, 'Guardian'),
  (10, 35000, 'Champion'),
  (11, 50000, 'Ascended'),
  (12, 75000, 'Vanguard'),
  (13, 100000, 'Titan'),
  (14, 150000, 'Mythic'),
  (15, 200000, 'Prime'),
  (16, 300000, 'Regal'),
  (17, 450000, 'Eternal'),
  (18, 650000, 'Transcendent'),
  (19, 1000000, 'Apex'),
  (20, 1500000, 'Ultimate')
ON CONFLICT (stage) DO NOTHING;

-- Create function to get next evolution threshold
CREATE OR REPLACE FUNCTION get_next_evolution_threshold(current_stage INT)
RETURNS BIGINT AS $$
  SELECT xp_required 
  FROM evolution_thresholds 
  WHERE stage = current_stage + 1
  LIMIT 1;
$$ LANGUAGE SQL STABLE;

-- Create function to check if user should evolve
CREATE OR REPLACE FUNCTION should_evolve(current_stage INT, current_xp BIGINT)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 
    FROM evolution_thresholds 
    WHERE stage = current_stage + 1 
      AND current_xp >= xp_required
  );
$$ LANGUAGE SQL STABLE;

-- Add comment
COMMENT ON TABLE evolution_thresholds IS 'Single source of truth for evolution XP thresholds';
