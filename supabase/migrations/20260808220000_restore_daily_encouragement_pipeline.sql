-- Restore Graceward's daily Christian audio encouragement generation without
-- re-enabling the older same-day batch job. The existing table/function names
-- remain unchanged for backward compatibility with installed app versions.

DO $$
DECLARE
  scheduled_job_id BIGINT;
BEGIN
  FOR scheduled_job_id IN
    SELECT jobid
    FROM cron.job
    WHERE jobname IN (
      'generate-daily-mentor-pep-talks',
      'generate-tomorrow-pep-talks'
    )
  LOOP
    PERFORM cron.unschedule(scheduled_job_id);
  END LOOP;
END;
$$;

SELECT cron.schedule(
  'generate-tomorrow-pep-talks',
  '15 0 * * *',
  $$SELECT public.invoke_edge_function_with_internal_secret('generate-tomorrow-pep-talks', '{}'::jsonb);$$
);

COMMENT ON TABLE public.daily_pep_talks IS
  'Daily Guide audio encouragements. Legacy table name retained for application compatibility.';
