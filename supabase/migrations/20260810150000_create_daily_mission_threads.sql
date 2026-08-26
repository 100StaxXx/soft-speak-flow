BEGIN;

CREATE TABLE IF NOT EXISTS public.daily_mission_threads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  mission_date date NOT NULL,
  intention_key text NOT NULL CHECK (intention_key IN ('finish', 'progress', 'recover')),
  intention_label text NOT NULL CHECK (char_length(intention_label) BETWEEN 1 AND 80),
  primary_task_id uuid REFERENCES public.daily_tasks(id) ON DELETE SET NULL,
  primary_task_title text NOT NULL CHECK (char_length(primary_task_title) BETWEEN 1 AND 240),
  primary_task_duration_minutes integer CHECK (
    primary_task_duration_minutes IS NULL
    OR primary_task_duration_minutes BETWEEN 5 AND 480
  ),
  optional_task_ids uuid[] NOT NULL DEFAULT '{}'::uuid[]
    CHECK (cardinality(optional_task_ids) <= 2),
  optional_task_titles text[] NOT NULL DEFAULT '{}'::text[]
    CHECK (cardinality(optional_task_titles) <= 2),
  companion_ack text NOT NULL CHECK (char_length(companion_ack) BETWEEN 1 AND 500),
  calendar_summary text CHECK (calendar_summary IS NULL OR char_length(calendar_summary) <= 500),
  calendar_evidence jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(calendar_evidence) = 'object'),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'reflected')),
  completed_at timestamptz,
  reflection_key text CHECK (
    reflection_key IS NULL
    OR reflection_key IN ('moved_forward', 'cleared_space', 'enough_today')
  ),
  reflection_label text CHECK (reflection_label IS NULL OR char_length(reflection_label) <= 120),
  reflected_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, mission_date)
);

CREATE INDEX IF NOT EXISTS daily_mission_threads_user_date_idx
  ON public.daily_mission_threads (user_id, mission_date DESC);
CREATE INDEX IF NOT EXISTS daily_mission_threads_completed_idx
  ON public.daily_mission_threads (user_id, completed_at DESC)
  WHERE status IN ('completed', 'reflected');

ALTER TABLE public.daily_mission_threads ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own daily mission threads"
  ON public.daily_mission_threads;
CREATE POLICY "Users can view own daily mission threads"
  ON public.daily_mission_threads FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own daily mission threads"
  ON public.daily_mission_threads;
CREATE POLICY "Users can insert own daily mission threads"
  ON public.daily_mission_threads FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND (
      primary_task_id IS NULL
      OR EXISTS (
        SELECT 1 FROM public.daily_tasks task
        WHERE task.id = primary_task_id AND task.user_id = auth.uid()
      )
    )
    AND NOT EXISTS (
      SELECT 1
      FROM unnest(optional_task_ids) optional_task_id
      WHERE NOT EXISTS (
        SELECT 1 FROM public.daily_tasks task
        WHERE task.id = optional_task_id AND task.user_id = auth.uid()
      )
    )
  );

DROP POLICY IF EXISTS "Users can update own daily mission threads"
  ON public.daily_mission_threads;
CREATE POLICY "Users can update own daily mission threads"
  ON public.daily_mission_threads FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (
    auth.uid() = user_id
    AND (
      primary_task_id IS NULL
      OR EXISTS (
        SELECT 1 FROM public.daily_tasks task
        WHERE task.id = primary_task_id AND task.user_id = auth.uid()
      )
    )
    AND NOT EXISTS (
      SELECT 1
      FROM unnest(optional_task_ids) optional_task_id
      WHERE NOT EXISTS (
        SELECT 1 FROM public.daily_tasks task
        WHERE task.id = optional_task_id AND task.user_id = auth.uid()
      )
    )
  );

DROP POLICY IF EXISTS "Users can delete own daily mission threads"
  ON public.daily_mission_threads;
CREATE POLICY "Users can delete own daily mission threads"
  ON public.daily_mission_threads FOR DELETE
  USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.touch_daily_mission_thread_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS touch_daily_mission_thread_updated_at
  ON public.daily_mission_threads;
CREATE TRIGGER touch_daily_mission_thread_updated_at
  BEFORE UPDATE ON public.daily_mission_threads
  FOR EACH ROW
  EXECUTE FUNCTION public.touch_daily_mission_thread_updated_at();

COMMIT;
