-- Daily pep talks are generated on demand from the user's refresh action.
-- Keep the batch functions available for manual/admin use, but stop automatic
-- all-mentor fanout so mentors do not receive shared fallback scripts.
DO $$
DECLARE
  job_name text;
BEGIN
  FOREACH job_name IN ARRAY ARRAY[
    'generate-daily-mentor-pep-talks',
    'generate-tomorrow-pep-talks'
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
