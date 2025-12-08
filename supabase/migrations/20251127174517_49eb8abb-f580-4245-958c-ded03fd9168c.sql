-- Enable pg_cron extension if not already enabled
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Drop existing jobs if they exist (cleanup)
DO $$
BEGIN
  PERFORM cron.unschedule(jobname) 
  FROM cron.job 
  WHERE jobname IN (
    'generate-daily-mentor-pep-talks',
    'schedule-daily-mentor-pushes',
    'dispatch-daily-pushes'
  );
EXCEPTION
  WHEN OTHERS THEN NULL;
END $$;

-- NOTE: Replace <project-ref> and <anon-key-jwt> with your new Supabase values.
-- Job 1: Generate daily pep talks at 00:01 UTC
SELECT cron.schedule(
  'generate-daily-mentor-pep-talks',
  '1 0 * * *',  -- Every day at 00:01 UTC
  $$
  SELECT net.http_post(
    url := 'https://<project-ref>.supabase.co/functions/v1/generate-daily-mentor-pep-talks',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer <anon-key-jwt>'
    ),
    body := '{}'::jsonb
  );
  $$
);

-- Job 2: Schedule push notifications at 00:05 UTC
SELECT cron.schedule(
  'schedule-daily-mentor-pushes',
  '5 0 * * *',  -- Every day at 00:05 UTC
  $$
  SELECT net.http_post(
    url := 'https://<project-ref>.supabase.co/functions/v1/schedule-daily-mentor-pushes',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer <anon-key-jwt>'
    ),
    body := '{}'::jsonb
  );
  $$
);

-- Job 3: Dispatch pending push notifications every 5 minutes
SELECT cron.schedule(
  'dispatch-daily-pushes',
  '*/5 * * * *',  -- Every 5 minutes
  $$
  SELECT net.http_post(
    url := 'https://<project-ref>.supabase.co/functions/v1/dispatch-daily-pushes',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer <anon-key-jwt>'
    ),
    body := '{}'::jsonb
  );
  $$
);