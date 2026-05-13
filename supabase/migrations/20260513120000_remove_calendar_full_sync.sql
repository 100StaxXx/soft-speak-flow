-- Calendar integrations are send-only. Collapse legacy full-sync rows and
-- prevent new full-sync connection/link records.

UPDATE public.user_calendar_connections
SET sync_mode = 'send_only',
    updated_at = now()
WHERE sync_mode <> 'send_only';

UPDATE public.quest_calendar_links
SET sync_mode = 'send_only',
    updated_at = now()
WHERE sync_mode <> 'send_only';

UPDATE public.quest_outlook_task_links
SET sync_mode = 'send_only',
    updated_at = now()
WHERE sync_mode <> 'send_only';

ALTER TABLE public.user_calendar_connections
  ALTER COLUMN sync_mode SET DEFAULT 'send_only',
  DROP CONSTRAINT IF EXISTS user_calendar_connections_sync_mode_check,
  ADD CONSTRAINT user_calendar_connections_sync_mode_send_only_check
    CHECK (sync_mode = 'send_only');

ALTER TABLE public.quest_calendar_links
  ALTER COLUMN sync_mode SET DEFAULT 'send_only',
  DROP CONSTRAINT IF EXISTS quest_calendar_links_sync_mode_check,
  ADD CONSTRAINT quest_calendar_links_sync_mode_send_only_check
    CHECK (sync_mode = 'send_only');

ALTER TABLE public.quest_outlook_task_links
  ALTER COLUMN sync_mode SET DEFAULT 'send_only',
  DROP CONSTRAINT IF EXISTS quest_outlook_task_links_sync_mode_check,
  ADD CONSTRAINT quest_outlook_task_links_sync_mode_send_only_check
    CHECK (sync_mode = 'send_only');
