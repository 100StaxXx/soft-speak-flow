-- Replace partial habit-linked daily-task index with a full unique arbiter compatible with
-- ON CONFLICT (user_id, task_date, habit_source_id).

-- Remove duplicate habit-linked rows first so the unique index can be created safely.
WITH ranked_habit_instances AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY user_id, task_date, habit_source_id
      ORDER BY created_at ASC NULLS LAST, id ASC
    ) AS row_num
  FROM public.daily_tasks
  WHERE habit_source_id IS NOT NULL
)
DELETE FROM public.daily_tasks AS dt
USING ranked_habit_instances AS ranked
WHERE dt.id = ranked.id
  AND ranked.row_num > 1;

-- Replace the legacy partial index. ON CONFLICT inference needs a non-partial arbiter.
DROP INDEX IF EXISTS public.idx_daily_tasks_habit_date_unique;

CREATE UNIQUE INDEX IF NOT EXISTS idx_daily_tasks_habit_date_unique
ON public.daily_tasks (user_id, task_date, habit_source_id);

-- Verification checklist:
-- SELECT indexname, indexdef FROM pg_indexes WHERE schemaname = 'public' AND indexname = 'idx_daily_tasks_habit_date_unique';
