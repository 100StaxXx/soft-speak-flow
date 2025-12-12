-- Drop check constraints temporarily to allow stage shifting
ALTER TABLE companion_stories DROP CONSTRAINT IF EXISTS companion_stories_stage_check;
ALTER TABLE companion_evolution_cards DROP CONSTRAINT IF EXISTS companion_evolution_cards_evolution_stage_check;
ALTER TABLE companion_evolutions DROP CONSTRAINT IF EXISTS companion_evolutions_stage_check;
ALTER TABLE user_companion DROP CONSTRAINT IF EXISTS user_companion_current_stage_check;

-- Add 100 to all stages to move them temporarily
UPDATE user_companion SET current_stage = current_stage + 100 WHERE current_stage >= 0;
UPDATE companion_evolutions SET stage = stage + 100 WHERE stage >= 0;
UPDATE companion_evolution_cards SET evolution_stage = evolution_stage + 100 WHERE evolution_stage >= 0;
UPDATE companion_stories SET stage = stage + 100 WHERE stage >= 0;

-- Delete old stage 101 (was stage 1)
DELETE FROM companion_stories WHERE stage = 101;
DELETE FROM companion_evolution_cards WHERE evolution_stage = 101;
DELETE FROM companion_evolutions WHERE stage = 101;

-- Shift back: stage 100 stays 0, stage 102 becomes 1, stage 103 becomes 2, etc.
UPDATE user_companion SET current_stage = CASE WHEN current_stage = 100 THEN 0 ELSE current_stage - 101 END WHERE current_stage >= 100;
UPDATE companion_evolutions SET stage = CASE WHEN stage = 100 THEN 0 ELSE stage - 101 END WHERE stage >= 100;
UPDATE companion_evolution_cards SET evolution_stage = CASE WHEN evolution_stage = 100 THEN 0 ELSE evolution_stage - 101 END WHERE evolution_stage >= 100;
UPDATE companion_stories SET stage = CASE WHEN stage = 100 THEN 0 ELSE stage - 101 END WHERE stage >= 100;

-- Recreate check constraints with new max stage 20
ALTER TABLE companion_stories ADD CONSTRAINT companion_stories_stage_check CHECK (stage >= 0 AND stage <= 20);
ALTER TABLE companion_evolution_cards ADD CONSTRAINT companion_evolution_cards_evolution_stage_check CHECK (evolution_stage >= 0 AND evolution_stage <= 20);
ALTER TABLE companion_evolutions ADD CONSTRAINT companion_evolutions_stage_check CHECK (stage >= 0 AND stage <= 20);
ALTER TABLE user_companion ADD CONSTRAINT user_companion_current_stage_check CHECK (current_stage >= 0 AND current_stage <= 20);

COMMENT ON TABLE user_companion IS 'Evolution stages restructured: removed stage 1, stage 2->1, max is now 20';