CREATE TABLE public.daily_encouragement_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  daily_pep_talk_id UUID NOT NULL REFERENCES public.daily_pep_talks(id) ON DELETE CASCADE,
  first_opened_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  first_started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  last_interaction_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  listen_count INTEGER NOT NULL DEFAULT 0 CHECK (listen_count >= 0),
  max_progress REAL NOT NULL DEFAULT 0 CHECK (max_progress >= 0 AND max_progress <= 1),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT daily_encouragement_history_user_talk_unique
    UNIQUE (user_id, daily_pep_talk_id)
);

ALTER TABLE public.daily_encouragement_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own daily encouragement history"
ON public.daily_encouragement_history
FOR SELECT
TO authenticated
USING ((SELECT auth.uid()) = user_id);

CREATE POLICY "Users can insert their own daily encouragement history"
ON public.daily_encouragement_history
FOR INSERT
TO authenticated
WITH CHECK ((SELECT auth.uid()) = user_id);

CREATE POLICY "Users can update their own daily encouragement history"
ON public.daily_encouragement_history
FOR UPDATE
TO authenticated
USING ((SELECT auth.uid()) = user_id)
WITH CHECK ((SELECT auth.uid()) = user_id);

CREATE INDEX daily_encouragement_history_user_recent_idx
ON public.daily_encouragement_history (user_id, last_interaction_at DESC);

CREATE OR REPLACE FUNCTION public.record_daily_encouragement_progress(
  p_daily_pep_talk_id UUID,
  p_event TEXT DEFAULT 'opened',
  p_progress REAL DEFAULT 0
)
RETURNS public.daily_encouragement_history
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_event TEXT := lower(trim(COALESCE(p_event, 'opened')));
  v_progress REAL := LEAST(1, GREATEST(0, COALESCE(p_progress, 0)));
  v_result public.daily_encouragement_history;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501';
  END IF;

  IF v_event NOT IN ('opened', 'started', 'progress', 'completed') THEN
    RAISE EXCEPTION 'Unsupported daily encouragement event' USING ERRCODE = '22023';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.daily_pep_talks
    WHERE id = p_daily_pep_talk_id
  ) THEN
    RAISE EXCEPTION 'Daily encouragement not found' USING ERRCODE = 'P0002';
  END IF;

  IF v_event = 'completed' THEN
    v_progress := 1;
  END IF;

  INSERT INTO public.daily_encouragement_history AS history (
    user_id,
    daily_pep_talk_id,
    first_started_at,
    completed_at,
    last_interaction_at,
    listen_count,
    max_progress,
    updated_at
  )
  VALUES (
    v_user_id,
    p_daily_pep_talk_id,
    CASE WHEN v_event IN ('started', 'progress', 'completed') THEN now() ELSE NULL END,
    CASE WHEN v_event = 'completed' OR v_progress >= 0.8 THEN now() ELSE NULL END,
    now(),
    CASE WHEN v_event = 'started' THEN 1 ELSE 0 END,
    v_progress,
    now()
  )
  ON CONFLICT (user_id, daily_pep_talk_id)
  DO UPDATE SET
    first_started_at = COALESCE(
      history.first_started_at,
      CASE
        WHEN v_event IN ('started', 'progress', 'completed') THEN now()
        ELSE NULL
      END
    ),
    completed_at = COALESCE(
      history.completed_at,
      CASE
        WHEN v_event = 'completed' OR v_progress >= 0.8 THEN now()
        ELSE NULL
      END
    ),
    last_interaction_at = now(),
    listen_count = history.listen_count + CASE WHEN v_event = 'started' THEN 1 ELSE 0 END,
    max_progress = GREATEST(history.max_progress, v_progress),
    updated_at = now()
  RETURNING * INTO v_result;

  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.record_daily_encouragement_progress(UUID, TEXT, REAL) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.record_daily_encouragement_progress(UUID, TEXT, REAL) FROM anon;
GRANT EXECUTE ON FUNCTION public.record_daily_encouragement_progress(UUID, TEXT, REAL) TO authenticated;
GRANT EXECUTE ON FUNCTION public.record_daily_encouragement_progress(UUID, TEXT, REAL) TO service_role;

COMMENT ON TABLE public.daily_encouragement_history IS
  'Private per-user history for daily Guide encouragements, including opened, playback, and completion state.';

COMMENT ON FUNCTION public.record_daily_encouragement_progress(UUID, TEXT, REAL) IS
  'Atomically records private daily encouragement playback progress for the authenticated user.';
