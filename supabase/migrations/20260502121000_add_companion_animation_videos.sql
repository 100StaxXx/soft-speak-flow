-- Add optional Kling/fal-powered companion evolution reveal videos.

ALTER TABLE public.companion_evolutions
ADD COLUMN IF NOT EXISTS animation_video_url TEXT,
ADD COLUMN IF NOT EXISTS animation_storage_path TEXT,
ADD COLUMN IF NOT EXISTS animation_provider TEXT,
ADD COLUMN IF NOT EXISTS animation_provider_model TEXT,
ADD COLUMN IF NOT EXISTS animation_provider_task_id TEXT,
ADD COLUMN IF NOT EXISTS animation_status TEXT,
ADD COLUMN IF NOT EXISTS animation_prompt TEXT,
ADD COLUMN IF NOT EXISTS animation_error_code TEXT,
ADD COLUMN IF NOT EXISTS animation_error_message TEXT,
ADD COLUMN IF NOT EXISTS animation_requested_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS animation_completed_at TIMESTAMPTZ;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'companion_evolutions_animation_status_check'
      AND conrelid = 'public.companion_evolutions'::regclass
  ) THEN
    ALTER TABLE public.companion_evolutions
    ADD CONSTRAINT companion_evolutions_animation_status_check
    CHECK (
      animation_status IS NULL
      OR animation_status IN ('queued', 'processing', 'succeeded', 'failed', 'skipped')
    );
  END IF;
END;
$$;

CREATE TABLE IF NOT EXISTS public.companion_animation_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  companion_id UUID NOT NULL REFERENCES public.user_companion(id) ON DELETE CASCADE,
  evolution_id UUID NOT NULL REFERENCES public.companion_evolutions(id) ON DELETE CASCADE,
  stage INTEGER NOT NULL CHECK (stage >= 0),
  source_image_url TEXT NOT NULL,
  provider TEXT NOT NULL DEFAULT 'fal',
  provider_model TEXT NOT NULL DEFAULT 'fal-ai/kling-video/v3/standard/image-to-video',
  provider_task_id TEXT,
  provider_status TEXT,
  status TEXT NOT NULL DEFAULT 'queued'
    CHECK (status IN ('queued', 'processing', 'succeeded', 'failed')),
  prompt TEXT NOT NULL,
  video_url TEXT,
  storage_path TEXT,
  error_code TEXT,
  error_message TEXT,
  retry_count INTEGER NOT NULL DEFAULT 0 CHECK (retry_count >= 0),
  next_retry_at TIMESTAMPTZ,
  requested_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_companion_animation_jobs_evolution
  ON public.companion_animation_jobs(evolution_id);

CREATE INDEX IF NOT EXISTS idx_companion_animation_jobs_user_requested
  ON public.companion_animation_jobs(user_id, requested_at DESC);

CREATE INDEX IF NOT EXISTS idx_companion_animation_jobs_status_retry
  ON public.companion_animation_jobs(status, next_retry_at, requested_at)
  WHERE status IN ('queued', 'processing');

DROP TRIGGER IF EXISTS update_companion_animation_jobs_updated_at ON public.companion_animation_jobs;
CREATE TRIGGER update_companion_animation_jobs_updated_at
  BEFORE UPDATE ON public.companion_animation_jobs
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.companion_animation_jobs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own companion animation jobs" ON public.companion_animation_jobs;
CREATE POLICY "Users can view own companion animation jobs"
  ON public.companion_animation_jobs
  FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Service role can manage companion animation jobs" ON public.companion_animation_jobs;
CREATE POLICY "Service role can manage companion animation jobs"
  ON public.companion_animation_jobs
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

INSERT INTO storage.buckets (id, name, public)
VALUES ('companion-animation-videos', 'companion-animation-videos', true)
ON CONFLICT (id) DO UPDATE
SET public = EXCLUDED.public;

DROP POLICY IF EXISTS "Public can view companion animation videos" ON storage.objects;
CREATE POLICY "Public can view companion animation videos"
ON storage.objects FOR SELECT
USING (bucket_id = 'companion-animation-videos');

DROP POLICY IF EXISTS "Service role can manage companion animation videos" ON storage.objects;
CREATE POLICY "Service role can manage companion animation videos"
ON storage.objects FOR ALL
USING (bucket_id = 'companion-animation-videos' AND auth.role() = 'service_role')
WITH CHECK (bucket_id = 'companion-animation-videos' AND auth.role() = 'service_role');

