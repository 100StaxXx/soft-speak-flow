-- Notifications V2: APNs-first queue pipeline with pacing and Supabase cron scheduling.

-- 1) Profile-level toggle for check-in reminders.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS checkin_reminders_enabled boolean NOT NULL DEFAULT true;

-- 2) Extend push_notification_queue for V2 dispatch semantics.
ALTER TABLE public.push_notification_queue
  ADD COLUMN IF NOT EXISTS status text,
  ADD COLUMN IF NOT EXISTS source_table text,
  ADD COLUMN IF NOT EXISTS source_id uuid,
  ADD COLUMN IF NOT EXISTS dedupe_key text,
  ADD COLUMN IF NOT EXISTS priority smallint,
  ADD COLUMN IF NOT EXISTS attempt_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS next_retry_at timestamptz,
  ADD COLUMN IF NOT EXISTS claimed_at timestamptz,
  ADD COLUMN IF NOT EXISTS claimed_by text,
  ADD COLUMN IF NOT EXISTS last_error text,
  ADD COLUMN IF NOT EXISTS payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS channel text NOT NULL DEFAULT 'apns';

UPDATE public.push_notification_queue
SET
  status = COALESCE(status, CASE WHEN COALESCE(delivered, false) THEN 'sent' ELSE 'queued' END),
  source_table = COALESCE(source_table, 'legacy'),
  source_id = COALESCE(source_id, id),
  dedupe_key = COALESCE(dedupe_key, 'legacy:' || id::text),
  priority = COALESCE(priority, 10),
  payload = COALESCE(payload, '{}'::jsonb),
  channel = COALESCE(channel, 'apns')
WHERE
  status IS NULL
  OR source_table IS NULL
  OR source_id IS NULL
  OR dedupe_key IS NULL
  OR priority IS NULL
  OR payload IS NULL
  OR channel IS NULL;

ALTER TABLE public.push_notification_queue
  ALTER COLUMN status SET DEFAULT 'queued',
  ALTER COLUMN source_table SET DEFAULT 'legacy',
  ALTER COLUMN source_id SET DEFAULT gen_random_uuid(),
  ALTER COLUMN dedupe_key SET DEFAULT ('legacy:' || gen_random_uuid()::text),
  ALTER COLUMN priority SET DEFAULT 10,
  ALTER COLUMN status SET NOT NULL,
  ALTER COLUMN source_table SET NOT NULL,
  ALTER COLUMN source_id SET NOT NULL,
  ALTER COLUMN dedupe_key SET NOT NULL,
  ALTER COLUMN priority SET NOT NULL,
  ALTER COLUMN payload SET NOT NULL,
  ALTER COLUMN channel SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'push_notification_queue_status_check'
      AND conrelid = 'public.push_notification_queue'::regclass
  ) THEN
    ALTER TABLE public.push_notification_queue
      ADD CONSTRAINT push_notification_queue_status_check
      CHECK (status IN (
        'queued',
        'processing',
        'retry',
        'sent',
        'failed_terminal',
        'shadow',
        'skipped_rollout',
        'skipped_budget'
      ));
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS idx_push_notification_queue_dedupe_key
  ON public.push_notification_queue (dedupe_key);

CREATE INDEX IF NOT EXISTS idx_push_notification_queue_status_due
  ON public.push_notification_queue (status, scheduled_for, next_retry_at, priority DESC);

-- 3) Scheduler ownership moves from GitHub Actions to Supabase cron.
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

CREATE OR REPLACE FUNCTION public.invoke_edge_function_with_service_role(
  function_name text,
  payload jsonb DEFAULT '{}'::jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  project_url text;
  service_role_key text;
  request_headers jsonb;
BEGIN
  BEGIN
    SELECT decrypted_secret
      INTO project_url
    FROM vault.decrypted_secrets
    WHERE name IN ('SUPABASE_URL', 'supabase_url')
    ORDER BY created_at DESC
    LIMIT 1;
  EXCEPTION
    WHEN undefined_table OR undefined_column THEN
      project_url := NULL;
  END;

  BEGIN
    SELECT decrypted_secret
      INTO service_role_key
    FROM vault.decrypted_secrets
    WHERE name IN ('SUPABASE_SERVICE_ROLE_KEY', 'supabase_service_role_key')
    ORDER BY created_at DESC
    LIMIT 1;
  EXCEPTION
    WHEN undefined_table OR undefined_column THEN
      service_role_key := NULL;
  END;

  project_url := COALESCE(
    project_url,
    NULLIF(current_setting('app.settings.supabase_url', true), ''),
    NULLIF(current_setting('supabase_url', true), '')
  );

  service_role_key := COALESCE(
    service_role_key,
    NULLIF(current_setting('app.settings.supabase_service_role_key', true), ''),
    NULLIF(current_setting('supabase_service_role_key', true), '')
  );

  IF project_url IS NULL OR service_role_key IS NULL THEN
    RAISE EXCEPTION 'Missing scheduler secret(s). Configure SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in vault.';
  END IF;

  request_headers := jsonb_build_object(
    'Content-Type', 'application/json',
    'Authorization', 'Bearer ' || service_role_key,
    'apikey', service_role_key
  );

  PERFORM net.http_post(
    project_url || '/functions/v1/' || function_name,
    COALESCE(payload, '{}'::jsonb),
    '{}'::jsonb,
    request_headers,
    10000
  );
END;
$$;

REVOKE ALL ON FUNCTION public.invoke_edge_function_with_service_role(text, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.invoke_edge_function_with_service_role(text, jsonb) TO postgres, service_role;

DO $$
DECLARE
  job_name text;
BEGIN
  FOREACH job_name IN ARRAY ARRAY[
    'generate-daily-mentor-pep-talks',
    'schedule-daily-mentor-pushes',
    'dispatch-daily-pushes',
    'notifications-enqueue-v2',
    'notifications-dispatch-v2'
  ]
  LOOP
    BEGIN
      PERFORM cron.unschedule(job_name)
      FROM cron.job
      WHERE cron.job.jobname = job_name;
    EXCEPTION
      WHEN undefined_table OR undefined_function THEN
        NULL;
      WHEN OTHERS THEN
        NULL;
    END;
  END LOOP;
END $$;

SELECT cron.schedule(
  'notifications-enqueue-v2',
  '* * * * *',
  $$SELECT public.invoke_edge_function_with_service_role('notifications-enqueue-v2', '{}'::jsonb);$$
)
WHERE NOT EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'notifications-enqueue-v2');

SELECT cron.schedule(
  'notifications-dispatch-v2',
  '* * * * *',
  $$SELECT public.invoke_edge_function_with_service_role('notifications-dispatch-v2', '{}'::jsonb);$$
)
WHERE NOT EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'notifications-dispatch-v2');

SELECT cron.schedule(
  'generate-daily-mentor-pep-talks',
  '1 0 * * *',
  $$SELECT public.invoke_edge_function_with_service_role('generate-daily-mentor-pep-talks', '{}'::jsonb);$$
)
WHERE NOT EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'generate-daily-mentor-pep-talks');
