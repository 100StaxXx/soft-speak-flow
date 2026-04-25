CREATE OR REPLACE FUNCTION public.increment_task_actual_time_spent(
  p_task_id UUID,
  p_delta INTEGER
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_new_total INTEGER;
BEGIN
  IF p_task_id IS NULL THEN
    RAISE EXCEPTION 'p_task_id is required' USING ERRCODE = '22023';
  END IF;

  IF p_delta IS NULL OR p_delta <= 0 THEN
    RAISE EXCEPTION 'p_delta must be a positive integer' USING ERRCODE = '22023';
  END IF;

  UPDATE public.daily_tasks
  SET actual_time_spent = COALESCE(actual_time_spent, 0) + p_delta
  WHERE id = p_task_id
    AND user_id = auth.uid()
  RETURNING actual_time_spent INTO v_new_total;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Task not found or not owned by current user' USING ERRCODE = 'P0002';
  END IF;

  RETURN v_new_total;
END;
$$;

REVOKE ALL ON FUNCTION public.increment_task_actual_time_spent(UUID, INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.increment_task_actual_time_spent(UUID, INTEGER) TO authenticated;

CREATE OR REPLACE FUNCTION public.complete_focus_session_with_task_actual_time(
  p_session_id UUID,
  p_actual_duration INTEGER,
  p_distractions_count INTEGER,
  p_xp_earned INTEGER
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_session public.focus_sessions%ROWTYPE;
  v_was_already_completed BOOLEAN := FALSE;
BEGIN
  IF p_session_id IS NULL THEN
    RAISE EXCEPTION 'p_session_id is required' USING ERRCODE = '22023';
  END IF;

  IF p_actual_duration IS NULL OR p_actual_duration <= 0 THEN
    RAISE EXCEPTION 'p_actual_duration must be a positive integer' USING ERRCODE = '22023';
  END IF;

  SELECT *
  INTO v_session
  FROM public.focus_sessions
  WHERE id = p_session_id
    AND user_id = auth.uid()
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Focus session not found or not owned by current user' USING ERRCODE = 'P0002';
  END IF;

  v_was_already_completed := v_session.status IS NOT DISTINCT FROM 'completed';

  IF NOT v_was_already_completed THEN
    UPDATE public.focus_sessions
    SET
      status = 'completed',
      completed_at = NOW(),
      actual_duration = p_actual_duration,
      distractions_count = p_distractions_count,
      xp_earned = p_xp_earned
    WHERE id = p_session_id
      AND user_id = auth.uid()
    RETURNING * INTO v_session;

    IF v_session.task_id IS NOT NULL THEN
      UPDATE public.daily_tasks
      SET actual_time_spent = COALESCE(actual_time_spent, 0) + p_actual_duration
      WHERE id = v_session.task_id
        AND user_id = auth.uid();
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'session', to_jsonb(v_session),
    'wasAlreadyCompleted', v_was_already_completed
  );
END;
$$;

REVOKE ALL ON FUNCTION public.complete_focus_session_with_task_actual_time(UUID, INTEGER, INTEGER, INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.complete_focus_session_with_task_actual_time(UUID, INTEGER, INTEGER, INTEGER) TO authenticated;
