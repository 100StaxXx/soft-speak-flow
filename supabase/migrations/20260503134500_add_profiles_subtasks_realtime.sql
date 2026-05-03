-- Keep client realtime subscriptions aligned with the tables they listen to.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_publication
    WHERE pubname = 'supabase_realtime'
  )
  AND to_regclass('public.profiles') IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'profiles'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.profiles;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_publication
    WHERE pubname = 'supabase_realtime'
  )
  AND to_regclass('public.subtasks') IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'subtasks'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.subtasks;
  END IF;
EXCEPTION
  WHEN duplicate_object OR undefined_object OR undefined_table THEN
    NULL;
END $$;
