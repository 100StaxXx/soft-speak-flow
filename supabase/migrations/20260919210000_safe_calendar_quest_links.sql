-- Opt-in links, isolated from the legacy send-only integration and its delete behavior.
-- Existing task records, connections and send-only modes are not rewritten.
-- Extend source validation additively so imported all-day events and due-date-only
-- tasks do not need an invented midnight appointment. Preserve all existing sources.
DO $$ DECLARE definition text; BEGIN
  SELECT pg_get_constraintdef(oid) INTO definition FROM pg_constraint
    WHERE conrelid = 'public.daily_tasks'::regclass AND conname = 'daily_tasks_source_check';
  IF definition IS NOT NULL AND position('calendar_link' IN definition) = 0 THEN
    EXECUTE 'ALTER TABLE public.daily_tasks DROP CONSTRAINT daily_tasks_source_check';
    EXECUTE 'ALTER TABLE public.daily_tasks ADD CONSTRAINT daily_tasks_source_check ' ||
      replace(definition, '''outlook_sync''::text', '''outlook_sync''::text, ''calendar_link''::text');
  END IF;
  SELECT pg_get_constraintdef(oid) INTO definition FROM pg_constraint
    WHERE conrelid = 'public.daily_tasks'::regclass AND conname = 'daily_tasks_regular_requires_time_or_inbox';
  IF definition IS NOT NULL AND position('calendar_link' IN definition) = 0 THEN
    EXECUTE 'ALTER TABLE public.daily_tasks DROP CONSTRAINT daily_tasks_regular_requires_time_or_inbox';
    EXECUTE 'ALTER TABLE public.daily_tasks ADD CONSTRAINT daily_tasks_regular_requires_time_or_inbox ' ||
      replace(definition, '''outlook_sync''::text', '''outlook_sync''::text, ''calendar_link''::text');
  END IF;
END $$;
CREATE TABLE IF NOT EXISTS public.calendar_quest_imports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  task_id uuid NOT NULL REFERENCES public.daily_tasks(id) ON DELETE CASCADE,
  connection_id uuid NOT NULL REFERENCES public.user_calendar_connections(id) ON DELETE CASCADE,
  provider text NOT NULL CHECK (provider IN ('google', 'outlook', 'apple')),
  calendar_id text NOT NULL,
  external_id text NOT NULL,
  resource_kind text NOT NULL DEFAULT 'event' CHECK (resource_kind IN ('event','task')),
  baseline jsonb NOT NULL,
  timezone text NOT NULL DEFAULT 'UTC',
  sync_enabled boolean NOT NULL DEFAULT false,
  sync_status text NOT NULL DEFAULT 'linked' CHECK (sync_status IN ('linked','conflict','missing','retry')),
  last_error text,
  revision bigint NOT NULL DEFAULT 0,
  sync_token uuid,
  sync_lease_until timestamptz,
  last_synced_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, connection_id, resource_kind, calendar_id, external_id)
);
ALTER TABLE public.calendar_quest_imports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Read own imported calendar links" ON public.calendar_quest_imports
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Service manages imported calendar links" ON public.calendar_quest_imports
  FOR ALL TO service_role USING (true) WITH CHECK (true);
GRANT SELECT ON public.calendar_quest_imports TO authenticated;
GRANT ALL ON public.calendar_quest_imports TO service_role;
REVOKE INSERT, UPDATE, DELETE ON public.calendar_quest_imports FROM authenticated, anon;

