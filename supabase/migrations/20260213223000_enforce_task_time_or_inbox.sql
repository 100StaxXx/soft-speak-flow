-- Backfill invalid regular quests: dated + no time -> Inbox
UPDATE public.daily_tasks
SET
  task_date = NULL,
  scheduled_time = NULL,
  source = 'inbox'
WHERE habit_source_id IS NULL
  AND task_date IS NOT NULL
  AND scheduled_time IS NULL;

-- Backfill invalid inbox rows: inbox should not retain time
UPDATE public.daily_tasks
SET scheduled_time = NULL
WHERE task_date IS NULL
  AND scheduled_time IS NOT NULL;

ALTER TABLE public.daily_tasks
  DROP CONSTRAINT IF EXISTS daily_tasks_regular_requires_time_or_inbox;

ALTER TABLE public.daily_tasks
  DROP CONSTRAINT IF EXISTS daily_tasks_inbox_has_no_time;

-- Constraint A:
-- Regular quests (habit_source_id IS NULL) must be either:
-- 1) dated + timed, or
-- 2) inbox (task_date IS NULL)
ALTER TABLE public.daily_tasks
  ADD CONSTRAINT daily_tasks_regular_requires_time_or_inbox
  CHECK (
    habit_source_id IS NOT NULL
    OR task_date IS NULL
    OR scheduled_time IS NOT NULL
  );

-- Constraint B:
-- Any inbox task (task_date IS NULL) must not have a scheduled_time.
ALTER TABLE public.daily_tasks
  ADD CONSTRAINT daily_tasks_inbox_has_no_time
  CHECK (
    task_date IS NOT NULL
    OR scheduled_time IS NULL
  );

-- Verification checklist:
-- SELECT count(*) FROM public.daily_tasks
-- WHERE habit_source_id IS NULL AND task_date IS NOT NULL AND scheduled_time IS NULL;
-- SELECT count(*) FROM public.daily_tasks
-- WHERE task_date IS NULL AND scheduled_time IS NOT NULL;
