-- Durable create intents. An uncertain external POST is never automatically repeated.
CREATE TABLE public.calendar_task_exports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  task_id uuid NOT NULL REFERENCES public.daily_tasks(id) ON DELETE CASCADE,
  connection_id uuid NOT NULL REFERENCES public.user_calendar_connections(id) ON DELETE CASCADE,
  provider text NOT NULL CHECK(provider IN ('google','apple')),
  list_id text NOT NULL CHECK(length(list_id) BETWEEN 1 AND 2048),
  snapshot jsonb NOT NULL,
  timezone text NOT NULL,
  sync_enabled boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'ready' CHECK(status IN ('ready','dispatched','complete')),
  external_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  dispatched_at timestamptz,
  attempt_id uuid,
  UNIQUE(user_id,task_id,connection_id,list_id)
);
ALTER TABLE public.calendar_task_exports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Read own task export intents" ON public.calendar_task_exports
  FOR SELECT TO authenticated USING(user_id=auth.uid());
GRANT SELECT ON public.calendar_task_exports TO authenticated;
GRANT ALL ON public.calendar_task_exports TO service_role;
REVOKE ALL ON public.calendar_task_exports FROM anon;
REVOKE INSERT,UPDATE,DELETE ON public.calendar_task_exports FROM authenticated;

CREATE FUNCTION public.prepare_calendar_task_export(p_task_id uuid,p_connection_id uuid,p_list_id text,
  p_sync_enabled boolean DEFAULT false,p_timezone text DEFAULT 'UTC')
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE uid uuid:=auth.uid(); task public.daily_tasks; conn public.user_calendar_connections;
  intent public.calendar_task_exports; snap jsonb; existing text;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Sign in first'; END IF;
  SELECT * INTO task FROM public.daily_tasks WHERE id=p_task_id AND user_id=uid;
  IF NOT FOUND THEN RAISE EXCEPTION 'Quest unavailable'; END IF;
  SELECT * INTO conn FROM public.user_calendar_connections WHERE id=p_connection_id AND user_id=uid AND sync_enabled AND provider IN ('google','apple');
  IF NOT FOUND THEN RAISE EXCEPTION 'Task account unavailable'; END IF;
  IF length(coalesce(p_list_id,'')) NOT BETWEEN 1 AND 2048
    OR NOT EXISTS(SELECT 1 FROM pg_timezone_names WHERE name=p_timezone)
    OR length(trim(task.task_text)) NOT BETWEEN 1 AND 1024 OR length(coalesce(task.notes,''))>8000
    THEN RAISE EXCEPTION 'Check title, notes, list and timezone before sending'; END IF;
  snap:=jsonb_build_object('task_text',task.task_text,'task_date',task.task_date,'scheduled_time',left(task.scheduled_time::text,5),
    'estimated_duration',task.estimated_duration,'location',nullif(task.location,''),'notes',nullif(task.notes,''),'completed',task.completed);
  SELECT external_id INTO existing FROM public.calendar_quest_imports
    WHERE user_id=uid AND task_id=p_task_id AND connection_id=p_connection_id AND calendar_id=p_list_id AND resource_kind='task' LIMIT 1;
  INSERT INTO public.calendar_task_exports(user_id,task_id,connection_id,provider,list_id,snapshot,timezone,sync_enabled,status,external_id)
    VALUES(uid,p_task_id,p_connection_id,conn.provider,p_list_id,snap,p_timezone,p_sync_enabled,
      CASE WHEN existing IS NULL THEN 'ready' ELSE 'complete' END,existing)
    ON CONFLICT(user_id,task_id,connection_id,list_id) DO NOTHING;
  SELECT * INTO intent FROM public.calendar_task_exports WHERE user_id=uid AND task_id=p_task_id AND connection_id=p_connection_id AND list_id=p_list_id FOR UPDATE;
  -- Refresh unsent data only. Once dispatched, the recovery identity/snapshot is immutable.
  IF intent.status='ready' THEN
    UPDATE public.calendar_task_exports SET snapshot=snap,sync_enabled=p_sync_enabled,timezone=p_timezone
      WHERE id=intent.id RETURNING * INTO intent;
  END IF;
  RETURN to_jsonb(intent);