CREATE OR REPLACE FUNCTION public.import_calendar_quest(
  p_connection_id uuid, p_calendar_id text, p_external_id text,
  p_snapshot jsonb, p_sync_enabled boolean DEFAULT false, p_timezone text DEFAULT 'UTC', p_kind text DEFAULT 'event'
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  uid uuid := auth.uid(); conn public.user_calendar_connections; tid uuid;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
  IF p_kind NOT IN ('event','task') THEN RAISE EXCEPTION 'Invalid item kind'; END IF;
  IF NOT EXISTS(SELECT 1 FROM pg_timezone_names WHERE name = p_timezone) THEN RAISE EXCEPTION 'Invalid timezone'; END IF;
  SELECT * INTO conn FROM public.user_calendar_connections WHERE id = p_connection_id AND user_id = uid AND sync_enabled;
  IF NOT FOUND THEN RAISE EXCEPTION 'Calendar connection unavailable'; END IF;
  IF length(coalesce(p_calendar_id,'')) NOT BETWEEN 1 AND 2048
     OR length(coalesce(p_external_id,'')) NOT BETWEEN 1 AND 2048
     OR length(trim(coalesce(p_snapshot->>'task_text',''))) NOT BETWEEN 1 AND 1024
     OR length(coalesce(p_snapshot->>'notes','')) > 10000
     OR (p_snapshot->>'estimated_duration')::integer NOT BETWEEN 1 AND 44640 THEN RAISE EXCEPTION 'Invalid calendar item'; END IF;
  -- Serialize double-taps and concurrent devices before creating a task.
  PERFORM pg_advisory_xact_lock(hashtextextended(uid::text || p_connection_id::text || p_calendar_id || p_external_id, 0));
  SELECT task_id INTO tid FROM public.calendar_quest_imports
    WHERE user_id = uid AND connection_id = p_connection_id AND calendar_id = p_calendar_id AND external_id = p_external_id AND resource_kind = p_kind;
  IF tid IS NOT NULL THEN RETURN tid; END IF;
  -- A previously exported quest is already linked; do not import a duplicate.
  SELECT task_id INTO tid FROM public.quest_calendar_links
    WHERE user_id = uid AND connection_id = p_connection_id AND external_event_id = p_external_id
      AND coalesce(external_calendar_id,conn.primary_calendar_id,conn.calendar_id) = p_calendar_id AND p_kind = 'event' LIMIT 1;
  IF tid IS NOT NULL THEN RETURN tid; END IF;
  SELECT task_id INTO tid FROM public.quest_outlook_task_links
    WHERE user_id = uid AND connection_id = p_connection_id AND external_task_id = p_external_id
      AND external_task_list_id = p_calendar_id AND p_kind = 'task' LIMIT 1;
  IF tid IS NOT NULL THEN RETURN tid; END IF;
  INSERT INTO public.daily_tasks(user_id, task_text, task_date, scheduled_time, estimated_duration, location, notes,
    completed, completed_at, xp_reward, difficulty, is_main_quest, source)
  VALUES(uid, p_snapshot->>'task_text', (p_snapshot->>'task_date')::date, (p_snapshot->>'scheduled_time')::time,
    (p_snapshot->>'estimated_duration')::integer,
    p_snapshot->>'location', p_snapshot->>'notes', p_kind = 'task' AND coalesce((p_snapshot->>'completed')::boolean,false),
    CASE WHEN p_kind = 'task' AND coalesce((p_snapshot->>'completed')::boolean,false) THEN now() ELSE NULL END,
    0, 'easy', false, 'calendar_link') RETURNING id INTO tid;
  INSERT INTO public.calendar_quest_imports(user_id,task_id,connection_id,provider,calendar_id,external_id,baseline,sync_enabled,timezone,resource_kind)
    VALUES(uid,tid,p_connection_id,conn.provider,p_calendar_id,p_external_id,p_snapshot,p_sync_enabled,p_timezone,p_kind);
  RETURN tid;
END $$;
REVOKE ALL ON FUNCTION public.import_calendar_quest(uuid,text,text,jsonb,boolean,text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.import_calendar_quest(uuid,text,text,jsonb,boolean,text,text) TO authenticated;

-- One device owns a short-lived sync attempt. A paused/disconnected link or a
-- stale revision cannot start a write, and another device cannot race the merge.
CREATE OR REPLACE FUNCTION public.claim_calendar_quest_sync(p_link_id uuid, p_revision bigint)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE token uuid;
BEGIN
  UPDATE public.calendar_quest_imports l SET sync_token=gen_random_uuid(), sync_lease_until=now()+interval '3 minutes'
    WHERE l.id=p_link_id AND l.user_id=auth.uid() AND l.revision=p_revision AND l.sync_enabled
      AND (l.sync_lease_until IS NULL OR l.sync_lease_until <= now())
      AND EXISTS(SELECT 1 FROM public.user_calendar_connections c WHERE c.id=l.connection_id AND c.user_id=auth.uid() AND c.sync_enabled)
    RETURNING sync_token INTO token;
  RETURN token;
END $$;
REVOKE ALL ON FUNCTION public.claim_calendar_quest_sync(uuid,bigint) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.claim_calendar_quest_sync(uuid,bigint) TO authenticated;

CREATE OR REPLACE FUNCTION public.calendar_quest_sync_is_current(p_link_id uuid, p_revision bigint, p_token uuid)
RETURNS boolean LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS(SELECT 1 FROM public.calendar_quest_imports l
    JOIN public.user_calendar_connections c ON c.id=l.connection_id AND c.user_id=auth.uid() AND c.sync_enabled
    WHERE l.id=p_link_id AND l.user_id=auth.uid() AND l.revision=p_revision AND l.sync_enabled
      AND l.sync_token=p_token AND l.sync_lease_until > now());
$$;
REVOKE ALL ON FUNCTION public.calendar_quest_sync_is_current(uuid,bigint,uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.calendar_quest_sync_is_current(uuid,bigint,uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.release_calendar_quest_sync(p_link_id uuid, p_token uuid)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  UPDATE public.calendar_quest_imports SET sync_token=NULL, sync_lease_until=NULL
    WHERE id=p_link_id AND user_id=auth.uid() AND sync_token=p_token;
$$;
REVOKE ALL ON FUNCTION public.release_calendar_quest_sync(uuid,uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.release_calendar_quest_sync(uuid,uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public._apply_calendar_quest_sync(
  p_user_id uuid, p_link_id uuid, p_revision bigint, p_token uuid, p_expected jsonb, p_snapshot jsonb,
  p_status text DEFAULT 'linked', p_error text DEFAULT NULL
) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE link public.calendar_quest_imports; task public.daily_tasks; actual jsonb;
BEGIN
  SELECT * INTO link FROM public.calendar_quest_imports WHERE id = p_link_id AND user_id = p_user_id FOR UPDATE;
  IF NOT FOUND OR link.revision <> p_revision OR NOT link.sync_enabled OR p_token IS NULL
      OR link.sync_token IS DISTINCT FROM p_token OR link.sync_lease_until IS NULL OR link.sync_lease_until <= now()
      OR NOT EXISTS(SELECT 1 FROM public.user_calendar_connections WHERE id=link.connection_id AND user_id=p_user_id AND sync_enabled)
    THEN RETURN false; END IF;
  IF p_status NOT IN ('linked','conflict','missing','retry') THEN RAISE EXCEPTION 'Invalid sync status'; END IF;
  IF p_status = 'linked' THEN
    SELECT * INTO task FROM public.daily_tasks WHERE id = link.task_id AND user_id = p_user_id FOR UPDATE;
    IF NOT FOUND THEN RETURN false; END IF;
    actual := jsonb_build_object('task_text', task.task_text, 'task_date', task.task_date,
      'scheduled_time', left(task.scheduled_time::text, 5), 'estimated_duration', task.estimated_duration,
      'location', nullif(task.location,''), 'notes', nullif(task.notes,''));
    IF link.resource_kind = 'task' THEN actual := actual || jsonb_build_object('completed',task.completed); END IF;
    IF actual IS DISTINCT FROM p_expected THEN RETURN false; END IF;
    IF length(trim(coalesce(p_snapshot->>'task_text',''))) NOT BETWEEN 1 AND 1024
       OR length(coalesce(p_snapshot->>'notes','')) > 10000
       OR (p_snapshot->>'estimated_duration')::integer NOT BETWEEN 1 AND 44640 THEN RAISE EXCEPTION 'Invalid calendar item'; END IF;
    IF actual IS DISTINCT FROM p_snapshot THEN
    UPDATE public.daily_tasks SET task_text = p_snapshot->>'task_text', task_date = (p_snapshot->>'task_date')::date,
      scheduled_time = (p_snapshot->>'scheduled_time')::time,
      estimated_duration = (p_snapshot->>'estimated_duration')::integer,
      location = p_snapshot->>'location', notes = p_snapshot->>'notes',
      completed = CASE WHEN link.resource_kind = 'task' THEN coalesce((p_snapshot->>'completed')::boolean,false) ELSE completed END,
      completed_at = CASE WHEN link.resource_kind <> 'task' THEN completed_at
        WHEN coalesce((p_snapshot->>'completed')::boolean,false) THEN coalesce(completed_at,now()) ELSE NULL END,
      source = CASE WHEN p_snapshot->>'task_date' IS NOT NULL AND p_snapshot->>'scheduled_time' IS NULL THEN 'calendar_link' ELSE source END
      WHERE id = task.id AND user_id = p_user_id;
    END IF;
  END IF;
  UPDATE public.calendar_quest_imports SET
    baseline = CASE WHEN p_status = 'linked' THEN p_snapshot ELSE baseline END,
    sync_status = p_status, last_error = left(p_error, 250), revision = revision + 1,
    sync_token = NULL, sync_lease_until = NULL,
    last_synced_at = CASE WHEN p_status = 'linked' THEN now() ELSE last_synced_at END
    WHERE id = link.id;
  RETURN true;
END $$;
-- Only the owner-scoped wrappers may call the shared implementation.
REVOKE ALL ON FUNCTION public._apply_calendar_quest_sync(uuid,uuid,bigint,uuid,jsonb,jsonb,text,text) FROM PUBLIC, authenticated, anon, service_role;
CREATE OR REPLACE FUNCTION public.apply_calendar_quest_sync(
  p_link_id uuid, p_revision bigint, p_token uuid, p_expected jsonb, p_snapshot jsonb,
  p_status text DEFAULT 'linked', p_error text DEFAULT NULL
) RETURNS boolean LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  SELECT public._apply_calendar_quest_sync(auth.uid(),p_link_id,p_revision,p_token,p_expected,p_snapshot,p_status,p_error);
$$;
REVOKE ALL ON FUNCTION public.apply_calendar_quest_sync(uuid,bigint,uuid,jsonb,jsonb,text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.apply_calendar_quest_sync(uuid,bigint,uuid,jsonb,jsonb,text,text) TO authenticated;

-- Read-only calendar selection is independent of the write destination.
ALTER TABLE public.calendar_user_settings ADD COLUMN IF NOT EXISTS visible_calendars jsonb NOT NULL DEFAULT '{}';

CREATE OR REPLACE FUNCTION public.set_calendar_quest_sync(p_link_id uuid, p_enabled boolean)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.calendar_quest_imports SET sync_enabled=p_enabled, revision=revision+1, sync_token=NULL, sync_lease_until=NULL
    WHERE id=p_link_id AND user_id=auth.uid();
  IF NOT FOUND THEN RAISE EXCEPTION 'Link not found'; END IF;
END $$;
REVOKE ALL ON FUNCTION public.set_calendar_quest_sync(uuid,boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_calendar_quest_sync(uuid,boolean) TO authenticated;

-- Called only after an explicit send succeeds, never to reclassify all old links.
CREATE OR REPLACE FUNCTION public.register_sent_calendar_quest(p_task_id uuid, p_timezone text,
  p_connection_id uuid, p_external_id text, p_kind text, p_expected jsonb)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE task public.daily_tasks; snap jsonb; item record;
BEGIN
  SELECT * INTO task FROM public.daily_tasks WHERE id=p_task_id AND user_id=auth.uid();
  IF NOT FOUND THEN RAISE EXCEPTION 'Quest not found'; END IF;
  IF p_kind NOT IN ('event','task') OR p_external_id IS NULL THEN RAISE EXCEPTION 'Invalid sent item'; END IF;
  IF NOT EXISTS(SELECT 1 FROM pg_timezone_names WHERE name=p_timezone) THEN RAISE EXCEPTION 'Invalid timezone'; END IF;
  snap := jsonb_build_object('task_text',task.task_text,'task_date',task.task_date,'scheduled_time',left(task.scheduled_time::text,5),
    'estimated_duration',task.estimated_duration,'location',nullif(task.location,''),'notes',nullif(task.notes,''));
  -- Do not establish a misleading baseline if the quest changed while sending.
  IF (CASE WHEN p_kind='task' THEN snap || jsonb_build_object('completed',task.completed) ELSE snap END)
      IS DISTINCT FROM p_expected THEN RETURN; END IF;
  FOR item IN SELECT l.*,coalesce(c.primary_calendar_id,c.calendar_id) AS fallback_calendar_id FROM public.quest_calendar_links l
    JOIN public.user_calendar_connections c ON c.id=l.connection_id AND c.user_id=auth.uid()
    WHERE l.user_id=auth.uid() AND l.task_id=task.id AND l.connection_id=p_connection_id
      AND l.external_event_id=p_external_id AND p_kind='event'
  LOOP
    INSERT INTO public.calendar_quest_imports(user_id,task_id,connection_id,provider,calendar_id,external_id,baseline,sync_enabled,timezone)
      VALUES(auth.uid(),task.id,item.connection_id,item.provider,coalesce(item.external_calendar_id,item.fallback_calendar_id),item.external_event_id,snap,true,p_timezone)
      ON CONFLICT(user_id,connection_id,resource_kind,calendar_id,external_id) DO NOTHING;
  END LOOP;
  FOR item IN SELECT l.* FROM public.quest_outlook_task_links l
    JOIN public.user_calendar_connections c ON c.id=l.connection_id AND c.user_id=auth.uid()
    WHERE l.user_id=auth.uid() AND l.task_id=task.id AND l.connection_id=p_connection_id
      AND l.external_task_id=p_external_id AND p_kind='task'
  LOOP
    INSERT INTO public.calendar_quest_imports(user_id,task_id,connection_id,provider,calendar_id,external_id,resource_kind,baseline,sync_enabled,timezone)
      VALUES(auth.uid(),task.id,item.connection_id,'outlook',item.external_task_list_id,item.external_task_id,'task',snap || jsonb_build_object('completed',task.completed),true,p_timezone)
      ON CONFLICT(user_id,connection_id,resource_kind,calendar_id,external_id) DO NOTHING;
  END LOOP;
END $$;
REVOKE ALL ON FUNCTION public.register_sent_calendar_quest(uuid,text,uuid,text,text,jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.register_sent_calendar_quest(uuid,text,uuid,text,text,jsonb) TO authenticated;
