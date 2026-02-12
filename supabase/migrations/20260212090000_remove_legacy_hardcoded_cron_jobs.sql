-- Remove legacy scheduler jobs that were created with hard-coded project URLs and bearer tokens.
-- Scheduling is now managed from GitHub Actions (`.github/workflows/scheduled-functions.yml`).
DO $$
DECLARE
  job_name text;
BEGIN
  FOREACH job_name IN ARRAY ARRAY[
    'generate-daily-mentor-pep-talks',
    'schedule-daily-mentor-pushes',
    'dispatch-daily-pushes'
  ]
  LOOP
    BEGIN
      PERFORM cron.unschedule(job_name)
      FROM cron.job
      WHERE cron.job.jobname = job_name;
    EXCEPTION
      WHEN undefined_table OR undefined_function THEN
        -- pg_cron is not installed in this project.
        NULL;
      WHEN OTHERS THEN
        -- Keep migration idempotent if job does not exist.
        NULL;
    END;
  END LOOP;
END $$;
