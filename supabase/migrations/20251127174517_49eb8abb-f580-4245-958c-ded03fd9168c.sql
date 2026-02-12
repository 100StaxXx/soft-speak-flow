-- Legacy migration retained for ordering.
-- Scheduling has been moved to GitHub Actions and should not be configured in-db.

CREATE EXTENSION IF NOT EXISTS pg_cron;

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
