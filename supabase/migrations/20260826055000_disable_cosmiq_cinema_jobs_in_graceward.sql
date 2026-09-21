-- Graceward and Cosmiq now use separate Supabase projects. Companion Cinema is
-- a Cosmiq-only worker pipeline and must never be scheduled by Graceward.

DO $$
DECLARE
  scheduled_job_id bigint;
BEGIN
  FOR scheduled_job_id IN
    SELECT jobid
    FROM cron.job
    WHERE jobname IN (
      'process-companion-cinema-event',
      'cleanup-companion-cinema-private-assets'
    )
  LOOP
    PERFORM cron.unschedule(scheduled_job_id);
  END LOOP;
END;
$$;
