-- Calendar integration foundation
-- 1) User-level visibility/settings for optional calendar integrations
-- 2) Connection metadata for sync modes and primary calendar routing
-- 3) Quest-to-calendar event links for send-only/full-sync workflows

-- ------------------------------------------------------------
-- calendar_user_settings
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.calendar_user_settings (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  integration_visible BOOLEAN NOT NULL DEFAULT false,
  nudge_dismissed_at TIMESTAMPTZ,
  default_provider TEXT CHECK (default_provider IN ('google', 'outlook', 'apple')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.calendar_user_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own calendar settings" ON public.calendar_user_settings;
CREATE POLICY "Users can view own calendar settings"
  ON public.calendar_user_settings
  FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own calendar settings" ON public.calendar_user_settings;
CREATE POLICY "Users can insert own calendar settings"
  ON public.calendar_user_settings
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own calendar settings" ON public.calendar_user_settings;
CREATE POLICY "Users can update own calendar settings"
  ON public.calendar_user_settings
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own calendar settings" ON public.calendar_user_settings;
CREATE POLICY "Users can delete own calendar settings"
  ON public.calendar_user_settings
  FOR DELETE
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Service role can manage all calendar settings" ON public.calendar_user_settings;
CREATE POLICY "Service role can manage all calendar settings"
  ON public.calendar_user_settings
  FOR ALL
  USING (public.is_service_role())
  WITH CHECK (public.is_service_role());

CREATE INDEX IF NOT EXISTS idx_calendar_user_settings_default_provider
  ON public.calendar_user_settings(default_provider);

DROP TRIGGER IF EXISTS update_calendar_user_settings_updated_at ON public.calendar_user_settings;
CREATE TRIGGER update_calendar_user_settings_updated_at
  BEFORE UPDATE ON public.calendar_user_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- ------------------------------------------------------------
-- user_calendar_connections extensions
-- ------------------------------------------------------------
ALTER TABLE public.user_calendar_connections
  ADD COLUMN IF NOT EXISTS sync_mode TEXT NOT NULL DEFAULT 'send_only' CHECK (sync_mode IN ('send_only', 'full_sync')),
  ADD COLUMN IF NOT EXISTS primary_calendar_id TEXT,
  ADD COLUMN IF NOT EXISTS primary_calendar_name TEXT,
  ADD COLUMN IF NOT EXISTS platform TEXT NOT NULL DEFAULT 'web' CHECK (platform IN ('web', 'ios'));

-- Backfill best-effort defaults for existing rows
UPDATE public.user_calendar_connections
SET primary_calendar_id = COALESCE(primary_calendar_id, calendar_id),
    primary_calendar_name = COALESCE(primary_calendar_name, calendar_email)
WHERE primary_calendar_id IS NULL OR primary_calendar_name IS NULL;

CREATE INDEX IF NOT EXISTS idx_calendar_connections_sync_mode
  ON public.user_calendar_connections(sync_mode);

-- ------------------------------------------------------------
-- quest_calendar_links
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.quest_calendar_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  task_id UUID NOT NULL REFERENCES public.daily_tasks(id) ON DELETE CASCADE,
  connection_id UUID NOT NULL REFERENCES public.user_calendar_connections(id) ON DELETE CASCADE,
  provider TEXT NOT NULL CHECK (provider IN ('google', 'outlook', 'apple')),
  external_calendar_id TEXT,
  external_event_id TEXT NOT NULL,
  sync_mode TEXT NOT NULL DEFAULT 'send_only' CHECK (sync_mode IN ('send_only', 'full_sync')),
  last_app_sync_at TIMESTAMPTZ,
  last_provider_sync_at TIMESTAMPTZ,
  last_conflict_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(connection_id, external_event_id),
  UNIQUE(task_id, connection_id)
);

ALTER TABLE public.quest_calendar_links ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own quest calendar links" ON public.quest_calendar_links;
CREATE POLICY "Users can view own quest calendar links"
  ON public.quest_calendar_links
  FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own quest calendar links" ON public.quest_calendar_links;
CREATE POLICY "Users can insert own quest calendar links"
  ON public.quest_calendar_links
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own quest calendar links" ON public.quest_calendar_links;
CREATE POLICY "Users can update own quest calendar links"
  ON public.quest_calendar_links
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own quest calendar links" ON public.quest_calendar_links;
CREATE POLICY "Users can delete own quest calendar links"
  ON public.quest_calendar_links
  FOR DELETE
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Service role can manage all quest calendar links" ON public.quest_calendar_links;
CREATE POLICY "Service role can manage all quest calendar links"
  ON public.quest_calendar_links
  FOR ALL
  USING (public.is_service_role())
  WITH CHECK (public.is_service_role());

CREATE INDEX IF NOT EXISTS idx_quest_calendar_links_user_id
  ON public.quest_calendar_links(user_id);

CREATE INDEX IF NOT EXISTS idx_quest_calendar_links_task_id
  ON public.quest_calendar_links(task_id);

CREATE INDEX IF NOT EXISTS idx_quest_calendar_links_connection_id
  ON public.quest_calendar_links(connection_id);

CREATE INDEX IF NOT EXISTS idx_quest_calendar_links_provider
  ON public.quest_calendar_links(provider);

CREATE INDEX IF NOT EXISTS idx_quest_calendar_links_sync_mode
  ON public.quest_calendar_links(sync_mode);

DROP TRIGGER IF EXISTS update_quest_calendar_links_updated_at ON public.quest_calendar_links;
CREATE TRIGGER update_quest_calendar_links_updated_at
  BEFORE UPDATE ON public.quest_calendar_links
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
