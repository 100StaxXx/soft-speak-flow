-- Add maintenance summary columns
ALTER TABLE public.user_companion
  ADD COLUMN IF NOT EXISTS last_maintenance_summary TEXT NULL,
  ADD COLUMN IF NOT EXISTS last_maintenance_at TIMESTAMPTZ NULL;

-- Fix: Only scale legacy values (≤100) to prevent double-scaling on re-run
UPDATE public.user_companion SET
  vitality   = LEAST(1000, GREATEST(100, ROUND(vitality * 10)::INTEGER)),
  wisdom     = LEAST(1000, GREATEST(100, ROUND(wisdom * 10)::INTEGER)),
  discipline = LEAST(1000, GREATEST(100, ROUND(discipline * 10)::INTEGER)),
  resolve    = LEAST(1000, GREATEST(100, ROUND(resolve * 10)::INTEGER)),
  alignment  = LEAST(1000, GREATEST(100, ROUND(alignment * 10)::INTEGER))
WHERE GREATEST(
  COALESCE(vitality, 0),
  COALESCE(wisdom, 0),
  COALESCE(discipline, 0),
  COALESCE(resolve, 0),
  COALESCE(alignment, 0)
) <= 100;

-- Seed creativity for legacy rows that still need it
UPDATE public.user_companion SET
  creativity = LEAST(1000, GREATEST(100, 300))
WHERE creativity IS NULL OR creativity = 0;