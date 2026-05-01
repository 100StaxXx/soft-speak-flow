-- Add multi-offset quest reminders while preserving legacy single-reminder columns.
ALTER TABLE public.daily_tasks
  ADD COLUMN IF NOT EXISTS reminder_offsets_minutes integer[] NOT NULL DEFAULT '{}'::integer[],
  ADD COLUMN IF NOT EXISTS reminder_sent_offsets_minutes integer[] NOT NULL DEFAULT '{}'::integer[];

UPDATE public.daily_tasks
SET reminder_offsets_minutes = ARRAY[
  LEAST(
    GREATEST(COALESCE(reminder_minutes_before, 15), 1),
    10080
  )
]::integer[]
WHERE COALESCE(reminder_enabled, false) = true
  AND COALESCE(array_length(reminder_offsets_minutes, 1), 0) = 0;

UPDATE public.daily_tasks
SET reminder_sent_offsets_minutes = ARRAY[
  LEAST(
    GREATEST(COALESCE(reminder_minutes_before, 15), 1),
    10080
  )
]::integer[]
WHERE COALESCE(reminder_sent, false) = true
  AND COALESCE(array_length(reminder_sent_offsets_minutes, 1), 0) = 0;

CREATE INDEX IF NOT EXISTS idx_daily_tasks_multi_reminders
ON public.daily_tasks(reminder_enabled, scheduled_time)
WHERE reminder_enabled = true AND completed = false;