END $$;
REVOKE ALL ON FUNCTION public.prepare_calendar_task_export(uuid,uuid,text,boolean,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.prepare_calendar_task_export(uuid,uuid,text,boolean,text) TO authenticated;

-- Cloud creation can only be dispatched/finalized by the verified server handler.
-- Native creation requires the same signed-in owner and an Apple connection.
CREATE FUNCTION public.claim_calendar_task_export(p_id uuid,p_user_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE intent public.calendar_task_exports;
BEGIN
  UPDATE public.calendar_task_exports i SET status='dispatched',dispatched_at=now(),attempt_id=gen_random_uuid()
    WHERE i.id=p_id AND i.user_id=p_user_id AND i.status='ready'
      AND (auth.role()='service_role' OR (auth.uid()=p_user_id AND i.provider='apple'))
      AND EXISTS(SELECT 1 FROM public.user_calendar_connections c WHERE c.id=i.connection_id AND c.user_id=p_user_id AND c.sync_enabled)
    RETURNING i.* INTO intent;
  RETURN CASE WHEN FOUND THEN to_jsonb(intent) ELSE NULL END;
END $$;
REVOKE ALL ON FUNCTION public.claim_calendar_task_export(uuid,uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.claim_calendar_task_export(uuid,uuid) TO authenticated,service_role;

CREATE FUNCTION public.complete_calendar_task_export(p_id uuid,p_user_id uuid,p_external_id text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE intent public.calendar_task_exports; linked_task uuid;
BEGIN
  SELECT * INTO intent FROM public.calendar_task_exports WHERE id=p_id AND user_id=p_user_id FOR UPDATE;
  IF NOT FOUND OR NOT coalesce(auth.role()='service_role' OR (auth.uid()=p_user_id AND intent.provider='apple'),false)
    THEN RETURN false; END IF;
  IF intent.status='complete' THEN RETURN intent.external_id=p_external_id; END IF;
  IF intent.status<>'dispatched' OR length(coalesce(p_external_id,'')) NOT BETWEEN 1 AND 2048 THEN RETURN false; END IF;
  INSERT INTO public.calendar_quest_imports(user_id,task_id,connection_id,provider,calendar_id,external_id,resource_kind,baseline,timezone,sync_enabled)
    VALUES(p_user_id,intent.task_id,intent.connection_id,intent.provider,intent.list_id,p_external_id,'task',intent.snapshot,intent.timezone,intent.sync_enabled)
    ON CONFLICT(user_id,connection_id,resource_kind,calendar_id,external_id) DO NOTHING;
  SELECT task_id INTO linked_task FROM public.calendar_quest_imports WHERE user_id=p_user_id AND connection_id=intent.connection_id
    AND calendar_id=intent.list_id AND external_id=p_external_id AND resource_kind='task';
  IF linked_task IS DISTINCT FROM intent.task_id THEN RAISE EXCEPTION 'Outside task already linked to another quest'; END IF;
  UPDATE public.calendar_task_exports SET status='complete',external_id=p_external_id WHERE id=intent.id;
  RETURN true;
END $$;
REVOKE ALL ON FUNCTION public.complete_calendar_task_export(uuid,uuid,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.complete_calendar_task_export(uuid,uuid,text) TO authenticated,service_role;

-- Only a definitive rejection (not a timeout, 429 or 5xx) can permit another POST.
CREATE FUNCTION public.reset_rejected_calendar_task_export(p_id uuid,p_user_id uuid,p_attempt_id uuid)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path=public AS $$
  UPDATE public.calendar_task_exports SET status='ready',dispatched_at=NULL
    WHERE id=p_id AND user_id=p_user_id AND provider='google' AND status='dispatched'
      AND attempt_id=p_attempt_id AND auth.role()='service_role';
$$;
REVOKE ALL ON FUNCTION public.reset_rejected_calendar_task_export(uuid,uuid,uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.reset_rejected_calendar_task_export(uuid,uuid,uuid) TO service_role;
