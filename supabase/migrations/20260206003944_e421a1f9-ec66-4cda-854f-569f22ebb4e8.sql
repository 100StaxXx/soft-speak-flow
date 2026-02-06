-- Reset stats for fresh companions that were incorrectly scaled
-- This fixes companions created during the migration window where body=100 was scaled to vitality=1000

UPDATE public.user_companion SET
  vitality   = 300,
  wisdom     = 300,
  discipline = 300,
  resolve    = 300,
  creativity = 300,
  alignment  = 300
WHERE current_stage = 0 
  AND current_xp < 50
  AND (vitality = 1000 OR wisdom < 200 OR discipline < 200);