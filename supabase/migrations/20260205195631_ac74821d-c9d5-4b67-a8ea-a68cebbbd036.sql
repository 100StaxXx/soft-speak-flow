-- Add 7 new stat columns to user_companion table
ALTER TABLE public.user_companion
ADD COLUMN IF NOT EXISTS vitality integer DEFAULT 50,
ADD COLUMN IF NOT EXISTS power integer DEFAULT 30,
ADD COLUMN IF NOT EXISTS wisdom integer DEFAULT 30,
ADD COLUMN IF NOT EXISTS discipline integer DEFAULT 30,
ADD COLUMN IF NOT EXISTS resolve integer DEFAULT 30,
ADD COLUMN IF NOT EXISTS connection integer DEFAULT 30,
ADD COLUMN IF NOT EXISTS alignment integer DEFAULT 30;

-- Migrate existing stats to new 7-stat system
-- body → vitality (direct mapping)
-- mind → wisdom (60%) + discipline (40%)  
-- soul → connection (40%) + alignment (60%)
-- power and resolve start at baseline 30

UPDATE public.user_companion SET
  vitality = COALESCE(body, 50),
  wisdom = GREATEST(15, FLOOR(COALESCE(mind, 0) * 0.6)),
  discipline = GREATEST(15, FLOOR(COALESCE(mind, 0) * 0.4) + 15),
  connection = GREATEST(15, FLOOR(COALESCE(soul, 0) * 0.4) + 15),
  alignment = GREATEST(15, FLOOR(COALESCE(soul, 0) * 0.6)),
  power = 30,
  resolve = 30
WHERE vitality = 50 AND power = 30 AND wisdom = 30;