INSERT INTO public.cost_guardrail_config (
  scope_type,
  scope_key,
  enabled,
  monthly_budget_usd,
  alert_thresholds,
  metadata
)
VALUES
  ('provider', 'fal', true, 80.00, ARRAY[50,80,90,100], '{"description":"fal.ai video generation"}'),
  ('feature', 'ai_companion_animation', true, 80.00, ARRAY[50,80,90,100], '{"description":"Companion evolution reveal video generation"}'),
  ('endpoint', 'process-companion-animation-job', true, 80.00, ARRAY[50,80,90,100], '{"risk":"critical","description":"Queued companion animation video pipeline"}')
ON CONFLICT (scope_type, scope_key) DO UPDATE
SET
  enabled = EXCLUDED.enabled,
  monthly_budget_usd = EXCLUDED.monthly_budget_usd,
  alert_thresholds = EXCLUDED.alert_thresholds,
  metadata = public.cost_guardrail_config.metadata || EXCLUDED.metadata,
  updated_at = timezone('utc', now());

DO $$
BEGIN
  BEGIN
    PERFORM cron.unschedule('process-companion-animation-job')
    FROM cron.job
    WHERE cron.job.jobname = 'process-companion-animation-job';
  EXCEPTION
    WHEN undefined_table OR undefined_function OR invalid_schema_name THEN
      NULL;
    WHEN OTHERS THEN
      NULL;
  END;

  BEGIN
    PERFORM cron.schedule(
      'process-companion-animation-job',
      '* * * * *',
      $cron$SELECT public.invoke_edge_function_with_internal_secret('process-companion-animation-job', '{}'::jsonb);$cron$
    )
    WHERE NOT EXISTS (
      SELECT 1
      FROM cron.job
      WHERE jobname = 'process-companion-animation-job'
    );
  EXCEPTION
    WHEN undefined_table OR undefined_function OR invalid_schema_name THEN
      NULL;
  END;
END $$;

WITH allowed_owned_buckets AS (
  SELECT ARRAY['companion-animation-videos']::TEXT[] AS buckets
),
backfill_rows AS (
  SELECT
    uc.user_id,
    asset.bucket_id,
    asset.storage_path,
    'companion_animation_video'::TEXT AS source_kind,
    'companion_evolutions'::TEXT AS source_record_table,
    ce.id AS source_record_id
  FROM public.companion_evolutions ce
  JOIN public.user_companion uc ON uc.id = ce.companion_id
  CROSS JOIN allowed_owned_buckets aob
  CROSS JOIN LATERAL public.extract_project_storage_asset(ce.animation_video_url, aob.buckets) asset
)
INSERT INTO public.user_storage_assets (
  user_id,
  bucket_id,
  storage_path,
  source_kind,
  source_record_table,
  source_record_id
)
SELECT
  user_id,
  bucket_id,
  storage_path,
  source_kind,
  source_record_table,
  source_record_id
FROM backfill_rows
WHERE storage_path IS NOT NULL
ON CONFLICT (bucket_id, storage_path) DO UPDATE
SET
  user_id = EXCLUDED.user_id,
  source_kind = EXCLUDED.source_kind,
  source_record_table = EXCLUDED.source_record_table,
  source_record_id = EXCLUDED.source_record_id;

