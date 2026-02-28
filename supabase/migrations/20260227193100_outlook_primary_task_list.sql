-- Outlook To Do metadata on existing calendar connection rows.
ALTER TABLE public.user_calendar_connections
  ADD COLUMN IF NOT EXISTS primary_task_list_id TEXT,
  ADD COLUMN IF NOT EXISTS primary_task_list_name TEXT;

CREATE INDEX IF NOT EXISTS idx_calendar_connections_primary_task_list_id
  ON public.user_calendar_connections(primary_task_list_id);
