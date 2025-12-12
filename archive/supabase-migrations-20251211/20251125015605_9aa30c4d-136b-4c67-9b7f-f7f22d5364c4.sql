-- Update evolution thresholds to new balanced progression
-- Stage 20 target: ~38,000 XP (achievable in 8-10 months of consistent play)
-- Fast early jumps, noticeable mid-game, long but not crazy endgame

UPDATE evolution_thresholds SET xp_required = 0 WHERE stage = 0;
UPDATE evolution_thresholds SET xp_required = 10 WHERE stage = 1;
UPDATE evolution_thresholds SET xp_required = 100 WHERE stage = 2;
UPDATE evolution_thresholds SET xp_required = 250 WHERE stage = 3;
UPDATE evolution_thresholds SET xp_required = 450 WHERE stage = 4;
UPDATE evolution_thresholds SET xp_required = 800 WHERE stage = 5;
UPDATE evolution_thresholds SET xp_required = 1300 WHERE stage = 6;
UPDATE evolution_thresholds SET xp_required = 2000 WHERE stage = 7;
UPDATE evolution_thresholds SET xp_required = 2900 WHERE stage = 8;
UPDATE evolution_thresholds SET xp_required = 4000 WHERE stage = 9;
UPDATE evolution_thresholds SET xp_required = 5400 WHERE stage = 10;
UPDATE evolution_thresholds SET xp_required = 7100 WHERE stage = 11;
UPDATE evolution_thresholds SET xp_required = 9100 WHERE stage = 12;
UPDATE evolution_thresholds SET xp_required = 11400 WHERE stage = 13;
UPDATE evolution_thresholds SET xp_required = 14000 WHERE stage = 14;
UPDATE evolution_thresholds SET xp_required = 17000 WHERE stage = 15;
UPDATE evolution_thresholds SET xp_required = 20400 WHERE stage = 16;
UPDATE evolution_thresholds SET xp_required = 24200 WHERE stage = 17;
UPDATE evolution_thresholds SET xp_required = 28400 WHERE stage = 18;
UPDATE evolution_thresholds SET xp_required = 33000 WHERE stage = 19;
UPDATE evolution_thresholds SET xp_required = 38000 WHERE stage = 20;