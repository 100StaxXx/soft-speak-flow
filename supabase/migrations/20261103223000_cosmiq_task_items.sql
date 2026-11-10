BEGIN;
ALTER TABLE public.daily_tasks ADD COLUMN manual_series_id uuid;
-- Pre-existing manual rows have no trustworthy draft identity. Never infer one from a title.
CREATE FUNCTION public.cosmiq_task_series_key(t public.daily_tasks) RETURNS text
LANGUAGE sql STABLE SET search_path=pg_catalog AS $$
 SELECT CASE WHEN NOT coalesce(t.recurrence_override,false) AND
    (t.habit_source_id IS NOT NULL OR t.manual_series_id IS NOT NULL OR t.parent_template_id IS NOT NULL OR t.is_recurring)
 THEN md5(jsonb_build_array(
    CASE WHEN t.habit_source_id IS NOT NULL THEN 'habit' WHEN t.manual_series_id IS NOT NULL THEN 'manual' ELSE 'template' END,
    coalesce(t.habit_source_id,t.manual_series_id,t.parent_template_id,t.id),t.epic_id,t.task_text,
    t.scheduled_time,t.schedule_end_time,t.schedule_timezone,t.estimated_duration,coalesce(t.notes,''),coalesce(t.location,''),
    t.difficulty,t.category,t.priority,t.flexibility,t.contact_id,
    CASE WHEN t.reminder_enabled THEN jsonb_build_array(t.reminder_minutes_before,coalesce(t.reminder_offsets_minutes,'{}')) END)::text) END
$$;

CREATE FUNCTION public.cosmiq_mark_item_reschedule() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog AS $$
BEGIN
 IF (NEW.manual_series_id IS NOT NULL OR NEW.habit_source_id IS NOT NULL) AND NEW.task_date IS DISTINCT FROM OLD.task_date THEN
   NEW.recurrence_override:=true;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER cosmiq_mark_item_reschedule BEFORE UPDATE OF task_date ON public.daily_tasks
 FOR EACH ROW EXECUTE FUNCTION public.cosmiq_mark_item_reschedule();

-- Keep every claimable fact ID. Freeze only an opaque grouping key for new Episode evidence.
CREATE FUNCTION public.cosmiq_freeze_episode_task_items() RETURNS trigger LANGUAGE plpgsql SET search_path=public,pg_temp AS $$
BEGIN
 IF NEW.repair_of IS NOT NULL THEN RETURN NEW; END IF;
 SELECT coalesce(jsonb_agg(CASE WHEN k.key IS NULL THEN f.fact ELSE f.fact || jsonb_build_object('task_item_key',k.key) END ORDER BY f.ord),'[]')
 INTO NEW.facts FROM jsonb_array_elements(NEW.facts) WITH ORDINALITY f(fact,ord)
 LEFT JOIN public.daily_tasks t ON f.fact->>'kind'='quest' AND t.user_id=NEW.user_id AND t.id=
   CASE WHEN f.fact->>'id' ~ '^quest:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN substring(f.fact->>'id' FROM 7)::uuid END
 LEFT JOIN LATERAL (SELECT public.cosmiq_task_series_key(t) AS key) k ON true;
 RETURN NEW;
END $$;
CREATE TRIGGER cosmiq_freeze_episode_task_items BEFORE INSERT ON public.cosmiq_episodes
 FOR EACH ROW EXECUTE FUNCTION public.cosmiq_freeze_episode_task_items();

-- Each distinct item carries equal weight; completed dates still contribute partial progress.
CREATE FUNCTION public.cosmiq_manual_item_progress(campaign uuid, owner_id uuid) RETURNS integer
LANGUAGE sql VOLATILE SET search_path=public,pg_temp AS $$
 SELECT coalesce(round(100*avg(fraction)),0)::integer FROM (
   SELECT avg(CASE WHEN t.completed THEN 1 ELSE 0 END) fraction
   FROM public.daily_tasks t WHERE t.epic_id=campaign AND t.user_id=owner_id
   GROUP BY coalesce(public.cosmiq_task_series_key(t),t.id::text)
 ) items
$$;
CREATE OR REPLACE FUNCTION public.manual_campaign_progress_guard() RETURNS trigger LANGUAGE plpgsql SET search_path=public,pg_temp AS $$
BEGIN
 IF NEW.planning_mode='manual' THEN NEW.progress_percentage:=public.cosmiq_manual_item_progress(NEW.id,NEW.user_id); END IF;
 RETURN NEW;
END $$;
CREATE OR REPLACE FUNCTION public.refresh_manual_campaign_progress()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE v_id uuid; v_owner uuid; v_progress integer;
BEGIN
  FOR v_id IN SELECT DISTINCT unnest(ARRAY[
    CASE WHEN TG_OP <> 'INSERT' THEN OLD.epic_id END,
    CASE WHEN TG_OP <> 'DELETE' THEN NEW.epic_id END
  ]) LOOP
    SELECT user_id INTO v_owner FROM public.epics WHERE id=v_id AND planning_mode='manual'
      AND user_id = CASE WHEN TG_OP='DELETE' THEN OLD.user_id ELSE NEW.user_id END FOR UPDATE;
    IF NOT FOUND THEN CONTINUE; END IF;
    v_progress := public.cosmiq_manual_item_progress(v_id,v_owner);
    UPDATE public.epics SET progress_percentage=v_progress, updated_at=now()
      WHERE id=v_id AND user_id=v_owner AND progress_percentage IS DISTINCT FROM v_progress;
  END LOOP;
  RETURN COALESCE(NEW,OLD);
END;
$$;

