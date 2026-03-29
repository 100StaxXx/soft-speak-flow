DO $$
BEGIN
  BEGIN
    PERFORM cron.unschedule('generate-tomorrow-pep-talks')
    FROM cron.job
    WHERE cron.job.jobname = 'generate-tomorrow-pep-talks';
  EXCEPTION
    WHEN undefined_table OR undefined_function THEN
      NULL;
    WHEN OTHERS THEN
      NULL;
  END;
END $$;

SELECT cron.schedule(
  'generate-tomorrow-pep-talks',
  '15 0 * * *',
  $$SELECT public.invoke_edge_function_with_internal_secret('generate-tomorrow-pep-talks', '{}'::jsonb);$$
)
WHERE NOT EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'generate-tomorrow-pep-talks');
