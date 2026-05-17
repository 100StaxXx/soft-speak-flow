-- Keep queued companion evolutions moving even after the client leaves.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_publication
    WHERE pubname = 'supabase_realtime'
  )
  AND NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'companion_evolution_jobs'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.companion_evolution_jobs;
  END IF;
EXCEPTION
  WHEN duplicate_object OR undefined_object OR undefined_table THEN
    NULL;
END $$;

DO $$
BEGIN
  BEGIN
    PERFORM cron.unschedule('process-companion-evolution-job')
    FROM cron.job
    WHERE cron.job.jobname = 'process-companion-evolution-job';
  EXCEPTION
    WHEN undefined_table OR undefined_function OR invalid_schema_name THEN
      NULL;
    WHEN OTHERS THEN
      NULL;
  END;

  BEGIN
    PERFORM cron.schedule(
      'process-companion-evolution-job',
      '* * * * *',
      $cron$SELECT public.invoke_edge_function_with_internal_secret('process-companion-evolution-job', '{}'::jsonb);$cron$
    )
    WHERE NOT EXISTS (
      SELECT 1
      FROM cron.job
      WHERE jobname = 'process-companion-evolution-job'
    );
  EXCEPTION
    WHEN undefined_table OR undefined_function OR invalid_schema_name THEN
      NULL;
  END;
END $$;
