-- =============================================
-- 6-STAT SYSTEM MIGRATION: Add creativity, stat_mode, stats_enabled, life_status
-- =============================================

-- 1. Add creativity stat to user_companion
ALTER TABLE public.user_companion
  ADD COLUMN IF NOT EXISTS creativity INTEGER DEFAULT 300;

-- 2. Add weekly maintenance tracking columns
ALTER TABLE public.user_companion
  ADD COLUMN IF NOT EXISTS last_weekly_maintenance_date DATE NULL;

-- 3. Add stat_mode and stats_enabled to profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS stat_mode TEXT NOT NULL DEFAULT 'casual';

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS stats_enabled BOOLEAN NOT NULL DEFAULT true;

-- 4. Add life status columns to profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS life_status TEXT NOT NULL DEFAULT 'active';

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS life_status_set_at TIMESTAMPTZ NULL;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS life_status_expires_at TIMESTAMPTZ NULL;

-- 5. Seed creativity from power + connection average for existing companions
UPDATE public.user_companion 
SET creativity = LEAST(1000, GREATEST(100,
  ROUND(((COALESCE(power, 30) + COALESCE(connection, 30)) / 2) * 10)::INTEGER
))
WHERE creativity = 300 OR creativity IS NULL;

-- 6. Scale all existing stats to 1000 range (multiply by 10, clamp 100-1000)
UPDATE public.user_companion SET
  vitality   = LEAST(1000, GREATEST(100, ROUND(COALESCE(vitality, 50) * 10)::INTEGER)),
  wisdom     = LEAST(1000, GREATEST(100, ROUND(COALESCE(wisdom, 30) * 10)::INTEGER)),
  discipline = LEAST(1000, GREATEST(100, ROUND(COALESCE(discipline, 30) * 10)::INTEGER)),
  resolve    = LEAST(1000, GREATEST(100, ROUND(COALESCE(resolve, 30) * 10)::INTEGER)),
  alignment  = LEAST(1000, GREATEST(100, ROUND(COALESCE(alignment, 30) * 10)::INTEGER));

-- 7. Update defaults for new companions (300 = 30% of 1000 range)
ALTER TABLE public.user_companion
  ALTER COLUMN vitality SET DEFAULT 300,
  ALTER COLUMN wisdom SET DEFAULT 300,
  ALTER COLUMN discipline SET DEFAULT 300,
  ALTER COLUMN resolve SET DEFAULT 300,
  ALTER COLUMN creativity SET DEFAULT 300,
  ALTER COLUMN alignment SET DEFAULT 300;