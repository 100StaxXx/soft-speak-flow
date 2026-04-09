CREATE OR REPLACE FUNCTION public.invoke_rotate_daily_wallpapers_with_internal_secret(
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
      'Missing wallpaper scheduler secret(s). Configure SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY or SUPABASE_ANON_KEY, and INTERNAL_FUNCTION_SECRET in vault.';
  END IF;

  request_headers := jsonb_build_object(
    'Content-Type', 'application/json',
    'apikey', function_api_key,
    'x-internal-key', internal_function_secret
  );

  PERFORM net.http_post(
    project_url || '/functions/v1/rotate-daily-wallpapers',
    COALESCE(payload, '{}'::jsonb),
    '{}'::jsonb,
    request_headers,
    300000
  );
END;
$$;

REVOKE ALL ON FUNCTION public.invoke_rotate_daily_wallpapers_with_internal_secret(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.invoke_rotate_daily_wallpapers_with_internal_secret(jsonb) TO postgres, service_role;

DO $$
BEGIN
  BEGIN
    PERFORM cron.unschedule('rotate-daily-wallpapers')
    FROM cron.job
    WHERE cron.job.jobname = 'rotate-daily-wallpapers';
  EXCEPTION
    WHEN undefined_table OR undefined_function THEN
      NULL;
    WHEN OTHERS THEN
      NULL;
  END;
END $$;

SELECT cron.schedule(
  'rotate-daily-wallpapers',
  '5 * * * *',
  $$SELECT public.invoke_rotate_daily_wallpapers_with_internal_secret(
    '{"daysAhead":4,"candidateCount":3}'::jsonb
  );$$
)
WHERE NOT EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'rotate-daily-wallpapers');
