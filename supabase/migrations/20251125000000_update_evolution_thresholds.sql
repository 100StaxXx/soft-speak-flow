-- Update evolution thresholds to rebalanced values
-- This updates the XP requirements to make Stage 20 achievable in 8-10 months
-- instead of multiple years, while maintaining a satisfying progression curve.

-- Update all thresholds with the new balanced values
UPDATE evolution_thresholds SET xp_required = 0 WHERE stage = 0;      -- Egg
UPDATE evolution_thresholds SET xp_required = 10 WHERE stage = 1;     -- Hatchling
UPDATE evolution_thresholds SET xp_required = 100 WHERE stage = 2;    -- Sproutling
UPDATE evolution_thresholds SET xp_required = 250 WHERE stage = 3;    -- Cub
UPDATE evolution_thresholds SET xp_required = 450 WHERE stage = 4;    -- Juvenile
UPDATE evolution_thresholds SET xp_required = 800 WHERE stage = 5;    -- Apprentice
UPDATE evolution_thresholds SET xp_required = 1300 WHERE stage = 6;   -- Scout
UPDATE evolution_thresholds SET xp_required = 2000 WHERE stage = 7;   -- Fledgling
UPDATE evolution_thresholds SET xp_required = 2900 WHERE stage = 8;   -- Warrior
UPDATE evolution_thresholds SET xp_required = 4000 WHERE stage = 9;   -- Guardian
UPDATE evolution_thresholds SET xp_required = 5400 WHERE stage = 10;  -- Champion
UPDATE evolution_thresholds SET xp_required = 7100 WHERE stage = 11;  -- Ascended
UPDATE evolution_thresholds SET xp_required = 9100 WHERE stage = 12;  -- Vanguard
UPDATE evolution_thresholds SET xp_required = 11400 WHERE stage = 13; -- Titan
UPDATE evolution_thresholds SET xp_required = 14000 WHERE stage = 14; -- Mythic
UPDATE evolution_thresholds SET xp_required = 17000 WHERE stage = 15; -- Prime
UPDATE evolution_thresholds SET xp_required = 20400 WHERE stage = 16; -- Regal
UPDATE evolution_thresholds SET xp_required = 24200 WHERE stage = 17; -- Eternal
UPDATE evolution_thresholds SET xp_required = 28400 WHERE stage = 18; -- Transcendent
UPDATE evolution_thresholds SET xp_required = 33000 WHERE stage = 19; -- Apex
UPDATE evolution_thresholds SET xp_required = 38000 WHERE stage = 20; -- Ultimate

-- Add comment explaining the rebalancing
COMMENT ON TABLE evolution_thresholds IS 'Evolution XP thresholds rebalanced on 2025-11-25. Stage 20 (Ultimate) now requires 38K XP instead of 1.5M, making it achievable in 8-10 months with consistent play (~150 XP/day average).';
