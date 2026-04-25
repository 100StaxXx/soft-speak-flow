-- Planner Contract v1 foundations:
-- - first-class planner event memory
-- - minimal task metadata for scheduling validation and model context

ALTER TABLE public.daily_tasks
  ADD COLUMN IF NOT EXISTS flexibility text NOT NULL DEFAULT 'flexible',
  ADD COLUMN IF NOT EXISTS energy_type text,
  ADD COLUMN IF NOT EXISTS must_calendar_block boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS deadline_at timestamp with time zone;

ALTER TABLE public.daily_tasks
  DROP CONSTRAINT IF EXISTS daily_tasks_flexibility_check;

ALTER TABLE public.daily_tasks
  ADD CONSTRAINT daily_tasks_flexibility_check
  CHECK (flexibility IN ('fixed', 'preferred', 'flexible'));

ALTER TABLE public.daily_tasks
  DROP CONSTRAINT IF EXISTS daily_tasks_energy_type_check;

ALTER TABLE public.daily_tasks
  ADD CONSTRAINT daily_tasks_energy_type_check
  CHECK (
    energy_type IS NULL OR
    energy_type IN ('deep', 'admin', 'physical', 'errand', 'social', 'creative', 'recovery')
  );

CREATE INDEX IF NOT EXISTS idx_daily_tasks_deadline_at
  ON public.daily_tasks(user_id, deadline_at)
  WHERE deadline_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_daily_tasks_planner_metadata
  ON public.daily_tasks(user_id, task_date, flexibility, energy_type)
  WHERE completed = false;

CREATE TABLE IF NOT EXISTS public.planner_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  event_type text NOT NULL,
  source text NOT NULL DEFAULT 'companion_planner',
  planner_session_id text,
  proposal_id text,
  task_id uuid REFERENCES public.daily_tasks(id) ON DELETE SET NULL,
  epic_id uuid REFERENCES public.epics(id) ON DELETE SET NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  occurred_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.planner_events ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.planner_events
  DROP CONSTRAINT IF EXISTS planner_events_event_type_check;

ALTER TABLE public.planner_events
  ADD CONSTRAINT planner_events_event_type_check
  CHECK (
    event_type IN (
      'plan_requested',
      'briefing_requested',
      'suggestion_generated',
      'proposal_generated',
      'proposal_confirmed',
      'proposal_rejected',
      'proposal_modified',
      'task_completed',
      'task_skipped',
      'task_moved',
      'duration_observed',
      'clarification_requested',
      'schedule_validation_failed'
    )
  );

DROP POLICY IF EXISTS "Users can view their own planner events"
  ON public.planner_events;
CREATE POLICY "Users can view their own planner events"
  ON public.planner_events
  FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can create their own planner events"
  ON public.planner_events;
CREATE POLICY "Users can create their own planner events"
  ON public.planner_events
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own planner events"
  ON public.planner_events;
CREATE POLICY "Users can update their own planner events"
  ON public.planner_events
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own planner events"
  ON public.planner_events;
CREATE POLICY "Users can delete their own planner events"
  ON public.planner_events
  FOR DELETE
  USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_planner_events_user_time
  ON public.planner_events(user_id, occurred_at DESC);

CREATE INDEX IF NOT EXISTS idx_planner_events_user_type_time
  ON public.planner_events(user_id, event_type, occurred_at DESC);

CREATE INDEX IF NOT EXISTS idx_planner_events_proposal
  ON public.planner_events(user_id, proposal_id)
  WHERE proposal_id IS NOT NULL;