DROP TRIGGER refresh_manual_campaign_progress ON public.daily_tasks;
CREATE TRIGGER refresh_manual_campaign_progress AFTER INSERT OR DELETE OR UPDATE OF completed,epic_id,manual_series_id,habit_source_id,parent_template_id,is_recurring,recurrence_override,task_date,task_text,scheduled_time,schedule_end_time,schedule_timezone,estimated_duration,notes,location,difficulty,category,priority,flexibility,contact_id,reminder_enabled,reminder_minutes_before,reminder_offsets_minutes ON public.daily_tasks
FOR EACH ROW EXECUTE FUNCTION public.refresh_manual_campaign_progress();

CREATE OR REPLACE FUNCTION public.create_manual_campaign(p_plan jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE
  v_user uuid := auth.uid();
  v_id uuid := (p_plan->>'id')::uuid;
  v_start date := (p_plan->>'start_date')::date;
  v_end date := (p_plan->>'end_date')::date;
  v_task jsonb;
  v_index integer := 0;
  v_existing public.epics;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'Sign in before saving your campaign.'; END IF;
  IF v_id IS NULL OR v_start IS NULL OR v_end IS NULL OR v_end < v_start OR v_end - v_start > 730
    OR length(trim(COALESCE(p_plan->>'title',''))) NOT BETWEEN 1 AND 120
    OR length(COALESCE(p_plan->>'description','')) > 2000 THEN
    RAISE EXCEPTION 'Check the campaign name and dates.';
  END IF;
  IF jsonb_typeof(p_plan->'tasks') IS DISTINCT FROM 'array' THEN RAISE EXCEPTION 'Add scheduled tasks.'; END IF;
  IF jsonb_array_length(p_plan->'tasks') NOT BETWEEN 1 AND 100 THEN RAISE EXCEPTION 'Choose between 1 and 100 scheduled tasks.'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('manual-campaign:' || v_user::text, 0));
  SELECT * INTO v_existing FROM public.epics WHERE id = v_id AND user_id = v_user;
  IF FOUND THEN
    IF v_existing.planning_mode <> 'manual' OR v_existing.title <> trim(p_plan->>'title')
      OR v_existing.start_date <> v_start OR v_existing.end_date <> v_end
      OR COALESCE(v_existing.description,'') <> COALESCE(p_plan->>'description','')
      OR (SELECT count(*) FROM public.daily_tasks WHERE epic_id = v_id AND user_id = v_user) <> jsonb_array_length(p_plan->'tasks')
      OR EXISTS (
        SELECT 1 FROM jsonb_array_elements(p_plan->'tasks') WITH ORDINALITY AS item(task, position)
        WHERE NOT EXISTS (SELECT 1 FROM public.daily_tasks t WHERE t.epic_id = v_id AND t.user_id = v_user
          AND (NOT item.task ? 'manual_series_id' OR t.manual_series_id IS NOT DISTINCT FROM (item.task->>'manual_series_id')::uuid)
          AND t.sort_order = item.position - 1 AND t.task_text = trim(item.task->>'title')
          AND t.task_date = (item.task->>'date')::date AND t.scheduled_time = (item.task->>'time')::time
          AND t.estimated_duration = (item.task->>'minutes')::integer AND COALESCE(t.notes,'') = COALESCE(item.task->>'notes',''))
      ) THEN RAISE EXCEPTION 'This campaign was already saved. Open it in Goals to view it and edit its quests in Agenda.'; END IF;
  ELSE
    IF public.count_user_epics(v_user) >= 5 THEN RAISE EXCEPTION 'You can only have 5 active campaigns at a time.'; END IF;
    INSERT INTO public.epics(id, user_id, title, description, start_date, end_date, target_days, planning_mode, theme_color, is_public, xp_reward)
    VALUES (v_id, v_user, trim(p_plan->>'title'), nullif(p_plan->>'description',''), v_start, v_end,
      greatest(1, v_end - v_start), 'manual', 'nature', false, 100);
    FOR v_task IN SELECT value FROM jsonb_array_elements(p_plan->'tasks') LOOP
      IF length(trim(COALESCE(v_task->>'title',''))) NOT BETWEEN 1 AND 240
        OR length(COALESCE(v_task->>'notes','')) > 2000
        OR (v_task->>'date') IS NULL OR (v_task->>'date')::date NOT BETWEEN v_start AND v_end
        OR COALESCE(v_task->>'time','') !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
        OR (v_task->>'minutes') IS NULL OR (v_task->>'minutes')::integer NOT BETWEEN 1 AND 1440 THEN
        RAISE EXCEPTION 'Every task needs a name, date, time, and duration.';
      END IF;
      INSERT INTO public.daily_tasks(user_id, epic_id, task_text, task_date, scheduled_time, estimated_duration,
        manual_series_id, notes, sort_order, difficulty, xp_reward, completed, is_main_quest, ai_generated, source, flexibility, is_recurring, reminder_enabled)
      VALUES (v_user, v_id, trim(v_task->>'title'), (v_task->>'date')::date, (v_task->>'time')::time,
        (v_task->>'minutes')::integer, (v_task->>'manual_series_id')::uuid, nullif(v_task->>'notes',''), v_index, 'medium', 16, false, false, false, 'manual', 'fixed', false, false);
      v_index := v_index + 1;
    END LOOP;
  END IF;
  RETURN jsonb_build_object('epic', (SELECT to_jsonb(e) FROM public.epics e WHERE id = v_id AND user_id = v_user),
    'tasks', (SELECT COALESCE(jsonb_agg(to_jsonb(t) ORDER BY sort_order), '[]'::jsonb) FROM public.daily_tasks t WHERE epic_id = v_id AND user_id = v_user));
END;
$$;

NOTIFY pgrst,'reload schema';
COMMIT;
