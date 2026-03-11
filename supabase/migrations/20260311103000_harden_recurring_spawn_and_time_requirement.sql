-- Harden recurring spawn conflict handling and require time for recurring templates going forward.

-- Remove duplicate recurring instances so the unique index can be created safely.
WITH ranked_recurring_instances AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY user_id, task_date, parent_template_id
      ORDER BY created_at ASC NULLS LAST, id ASC
    ) AS row_num
  FROM public.daily_tasks
  WHERE parent_template_id IS NOT NULL
)
DELETE FROM public.daily_tasks AS dt
USING ranked_recurring_instances AS ranked
WHERE dt.id = ranked.id
  AND ranked.row_num > 1;

-- Ensure ON CONFLICT(user_id, task_date, parent_template_id) has a valid unique arbiter.
CREATE UNIQUE INDEX IF NOT EXISTS idx_daily_tasks_template_date_unique
ON public.daily_tasks (user_id, task_date, parent_template_id)
WHERE parent_template_id IS NOT NULL;

-- Enforce recurrence-time rule for future writes without breaking legacy rows.
ALTER TABLE public.daily_tasks
  DROP CONSTRAINT IF EXISTS daily_tasks_recurring_requires_time;

ALTER TABLE public.daily_tasks
  ADD CONSTRAINT daily_tasks_recurring_requires_time
  CHECK (
    COALESCE(is_recurring, false) = false
    OR recurrence_pattern IS NULL
    OR scheduled_time IS NOT NULL
  ) NOT VALID;

-- Verification checklist:
-- SELECT indexname FROM pg_indexes WHERE schemaname = 'public' AND indexname = 'idx_daily_tasks_template_date_unique';
-- SELECT conname, convalidated FROM pg_constraint WHERE conname = 'daily_tasks_recurring_requires_time';
