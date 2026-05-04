-- Two-Image Companion Pipeline With Kling Reveal
-- 1. Adds launcher_image_url (white-bg icon) columns to user_companion
-- 2. Adds animation_video_url and friends to companion_evolutions
-- 3. Creates companion_animation_jobs queue table + RLS
-- 4. Creates the companion-animation-videos private storage bucket
-- 5. Schedules the cron drainer for process-companion-animation-job
-- 6. Adds repair_companion_visuals(uuid) RPC for one-off Aurelith-style repair

-- 1. Launcher icon columns on user_companion --------------------------------
ALTER TABLE public.user_companion
  ADD COLUMN IF NOT EXISTS launcher_image_url text,
  ADD COLUMN IF NOT EXISTS launcher_image_focal_x double precision,
  ADD COLUMN IF NOT EXISTS launcher_image_focal_y double precision,
  ADD COLUMN IF NOT EXISTS launcher_image_source_url text,
  ADD COLUMN IF NOT EXISTS launcher_image_generated_at timestamptz;

COMMENT ON COLUMN public.user_companion.launcher_image_url IS
  'White-background icon render for launcher/avatar surfaces. Derived from current_image_url.';
COMMENT ON COLUMN public.user_companion.launcher_image_source_url IS
  'The current_image_url value the launcher icon was derived from. Used for freshness checks.';

-- 2. Animation columns on companion_evolutions ------------------------------
ALTER TABLE public.companion_evolutions
  ADD COLUMN IF NOT EXISTS animation_video_url text,
  ADD COLUMN IF NOT EXISTS animation_storage_path text,
  ADD COLUMN IF NOT EXISTS animation_status text,
  ADD COLUMN IF NOT EXISTS animation_provider text,
  ADD COLUMN IF NOT EXISTS animation_provider_request_id text,
  ADD COLUMN IF NOT EXISTS animation_completed_at timestamptz,
  ADD COLUMN IF NOT EXISTS animation_error text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.constraint_column_usage
    WHERE table_schema = 'public'
      AND table_name = 'companion_evolutions'
      AND constraint_name = 'companion_evolutions_animation_status_check'
  ) THEN
    ALTER TABLE public.companion_evolutions
      ADD CONSTRAINT companion_evolutions_animation_status_check
      CHECK (animation_status IS NULL OR animation_status IN
        ('pending','processing','succeeded','failed','skipped'));
  END IF;
END $$;

-- 3. Job queue table --------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.companion_animation_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  companion_id uuid NOT NULL REFERENCES public.user_companion(id) ON DELETE CASCADE,
  evolution_id uuid REFERENCES public.companion_evolutions(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  source_image_url text NOT NULL,
  prompt text,
  provider text NOT NULL DEFAULT 'fal-kling-v3',
  provider_model text,
  provider_request_id text,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','submitted','processing','succeeded','failed','skipped')),
  attempts smallint NOT NULL DEFAULT 0,
  last_error text,
  result_video_url text,
  result_storage_path text,
  claimed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS companion_animation_jobs_drain_idx
  ON public.companion_animation_jobs (status, created_at)
  WHERE status IN ('pending','submitted','processing');

CREATE UNIQUE INDEX IF NOT EXISTS companion_animation_jobs_evolution_unique
  ON public.companion_animation_jobs (evolution_id)
  WHERE evolution_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS companion_animation_jobs_user_idx
  ON public.companion_animation_jobs (user_id, created_at DESC);

ALTER TABLE public.companion_animation_jobs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users read own animation jobs" ON public.companion_animation_jobs;
CREATE POLICY "Users read own animation jobs"
  ON public.companion_animation_jobs FOR SELECT
  USING (auth.uid() = user_id);
-- INSERT/UPDATE/DELETE: service role only (no policies = denied for end users)

CREATE TRIGGER companion_animation_jobs_set_updated_at
  BEFORE UPDATE ON public.companion_animation_jobs
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- 4. Private storage bucket for finished MP4s -------------------------------
INSERT INTO storage.buckets (id, name, public)
VALUES ('companion-animation-videos', 'companion-animation-videos', false)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Service role manages animation videos" ON storage.objects;
CREATE POLICY "Service role manages animation videos"
  ON storage.objects FOR ALL
  USING (bucket_id = 'companion-animation-videos' AND auth.role() = 'service_role')
  WITH CHECK (bucket_id = 'companion-animation-videos' AND auth.role() = 'service_role');

DROP POLICY IF EXISTS "Users read own animation videos" ON storage.objects;
CREATE POLICY "Users read own animation videos"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'companion-animation-videos'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- 5. Cron: drain queue every minute (mirrors notifications-enqueue-v2) ------
DO $$
BEGIN
  BEGIN
    PERFORM cron.unschedule('process-companion-animation-job')
    FROM cron.job
    WHERE cron.job.jobname = 'process-companion-animation-job';
  EXCEPTION
    WHEN undefined_table OR undefined_function THEN
      NULL;
    WHEN OTHERS THEN
      NULL;
  END;
END $$;

SELECT cron.schedule(
  'process-companion-animation-job',
  '* * * * *',
  $$SELECT public.invoke_edge_function_with_internal_secret(
    'process-companion-animation-job',
    '{"batchSize":4}'::jsonb
  );$$
)
WHERE NOT EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'process-companion-animation-job');

-- 6. Aurelith repair RPC ----------------------------------------------------
-- Idempotent: clears the visual fields so subsequent generate-companion-image
-- and generate-companion-launcher-image invocations rebuild from scratch.
-- Operator runs the follow-up edge-function invocations + Kling enqueue
-- INSERT manually (see plan Phase 5).
CREATE OR REPLACE FUNCTION public.repair_companion_visuals(p_companion_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.user_companion
     SET launcher_image_url = NULL,
         launcher_image_source_url = NULL,
         launcher_image_focal_x = NULL,
         launcher_image_focal_y = NULL,
         launcher_image_generated_at = NULL,
         updated_at = now()
   WHERE id = p_companion_id;

  -- Mark the most recent evolution's animation as pending again so the cron
  -- drainer re-attempts it once a fresh job row is inserted.
  UPDATE public.companion_evolutions
     SET animation_video_url = NULL,
         animation_storage_path = NULL,
         animation_status = NULL,
         animation_provider_request_id = NULL,
         animation_completed_at = NULL,
         animation_error = NULL
   WHERE id = (
     SELECT id FROM public.companion_evolutions
      WHERE companion_id = p_companion_id
      ORDER BY evolved_at DESC
      LIMIT 1
   );
END $$;

REVOKE ALL ON FUNCTION public.repair_companion_visuals(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.repair_companion_visuals(uuid) TO postgres, service_role;
