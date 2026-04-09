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
  $$SELECT public.invoke_edge_function_with_internal_secret(
    'rotate-daily-wallpapers',
    '{"daysAhead":4,"candidateCount":3}'::jsonb
  );$$
)
WHERE NOT EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'rotate-daily-wallpapers');
