-- Keep manual companion evolution aligned to visual-boundary stages.
-- The boundary-only migration updated award/read helpers, but the queued
-- evolution request RPC still targeted current_stage + 1. That let production
-- create non-visual stages like 2/3/4, which the released client does not
-- present as evolution moments.

CREATE OR REPLACE FUNCTION public.get_highest_valid_claimed_companion_stage(
  p_companion_id UUID
)
RETURNS INTEGER
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $function$
  SELECT COALESCE(MAX(ce.stage), 0)::INTEGER
  FROM public.companion_evolutions ce
  LEFT JOIN public.evolution_thresholds et
    ON et.stage = ce.stage
  WHERE ce.companion_id = p_companion_id
    AND public.is_companion_visual_boundary_stage(ce.stage)
    AND (
      ce.stage = 0
      OR (
        et.stage IS NOT NULL
        AND COALESCE(ce.xp_at_evolution, -1) >= et.xp_required
      )
    );
$function$;

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

  v_next_stage := public.get_next_visual_evolution_stage(v_companion.current_stage);

  IF v_next_stage IS NULL THEN
    RAISE EXCEPTION 'max_stage_reached';
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

  IF NOT public.should_evolve(v_companion.current_stage, v_companion.current_xp) THEN
    RAISE EXCEPTION 'not_enough_xp';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.companion_evolutions ce
    WHERE ce.companion_id = v_companion.id
      AND ce.stage = v_next_stage
  ) THEN
    RAISE EXCEPTION 'already_evolved';
  END IF;

  INSERT INTO public.companion_evolution_jobs (
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
    id,
    companion_evolution_jobs.status,
    companion_evolution_jobs.requested_stage
  INTO job_id, status, requested_stage;

  RETURN NEXT;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.request_companion_evolution_job() TO authenticated;

COMMENT ON FUNCTION public.request_companion_evolution_job()
IS 'Queues the next unclaimed visual-boundary companion evolution stage for the authenticated user.';

-- Clear stale tutorial evolution flags for established profiles. These flags
-- are client progress hints, and should not survive after onboarding completed.
UPDATE public.profiles
SET
  onboarding_data = jsonb_set(
    COALESCE(onboarding_data, '{}'::jsonb),
    '{guided_tutorial,evolutionInFlight}',
    'false'::jsonb,
    true
  ),
  updated_at = now()
WHERE onboarding_step = 'complete'
  AND onboarding_data #>> '{guided_tutorial,evolutionInFlight}' = 'true';

-- Do not hydrate old reveals on launch. If a reveal has been ready for more
-- than a few minutes and was never marked presented, skip it so startup can
-- recover cleanly.
UPDATE public.companion_evolutions
SET animation_presented_at = now()
WHERE animation_presented_at IS NULL
  AND animation_status = 'succeeded'
  AND animation_video_url IS NOT NULL
  AND COALESCE(evolved_at, animation_completed_at, now()) < now() - INTERVAL '5 minutes';

UPDATE public.companion_evolutions
SET animation_presented_at = now()
WHERE animation_presented_at IS NULL
  AND stage > 0
  AND NOT public.is_companion_visual_boundary_stage(stage)
  AND animation_status IN ('succeeded', 'skipped', 'failed');

-- Bring companions accidentally advanced to non-visual stages back to the
-- latest visual boundary they had actually crossed.
WITH targets AS (
  SELECT
    uc.id,
    boundary.target_stage,
    COALESCE(
      stage_image.image_url,
      CASE WHEN boundary.target_stage = 0 THEN uc.initial_image_url END,
      uc.current_image_url
    ) AS target_image_url
  FROM public.user_companion uc
  CROSS JOIN LATERAL (
    SELECT COALESCE(MAX(et.stage), 0)::INTEGER AS target_stage
    FROM public.evolution_thresholds et
    WHERE et.stage <= GREATEST(COALESCE(uc.current_stage, 0), 0)
      AND public.is_companion_visual_boundary_stage(et.stage)
  ) boundary
  LEFT JOIN LATERAL (
    SELECT ce.image_url
    FROM public.companion_evolutions ce
    WHERE ce.companion_id = uc.id
      AND ce.stage = boundary.target_stage
      AND ce.image_url IS NOT NULL
      AND btrim(ce.image_url) <> ''
    ORDER BY ce.evolved_at DESC NULLS LAST, ce.id DESC
    LIMIT 1
  ) stage_image ON TRUE
  WHERE NOT public.is_companion_visual_boundary_stage(uc.current_stage)
)
UPDATE public.user_companion uc
SET
  current_stage = targets.target_stage,
  current_image_url = COALESCE(targets.target_image_url, uc.current_image_url),
  current_image_focal_x = CASE
    WHEN COALESCE(targets.target_image_url, uc.current_image_url) IS DISTINCT FROM uc.current_image_url
      THEN NULL
    ELSE uc.current_image_focal_x
  END,
  current_image_focal_y = CASE
    WHEN COALESCE(targets.target_image_url, uc.current_image_url) IS DISTINCT FROM uc.current_image_url
      THEN NULL
    ELSE uc.current_image_focal_y
  END,
  updated_at = now()
FROM targets
WHERE uc.id = targets.id;
