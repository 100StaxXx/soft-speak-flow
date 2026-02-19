-- Hotfix ambiguous identifier usage in request_companion_evolution_job.
-- Fully qualify job-table columns so PL/pgSQL output variables do not conflict.

CREATE OR REPLACE FUNCTION public.request_companion_evolution_job()
RETURNS TABLE(job_id UUID, status TEXT, requested_stage INTEGER)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_user_id UUID := auth.uid();
  v_companion public.user_companion%ROWTYPE;
  v_next_stage INTEGER;
  v_max_stage INTEGER;
  v_active_job public.companion_evolution_jobs%ROWTYPE;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  PERFORM pg_advisory_xact_lock(
    hashtext(v_user_id::text),
    hashtext('companion_evolution_job')
  );

  SELECT *
  INTO v_companion
  FROM public.user_companion
  WHERE user_id = v_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'companion_not_found';
  END IF;

  v_next_stage := v_companion.current_stage + 1;

  SELECT et.stage
  INTO v_max_stage
  FROM public.evolution_thresholds AS et
  ORDER BY et.stage DESC
  LIMIT 1;

  IF v_max_stage IS NULL THEN
    RAISE EXCEPTION 'evolution_thresholds_unavailable';
  END IF;

  SELECT *
  INTO v_active_job
  FROM public.companion_evolution_jobs AS cej
  WHERE cej.user_id = v_user_id
    AND cej.companion_id = v_companion.id
    AND cej.requested_stage = v_next_stage
    AND cej.status IN ('queued', 'processing')
  ORDER BY cej.requested_at DESC
  LIMIT 1;

  IF FOUND THEN
    RETURN QUERY SELECT v_active_job.id, v_active_job.status, v_active_job.requested_stage;
    RETURN;
  END IF;

  IF v_companion.current_stage >= v_max_stage THEN
    RAISE EXCEPTION 'max_stage_reached';
  END IF;

  IF NOT public.should_evolve(v_companion.current_stage, v_companion.current_xp) THEN
    RAISE EXCEPTION 'not_enough_xp';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.companion_evolutions AS ce
    WHERE ce.companion_id = v_companion.id
      AND ce.stage = v_next_stage
  ) THEN
    RAISE EXCEPTION 'already_evolved';
  END IF;

  INSERT INTO public.companion_evolution_jobs AS cej (
    user_id,
    companion_id,
    requested_stage,
    status,
    requested_at
  )
  VALUES (
    v_user_id,
    v_companion.id,
    v_next_stage,
    'queued',
    now()
  )
  RETURNING
    cej.id,
    cej.status,
    cej.requested_stage
  INTO job_id, status, requested_stage;

  RETURN NEXT;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.request_companion_evolution_job() TO authenticated;
