-- Remove deprecated task-level energy classification.
-- Planner/session energy fields remain in their own tables.

DROP INDEX IF EXISTS public.idx_daily_tasks_energy_level;

ALTER TABLE public.daily_tasks
DROP COLUMN IF EXISTS energy_level;
