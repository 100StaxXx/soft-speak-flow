-- Create evolution_thresholds table
CREATE TABLE IF NOT EXISTS public.evolution_thresholds (
  stage INTEGER PRIMARY KEY,
  xp_required INTEGER NOT NULL,
  stage_name TEXT NOT NULL
);

-- Enable RLS
ALTER TABLE public.evolution_thresholds ENABLE ROW LEVEL SECURITY;

-- Allow anyone to read thresholds (they're public game data)
DROP POLICY IF EXISTS "Anyone can view evolution thresholds" ON public.evolution_thresholds;
CREATE POLICY "Anyone can view evolution thresholds"
  ON public.evolution_thresholds
  FOR SELECT
  USING (true);

-- Only admins can modify thresholds
DROP POLICY IF EXISTS "Admins can manage evolution thresholds" ON public.evolution_thresholds;
CREATE POLICY "Admins can manage evolution thresholds"
  ON public.evolution_thresholds
  FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Seed with the 21 stages (0-20) based on xpSystem.ts
INSERT INTO public.evolution_thresholds (stage, xp_required, stage_name) VALUES
  (0, 0, 'Egg'),
  (1, 100, 'Hatchling'),
  (2, 250, 'Sproutling'),
  (3, 450, 'Cub'),
  (4, 700, 'Juvenile'),
  (5, 1000, 'Apprentice'),
  (6, 1400, 'Scout'),
  (7, 1900, 'Fledgling'),
  (8, 2500, 'Warrior'),
  (9, 3200, 'Guardian'),
  (10, 4000, 'Champion'),
  (11, 5000, 'Ascended'),
  (12, 6200, 'Vanguard'),
  (13, 7600, 'Titan'),
  (14, 9200, 'Mythic'),
  (15, 11000, 'Prime'),
  (16, 13200, 'Regal'),
  (17, 15800, 'Eternal'),
  (18, 18800, 'Transcendent'),
  (19, 22200, 'Apex'),
  (20, 26000, 'Ultimate Form')
ON CONFLICT (stage) DO NOTHING;

-- Add helper functions
CREATE OR REPLACE FUNCTION public.get_next_evolution_threshold(current_stage INTEGER)
RETURNS INTEGER
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT xp_required FROM evolution_thresholds WHERE stage = current_stage + 1;
$$;

CREATE OR REPLACE FUNCTION public.should_evolve(current_stage INTEGER, current_xp INTEGER)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT current_xp >= COALESCE((SELECT xp_required FROM evolution_thresholds WHERE stage = current_stage + 1), 999999);
$$;
