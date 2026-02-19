-- Async companion evolution jobs for reliable, resumable evolution processing.

CREATE TABLE IF NOT EXISTS public.companion_evolution_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  companion_id UUID NOT NULL REFERENCES public.user_companion(id) ON DELETE CASCADE,
  requested_stage INTEGER NOT NULL CHECK (requested_stage >= 0 AND requested_stage <= 20),
  status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'processing', 'succeeded', 'failed')),
  retry_count INTEGER NOT NULL DEFAULT 0 CHECK (retry_count >= 0),
  next_retry_at TIMESTAMPTZ,
  error_code TEXT,
  error_message TEXT,
  result_image_url TEXT,
  result_evolution_id UUID REFERENCES public.companion_evolutions(id) ON DELETE SET NULL,
  requested_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_companion_evolution_jobs_user_requested
  ON public.companion_evolution_jobs(user_id, requested_at DESC);

CREATE INDEX IF NOT EXISTS idx_companion_evolution_jobs_status_retry
  ON public.companion_evolution_jobs(status, next_retry_at, requested_at)
  WHERE status IN ('queued', 'processing');

CREATE UNIQUE INDEX IF NOT EXISTS idx_companion_evolution_jobs_active_unique
  ON public.companion_evolution_jobs(companion_id, requested_stage)
  WHERE status IN ('queued', 'processing');

ALTER TABLE public.companion_evolution_jobs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own companion evolution jobs" ON public.companion_evolution_jobs;
CREATE POLICY "Users can view own companion evolution jobs"
  ON public.companion_evolution_jobs
  FOR SELECT
  USING (auth.uid() = user_id);

DROP TRIGGER IF EXISTS update_companion_evolution_jobs_updated_at ON public.companion_evolution_jobs;
CREATE TRIGGER update_companion_evolution_jobs_updated_at
  BEFORE UPDATE ON public.companion_evolution_jobs
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

DROP FUNCTION IF EXISTS public.request_companion_evolution_job();
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
  FROM public.evolution_thresholds et
  ORDER BY et.stage DESC
  LIMIT 1;

  IF v_max_stage IS NULL THEN
    RAISE EXCEPTION 'evolution_thresholds_unavailable';
  END IF;

  SELECT *
  INTO v_active_job
  FROM public.companion_evolution_jobs
  WHERE user_id = v_user_id
    AND companion_id = v_companion.id
    AND requested_stage = v_next_stage
    AND status IN ('queued', 'processing')
  ORDER BY requested_at DESC
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

-- Cleanup duplicate stage rows before enforcing a stage uniqueness guard.
WITH ranked AS (
  SELECT
    ce.id,
    ROW_NUMBER() OVER (
      PARTITION BY ce.companion_id, ce.stage
      ORDER BY
        CASE
          WHEN EXISTS (
            SELECT 1
            FROM public.companion_evolution_cards cec
            WHERE cec.evolution_id = ce.id
          ) THEN 1
          ELSE 0
        END DESC,
        ce.evolved_at DESC,
        ce.id DESC
    ) AS rn
  FROM public.companion_evolutions ce
)
DELETE FROM public.companion_evolutions ce
USING ranked r
WHERE ce.id = r.id
  AND r.rn > 1;

CREATE UNIQUE INDEX IF NOT EXISTS idx_companion_evolutions_companion_stage_unique
  ON public.companion_evolutions(companion_id, stage);
