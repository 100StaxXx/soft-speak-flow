-- Restore two-way Google and Outlook calendar synchronization.

ALTER TABLE public.user_calendar_connections
  DROP CONSTRAINT IF EXISTS user_calendar_connections_sync_mode_send_only_check,
  DROP CONSTRAINT IF EXISTS user_calendar_connections_sync_mode_check,
  ALTER COLUMN sync_mode SET DEFAULT 'full_sync',
  ADD CONSTRAINT user_calendar_connections_sync_mode_check
    CHECK (sync_mode IN ('send_only', 'full_sync'));

ALTER TABLE public.quest_calendar_links
  DROP CONSTRAINT IF EXISTS quest_calendar_links_sync_mode_send_only_check,
  DROP CONSTRAINT IF EXISTS quest_calendar_links_sync_mode_check,
  ALTER COLUMN sync_mode SET DEFAULT 'full_sync',
  ADD CONSTRAINT quest_calendar_links_sync_mode_check
    CHECK (sync_mode IN ('send_only', 'full_sync'));

ALTER TABLE public.quest_outlook_task_links
  DROP CONSTRAINT IF EXISTS quest_outlook_task_links_sync_mode_send_only_check,
  DROP CONSTRAINT IF EXISTS quest_outlook_task_links_sync_mode_check,
  ALTER COLUMN sync_mode SET DEFAULT 'full_sync',
  ADD CONSTRAINT quest_outlook_task_links_sync_mode_check
    CHECK (sync_mode IN ('send_only', 'full_sync'));

UPDATE public.user_calendar_connections
SET sync_mode = 'full_sync', updated_at = now()
WHERE provider IN ('google', 'outlook')
  AND sync_enabled IS TRUE;

UPDATE public.quest_calendar_links AS link
SET sync_mode = 'full_sync', updated_at = now()
WHERE provider IN ('google', 'outlook')
  AND EXISTS (
    SELECT 1
    FROM public.user_calendar_connections AS connection
    WHERE connection.id = link.connection_id
      AND connection.sync_enabled IS TRUE
      AND connection.sync_mode = 'full_sync'
  );

UPDATE public.quest_outlook_task_links AS link
SET sync_mode = 'full_sync', updated_at = now()
WHERE EXISTS (
  SELECT 1
  FROM public.user_calendar_connections AS connection
  WHERE connection.id = link.connection_id
    AND connection.sync_enabled IS TRUE
    AND connection.sync_mode = 'full_sync'
);
