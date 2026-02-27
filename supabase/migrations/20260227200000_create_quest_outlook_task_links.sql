-- Quest links for Microsoft To Do tasks.
CREATE TABLE IF NOT EXISTS public.quest_outlook_task_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  task_id UUID NOT NULL REFERENCES public.daily_tasks(id) ON DELETE CASCADE,
  connection_id UUID NOT NULL REFERENCES public.user_calendar_connections(id) ON DELETE CASCADE,
  provider TEXT NOT NULL DEFAULT 'outlook' CHECK (provider = 'outlook'),
  external_task_list_id TEXT NOT NULL,
  external_task_id TEXT NOT NULL,
  sync_mode TEXT NOT NULL DEFAULT 'send_only' CHECK (sync_mode IN ('send_only', 'full_sync')),
  last_app_sync_at TIMESTAMPTZ,
  last_provider_sync_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(connection_id, external_task_list_id, external_task_id),
  UNIQUE(task_id, connection_id)
);

ALTER TABLE public.quest_outlook_task_links ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own outlook task links" ON public.quest_outlook_task_links;
CREATE POLICY "Users can view own outlook task links"
  ON public.quest_outlook_task_links
  FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own outlook task links" ON public.quest_outlook_task_links;
CREATE POLICY "Users can insert own outlook task links"
  ON public.quest_outlook_task_links
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own outlook task links" ON public.quest_outlook_task_links;
CREATE POLICY "Users can update own outlook task links"
  ON public.quest_outlook_task_links
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own outlook task links" ON public.quest_outlook_task_links;
CREATE POLICY "Users can delete own outlook task links"
  ON public.quest_outlook_task_links
  FOR DELETE
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Service role can manage all outlook task links" ON public.quest_outlook_task_links;
CREATE POLICY "Service role can manage all outlook task links"
  ON public.quest_outlook_task_links
  FOR ALL
  USING (public.is_service_role())
  WITH CHECK (public.is_service_role());

CREATE INDEX IF NOT EXISTS idx_quest_outlook_task_links_user_id
  ON public.quest_outlook_task_links(user_id);

CREATE INDEX IF NOT EXISTS idx_quest_outlook_task_links_task_id
  ON public.quest_outlook_task_links(task_id);

CREATE INDEX IF NOT EXISTS idx_quest_outlook_task_links_connection_id
  ON public.quest_outlook_task_links(connection_id);

DROP TRIGGER IF EXISTS update_quest_outlook_task_links_updated_at ON public.quest_outlook_task_links;
CREATE TRIGGER update_quest_outlook_task_links_updated_at
  BEFORE UPDATE ON public.quest_outlook_task_links
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