CREATE OR REPLACE FUNCTION public.delete_user_account(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  caller_id uuid;
  request_role text;
  is_service boolean;
  table_record record;
  fk_record record;
BEGIN
  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'User id is required';
  END IF;

  caller_id := auth.uid();
  request_role := COALESCE(auth.jwt() ->> 'role', current_setting('request.jwt.claim.role', true), '');
  is_service := request_role = 'service_role';

  IF NOT is_service AND (caller_id IS NULL OR caller_id <> p_user_id) THEN
    RAISE EXCEPTION 'Unauthorized: You can only delete your own account';
  END IF;

  IF to_regclass('public.daily_tasks') IS NOT NULL THEN
    IF to_regclass('public.subtasks') IS NOT NULL THEN
      BEGIN
        EXECUTE
          'DELETE FROM public.subtasks
           WHERE task_id IN (
             SELECT id FROM public.daily_tasks WHERE user_id = $1
           )'
        USING p_user_id;
      EXCEPTION WHEN undefined_column OR undefined_table THEN
        NULL;
      END;
    END IF;

    IF to_regclass('public.task_dependencies') IS NOT NULL THEN
      BEGIN
        EXECUTE
          'DELETE FROM public.task_dependencies
           WHERE task_id IN (
             SELECT id FROM public.daily_tasks WHERE user_id = $1
           )'
        USING p_user_id;
      EXCEPTION WHEN undefined_column OR undefined_table THEN
        NULL;
      END;

      BEGIN
        EXECUTE
          'DELETE FROM public.task_dependencies
           WHERE depends_on_task_id IN (
             SELECT id FROM public.daily_tasks WHERE user_id = $1
           )'
        USING p_user_id;
      EXCEPTION WHEN undefined_column OR undefined_table THEN
        NULL;
      END;
    END IF;
  END IF;

  IF to_regclass('public.habits') IS NOT NULL AND to_regclass('public.epic_habits') IS NOT NULL THEN
    BEGIN
      EXECUTE
        'DELETE FROM public.epic_habits
         WHERE habit_id IN (
           SELECT id FROM public.habits WHERE user_id = $1
         )'
      USING p_user_id;
    EXCEPTION WHEN undefined_column OR undefined_table THEN
      NULL;
    END;
  END IF;

  IF to_regclass('public.user_challenges') IS NOT NULL AND to_regclass('public.challenge_progress') IS NOT NULL THEN
    BEGIN
      EXECUTE
        'DELETE FROM public.challenge_progress
         WHERE user_challenge_id IN (
           SELECT id FROM public.user_challenges WHERE user_id = $1
         )'
      USING p_user_id;
    EXCEPTION WHEN undefined_column OR undefined_table THEN
      NULL;
    END;
  END IF;

  IF to_regclass('public.playlists') IS NOT NULL AND to_regclass('public.playlist_items') IS NOT NULL THEN
    BEGIN
      EXECUTE
        'DELETE FROM public.playlist_items
         WHERE playlist_id IN (
           SELECT id FROM public.playlists WHERE user_id = $1
         )'
      USING p_user_id;
    EXCEPTION WHEN undefined_column OR undefined_table THEN
      NULL;
    END;
  END IF;

  IF to_regclass('public.referral_payouts') IS NOT NULL THEN
    BEGIN
      EXECUTE
        'DELETE FROM public.referral_payouts
         WHERE referrer_id = $1 OR referee_id = $1'
      USING p_user_id;
    EXCEPTION WHEN undefined_column THEN
      BEGIN
        EXECUTE
          'DELETE FROM public.referral_payouts
           WHERE referrer_id = $1 OR recipient_user_id = $1'
        USING p_user_id;
      EXCEPTION WHEN undefined_column THEN
        BEGIN
          EXECUTE
            'DELETE FROM public.referral_payouts
             WHERE referrer_id = $1'
          USING p_user_id;
        EXCEPTION WHEN undefined_column OR undefined_table THEN
          NULL;
        END;
      WHEN undefined_table THEN
        NULL;
      END;
    WHEN undefined_table THEN
      NULL;
    END;
  END IF;

  IF to_regclass('public.referral_codes') IS NOT NULL THEN
    BEGIN
      EXECUTE
        'DELETE FROM public.referral_codes
         WHERE owner_type = ''user'' AND owner_user_id = $1'
      USING p_user_id;
    EXCEPTION WHEN undefined_column THEN
      BEGIN
        EXECUTE
          'DELETE FROM public.referral_codes
           WHERE owner_user_id = $1'
        USING p_user_id;
      EXCEPTION WHEN undefined_column OR undefined_table THEN
        NULL;
      END;
    WHEN undefined_table THEN
      NULL;
    END;
  END IF;

  FOR table_record IN
    SELECT DISTINCT c.table_name
    FROM information_schema.columns c
    JOIN information_schema.tables t
      ON t.table_schema = c.table_schema
     AND t.table_name = c.table_name
    WHERE c.table_schema = 'public'
      AND t.table_type = 'BASE TABLE'
      AND c.column_name = 'user_id'
      AND c.table_name <> 'profiles'
    ORDER BY c.table_name
  LOOP
    BEGIN
      EXECUTE format('DELETE FROM public.%I WHERE user_id = $1', table_record.table_name)
      USING p_user_id;
    EXCEPTION WHEN OTHERS THEN
      RAISE LOG 'delete_user_account: skipping public.% due to %', table_record.table_name, SQLERRM;
    END;
  END LOOP;

  FOR table_record IN
    SELECT DISTINCT c.table_name
    FROM information_schema.columns c
    JOIN information_schema.tables t
      ON t.table_schema = c.table_schema
     AND t.table_name = c.table_name
    WHERE c.table_schema = 'public'
      AND t.table_type = 'BASE TABLE'
      AND c.column_name = 'owner_user_id'
    ORDER BY c.table_name
  LOOP
    BEGIN
      EXECUTE format('DELETE FROM public.%I WHERE owner_user_id = $1', table_record.table_name)
      USING p_user_id;
    EXCEPTION WHEN OTHERS THEN
      RAISE LOG 'delete_user_account: skipping owner_user_id cleanup for public.% due to %', table_record.table_name, SQLERRM;
    END;
  END LOOP;

  FOR fk_record IN
    SELECT
      kcu.table_schema,
      kcu.table_name,
      kcu.column_name,
      rc.delete_rule,
      cols.is_nullable
    FROM information_schema.table_constraints tc
    JOIN information_schema.referential_constraints rc
      ON tc.constraint_schema = rc.constraint_schema
     AND tc.constraint_name = rc.constraint_name
    JOIN information_schema.key_column_usage kcu
      ON tc.constraint_schema = kcu.constraint_schema
     AND tc.constraint_name = kcu.constraint_name
    JOIN information_schema.constraint_column_usage ccu
      ON tc.constraint_schema = ccu.constraint_schema
     AND tc.constraint_name = ccu.constraint_name
    JOIN information_schema.columns cols
      ON cols.table_schema = kcu.table_schema
     AND cols.table_name = kcu.table_name
     AND cols.column_name = kcu.column_name
    WHERE tc.constraint_type = 'FOREIGN KEY'
      AND kcu.table_schema = 'public'
      AND rc.delete_rule IN ('NO ACTION', 'RESTRICT')
      AND (
        (ccu.table_schema = 'public' AND ccu.table_name = 'profiles' AND ccu.column_name = 'id')
        OR
        (ccu.table_schema = 'auth' AND ccu.table_name = 'users' AND ccu.column_name = 'id')
      )
  LOOP
    BEGIN
      IF fk_record.is_nullable = 'YES' THEN
        EXECUTE format(
          'UPDATE %I.%I SET %I = NULL WHERE %I = $1',
          fk_record.table_schema,
          fk_record.table_name,
          fk_record.column_name,
          fk_record.column_name
        )
        USING p_user_id;
      ELSE
        EXECUTE format(
          'DELETE FROM %I.%I WHERE %I = $1',
          fk_record.table_schema,
          fk_record.table_name,
          fk_record.column_name
        )
        USING p_user_id;
      END IF;
    EXCEPTION WHEN OTHERS THEN
      RAISE LOG 'delete_user_account: FK cleanup skipped for %.%(%): %',
        fk_record.table_schema,
        fk_record.table_name,
        fk_record.column_name,
        SQLERRM;
    END;
  END LOOP;

  IF to_regclass('storage.objects') IS NOT NULL THEN
    BEGIN
      EXECUTE
        'DELETE FROM storage.objects
         WHERE owner = $1
            OR owner_id = $2
            OR (
              bucket_id IN (''quest-attachments'', ''mentors-avatars'', ''journey-paths'', ''companion-images'', ''companion-animation-videos'')
              AND split_part(name, ''/'', 1) = $2
            )
            OR (bucket_id = ''journey-paths'' AND name LIKE $3)
            OR (bucket_id = ''evolution-cards'' AND name LIKE $4)'
      USING
        p_user_id,
        p_user_id::text,
        'campaign-welcome/welcome-' || p_user_id::text || '-%',
        'postcards/' || p_user_id::text || '/%';
    EXCEPTION WHEN undefined_column OR undefined_table THEN
      NULL;
    END;
  END IF;

  DELETE FROM public.profiles WHERE id = p_user_id;
  DELETE FROM auth.users WHERE id = p_user_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.delete_user_account(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.delete_user_account(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.delete_user_account(uuid) TO service_role;
