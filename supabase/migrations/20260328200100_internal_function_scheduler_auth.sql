-- Replace service-role transport auth for cron-triggered edge functions with
-- a dedicated internal function secret plus a non-privileged API key.

CREATE OR REPLACE FUNCTION public.invoke_edge_function_with_internal_secret(
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
  function_api_key text;
  internal_function_secret text;
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
      INTO function_api_key
    FROM vault.decrypted_secrets
    WHERE name IN (
      'SUPABASE_PUBLISHABLE_KEY',
      'supabase_publishable_key',
      'SUPABASE_ANON_KEY',
      'supabase_anon_key'
    )
    ORDER BY created_at DESC
    LIMIT 1;
  EXCEPTION
    WHEN undefined_table OR undefined_column THEN
      function_api_key := NULL;
  END;

  BEGIN
    SELECT decrypted_secret
      INTO internal_function_secret
    FROM vault.decrypted_secrets
    WHERE name IN ('INTERNAL_FUNCTION_SECRET', 'internal_function_secret')
    ORDER BY created_at DESC
    LIMIT 1;
  EXCEPTION
    WHEN undefined_table OR undefined_column THEN
      internal_function_secret := NULL;
  END;

  project_url := COALESCE(
    project_url,
    NULLIF(current_setting('app.settings.supabase_url', true), ''),
    NULLIF(current_setting('supabase_url', true), '')
  );

  function_api_key := COALESCE(
    function_api_key,
    NULLIF(current_setting('app.settings.supabase_publishable_key', true), ''),
    NULLIF(current_setting('supabase_publishable_key', true), ''),
    NULLIF(current_setting('app.settings.supabase_anon_key', true), ''),
    NULLIF(current_setting('supabase_anon_key', true), '')
  );

  internal_function_secret := COALESCE(
    internal_function_secret,
    NULLIF(current_setting('app.settings.internal_function_secret', true), ''),
    NULLIF(current_setting('internal_function_secret', true), '')
  );

  IF project_url IS NULL OR function_api_key IS NULL OR internal_function_secret IS NULL THEN
    RAISE EXCEPTION
      'Missing scheduler secret(s). Configure SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY or SUPABASE_ANON_KEY, and INTERNAL_FUNCTION_SECRET in vault.';
  END IF;

  request_headers := jsonb_build_object(
    'Content-Type', 'application/json',
    'apikey', function_api_key,
    'x-internal-key', internal_function_secret
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

REVOKE ALL ON FUNCTION public.invoke_edge_function_with_internal_secret(text, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.invoke_edge_function_with_internal_secret(text, jsonb) TO postgres, service_role;

DO $$
DECLARE
  job_name text;
BEGIN
  FOREACH job_name IN ARRAY ARRAY[
    'notifications-enqueue-v2',
    'notifications-dispatch-v2',
    'generate-daily-mentor-pep-talks'
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
  $$SELECT public.invoke_edge_function_with_internal_secret('notifications-enqueue-v2', '{}'::jsonb);$$
)
WHERE NOT EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'notifications-enqueue-v2');

SELECT cron.schedule(
  'notifications-dispatch-v2',
  '* * * * *',
  $$SELECT public.invoke_edge_function_with_internal_secret('notifications-dispatch-v2', '{}'::jsonb);$$
)
WHERE NOT EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'notifications-dispatch-v2');

SELECT cron.schedule(
  'generate-daily-mentor-pep-talks',
  '1 0 * * *',
  $$SELECT public.invoke_edge_function_with_internal_secret('generate-daily-mentor-pep-talks', '{}'::jsonb);$$
)
WHERE NOT EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'generate-daily-mentor-pep-talks');
