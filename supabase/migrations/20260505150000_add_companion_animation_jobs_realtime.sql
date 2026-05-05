-- Let the app refresh replay cards when a Kling/fal animation job changes,
-- even if the companion_evolutions row is temporarily stale.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'companion_animation_jobs'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.companion_animation_jobs;
  END IF;
EXCEPTION
  WHEN duplicate_object THEN
    NULL;
END $$;
