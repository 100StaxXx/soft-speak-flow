-- Fix stage 0 evolution cards that have incorrect evolution_id references
-- This migration ensures stage 0 cards point to the correct stage 0 evolution record

-- Step 1: Create missing stage 0 evolution records for companions that don't have them
INSERT INTO companion_evolutions (companion_id, stage, image_url, xp_at_evolution, evolved_at)
SELECT 
  uc.id as companion_id,
  0 as stage,
  uc.initial_image_url as image_url,
  0 as xp_at_evolution,
  uc.created_at as evolved_at
FROM user_companion uc
WHERE NOT EXISTS (
  SELECT 1 
  FROM companion_evolutions ce 
  WHERE ce.companion_id = uc.id 
  AND ce.stage = 0
);

-- Step 2: Update stage 0 cards to point to the correct stage 0 evolution record
-- and set their image_url from the stage 0 evolution
UPDATE companion_evolution_cards cec
SET 
  evolution_id = ce.id,
  image_url = COALESCE(ce.image_url, cec.image_url)
FROM companion_evolutions ce
WHERE cec.evolution_stage = 0
  AND ce.companion_id = cec.companion_id
  AND ce.stage = 0
  AND (cec.evolution_id != ce.id OR cec.evolution_id IS NULL);

-- Step 3: For any stage 0 cards still missing image_url, set from companion's initial_image_url
UPDATE companion_evolution_cards cec
SET image_url = uc.initial_image_url
FROM user_companion uc
WHERE cec.evolution_stage = 0
  AND cec.companion_id = uc.id
  AND cec.image_url IS NULL
  AND uc.initial_image_url IS NOT NULL;

-- Add comment explaining the fix
COMMENT ON TABLE companion_evolution_cards IS 'Stage 0 cards now correctly reference stage 0 evolution records with proper images';
