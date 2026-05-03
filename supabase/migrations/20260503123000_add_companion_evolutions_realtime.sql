-- Enable realtime refresh for saved companion evolution animation replays.

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
      AND tablename = 'companion_evolutions'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.companion_evolutions;
  END IF;
EXCEPTION
  WHEN duplicate_object OR undefined_object OR undefined_table THEN
    NULL;
END $$;
