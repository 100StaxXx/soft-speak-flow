-- Update evolution thresholds to new 38K balanced curve
-- Designed for 8-10 month completion at 100-150 XP/day with 2x streak multiplier

-- Update all evolution thresholds with new balanced values
UPDATE evolution_thresholds SET xp_required = 0 WHERE stage = 0;
UPDATE evolution_thresholds SET xp_required = 10 WHERE stage = 1;
UPDATE evolution_thresholds SET xp_required = 100 WHERE stage = 2;
UPDATE evolution_thresholds SET xp_required = 250 WHERE stage = 3;
UPDATE evolution_thresholds SET xp_required = 450 WHERE stage = 4;
UPDATE evolution_thresholds SET xp_required = 800 WHERE stage = 5;  -- Visual evolution
UPDATE evolution_thresholds SET xp_required = 1300 WHERE stage = 6;
UPDATE evolution_thresholds SET xp_required = 2000 WHERE stage = 7;
UPDATE evolution_thresholds SET xp_required = 2900 WHERE stage = 8;
UPDATE evolution_thresholds SET xp_required = 4000 WHERE stage = 9;
UPDATE evolution_thresholds SET xp_required = 5400 WHERE stage = 10; -- Visual evolution
UPDATE evolution_thresholds SET xp_required = 7100 WHERE stage = 11;
UPDATE evolution_thresholds SET xp_required = 9100 WHERE stage = 12;
UPDATE evolution_thresholds SET xp_required = 11400 WHERE stage = 13;
UPDATE evolution_thresholds SET xp_required = 14000 WHERE stage = 14;
UPDATE evolution_thresholds SET xp_required = 17000 WHERE stage = 15; -- Visual evolution
UPDATE evolution_thresholds SET xp_required = 20400 WHERE stage = 16;
UPDATE evolution_thresholds SET xp_required = 24200 WHERE stage = 17;
UPDATE evolution_thresholds SET xp_required = 28400 WHERE stage = 18;
UPDATE evolution_thresholds SET xp_required = 33000 WHERE stage = 19;
UPDATE evolution_thresholds SET xp_required = 38000 WHERE stage = 20; -- Visual evolution (Ultimate Form)

-- Verify updates
SELECT stage, xp_required, stage_name 
FROM evolution_thresholds 
ORDER BY stage;
