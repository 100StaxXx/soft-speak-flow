-- Graceward's primary experience is one morning Daily Grace delivery and one
-- optional evening examen. Legacy granular reminders remain available as an
-- explicit opt-in, but are no longer enabled by default.

ALTER TABLE public.profiles
  ALTER COLUMN daily_quote_push_enabled SET DEFAULT false,
  ALTER COLUMN habit_reminders_enabled SET DEFAULT false,
  ALTER COLUMN task_reminders_enabled SET DEFAULT false,
  ALTER COLUMN checkin_reminders_enabled SET DEFAULT true;

UPDATE public.profiles
SET
  daily_quote_push_enabled = false,
  habit_reminders_enabled = false,
  task_reminders_enabled = false
WHERE
  daily_quote_push_enabled IS DISTINCT FROM false
  OR habit_reminders_enabled IS DISTINCT FROM false
  OR task_reminders_enabled IS DISTINCT FROM false;

-- Do not let already-enqueued legacy extras arrive after the simplified
-- preference model becomes active.
UPDATE public.push_notification_queue
SET
  status = 'skipped_disabled',
  last_error = 'Disabled by Graceward simplified delivery migration'
WHERE status IN ('queued', 'retry')
  AND notification_type IN (
    'daily_quote',
    'habit_reminder',
    'task_start',
    'task_reminder',
    'plan_day_overdue',
    'checkin_morning_reminder'
  );

-- A Faithful Step belongs to a day without needing an agenda time. It is kept
-- in daily_tasks so existing offline sync, completion, widgets, and history all
-- continue to work.
ALTER TABLE public.daily_tasks
  DROP CONSTRAINT IF EXISTS daily_tasks_source_check;

ALTER TABLE public.daily_tasks
  ADD CONSTRAINT daily_tasks_source_check
  CHECK (
    source = ANY (
      ARRAY[
        'manual',
        'voice',
        'nlp',
        'inbox',
        'recurring',
        'onboarding',
        'plan_my_day',
        'outlook_sync',
        'faithful_step'
      ]
    )
  );

ALTER TABLE public.daily_tasks
  DROP CONSTRAINT IF EXISTS daily_tasks_regular_requires_time_or_inbox;

ALTER TABLE public.daily_tasks
  ADD CONSTRAINT daily_tasks_regular_requires_time_or_inbox
  CHECK (
    habit_source_id IS NOT NULL
    OR task_date IS NULL
    OR scheduled_time IS NOT NULL
    OR source IN ('outlook_sync', 'faithful_step')
  );

COMMENT ON COLUMN public.daily_tasks.source IS
  'Creation surface. faithful_step stores the single date-only response surfaced on Today.';
