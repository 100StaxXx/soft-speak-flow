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
        'outlook_sync'
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
    OR source = 'outlook_sync'
  );
