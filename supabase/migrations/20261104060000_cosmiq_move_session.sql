-- A template also represents the first session. Preserve its original cadence when that session moves.
ALTER TABLE public.daily_tasks ADD COLUMN session_series_anchor date;
CREATE OR REPLACE FUNCTION public.cosmiq_quest_occurs(t public.daily_tasks,d date) RETURNS boolean LANGUAGE plpgsql STABLE SET search_path='' AS $$
DECLARE dow int:=(extract(dow FROM d)::int+6)%7; anchor date:=coalesce(t.session_series_anchor,t.task_date,t.created_at::date); last_day int;
BEGIN
 IF d<anchor OR (t.recurrence_end_date IS NOT NULL AND d>t.recurrence_end_date) OR t.excluded_from_planner_at IS NOT NULL THEN RETURN false; END IF;
 IF d=anchor THEN RETURN true; END IF;
 IF NOT coalesce(t.is_recurring,false) THEN RETURN false; END IF;
 CASE t.recurrence_pattern
 WHEN 'daily' THEN RETURN true;
 WHEN 'weekdays' THEN RETURN dow<5;
 WHEN 'weekends' THEN RETURN dow>=5;
 WHEN 'weekly' THEN RETURN CASE WHEN coalesce(cardinality(t.recurrence_days),0)>0 THEN dow=ANY(t.recurrence_days) ELSE dow=(extract(dow FROM anchor)::int+6)%7 END;
 WHEN 'biweekly' THEN RETURN (d-anchor)%14=0;
 WHEN 'monthly' THEN NULL;
 WHEN 'custom' THEN IF coalesce(t.recurrence_custom_period,'week')<>'month' THEN RETURN dow=ANY(t.recurrence_days); END IF;
 ELSE RETURN false;
 END CASE;
 last_day:=extract(day FROM date_trunc('month',d)+interval '1 month -1 day');
 RETURN extract(day FROM d)::int=ANY(ARRAY(SELECT least(day,last_day) FROM unnest(CASE WHEN cardinality(t.recurrence_month_days)>0 THEN t.recurrence_month_days ELSE ARRAY[extract(day FROM anchor)::int] END) day));
END $$;

CREATE OR REPLACE FUNCTION public.cosmiq_refresh_quest_series() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.user_companion WHERE user_id=coalesce(NEW.user_id,OLD.user_id) AND product_mode='cosmiq') THEN RETURN coalesce(NEW,OLD); END IF;
 IF TG_OP='INSERT' THEN
  -- Older clients can attempt to spawn a session that has already moved.
  IF NEW.parent_template_id IS NOT NULL AND NOT coalesce(NEW.recurrence_override,false) AND EXISTS (
     SELECT 1 FROM public.daily_tasks t WHERE t.id=NEW.parent_template_id AND t.user_id=NEW.user_id
       AND t.session_series_anchor IS NOT NULL AND (NEW.task_date=t.task_date OR NOT public.cosmiq_quest_occurs(t,NEW.task_date)
       OR EXISTS(SELECT 1 FROM public.cosmiq_quest_occurrence_skips s WHERE s.user_id=t.user_id AND s.template_id=t.id AND s.occurrence_date=NEW.task_date))
  ) THEN RETURN NULL; END IF;
  IF NEW.schedule_timezone IS NOT NULL AND NEW.schedule_end_time IS NULL AND NEW.scheduled_time IS NOT NULL THEN NEW.schedule_end_time:=(NEW.scheduled_time+make_interval(mins=>coalesce(NEW.estimated_duration,30)))::time; END IF;
  RETURN NEW;
 END IF;
 IF TG_OP='DELETE' AND OLD.parent_template_id IS NOT NULL AND pg_trigger_depth()=1 THEN
  INSERT INTO public.cosmiq_quest_occurrence_skips(user_id,template_id,occurrence_date) VALUES(OLD.user_id,OLD.parent_template_id,OLD.task_date) ON CONFLICT DO NOTHING;
 END IF;
 IF TG_OP='DELETE' AND OLD.is_recurring THEN
  DELETE FROM public.daily_tasks WHERE parent_template_id=OLD.id AND user_id=OLD.user_id AND NOT completed AND NOT recurrence_override AND task_date>=CURRENT_DATE;
 ELSIF TG_OP='UPDATE' THEN
  IF OLD.parent_template_id IS NOT NULL AND NEW.task_date IS DISTINCT FROM OLD.task_date THEN
   INSERT INTO public.cosmiq_quest_occurrence_skips(user_id,template_id,occurrence_date) VALUES(OLD.user_id,OLD.parent_template_id,OLD.task_date) ON CONFLICT DO NOTHING;
  END IF;
  IF NEW.schedule_timezone IS NOT NULL AND (NEW.scheduled_time,NEW.estimated_duration) IS DISTINCT FROM (OLD.scheduled_time,OLD.estimated_duration) THEN NEW.schedule_end_time:=(NEW.scheduled_time+make_interval(mins=>coalesce(NEW.estimated_duration,30)))::time; END IF;
  IF NEW.parent_template_id IS NOT NULL AND (NEW.task_text,NEW.scheduled_time,NEW.estimated_duration,NEW.task_date,NEW.flexibility) IS DISTINCT FROM (OLD.task_text,OLD.scheduled_time,OLD.estimated_duration,OLD.task_date,OLD.flexibility) THEN NEW.recurrence_override:=true; END IF;
  IF OLD.is_recurring AND NEW.task_date IS DISTINCT FROM OLD.task_date THEN
   IF current_setting('cosmiq.single_session_id',true)=OLD.id::text THEN RETURN NEW; END IF;
   NEW.session_series_anchor:=NULL;
  END IF;
  IF OLD.is_recurring AND (NEW.task_text,NEW.scheduled_time,NEW.estimated_duration,NEW.recurrence_pattern,NEW.recurrence_days,NEW.recurrence_month_days,NEW.recurrence_custom_period,NEW.recurrence_end_date,NEW.flexibility,NEW.task_date) IS DISTINCT FROM (OLD.task_text,OLD.scheduled_time,OLD.estimated_duration,OLD.recurrence_pattern,OLD.recurrence_days,OLD.recurrence_month_days,OLD.recurrence_custom_period,OLD.recurrence_end_date,OLD.flexibility,OLD.task_date) THEN
   DELETE FROM public.daily_tasks WHERE parent_template_id=OLD.id AND user_id=OLD.user_id AND NOT completed AND NOT recurrence_override AND task_date>=CURRENT_DATE;
  END IF;
 END IF;
 RETURN CASE WHEN TG_OP='DELETE' THEN OLD ELSE NEW END;
END $$;

-- Check the same week and month rules used by ritualScheduledOnDate, even if the
-- other session has not been added to daily_tasks yet.
CREATE FUNCTION public.cosmiq_ritual_due_on(h public.habits, d date)
RETURNS boolean LANGUAGE plpgsql STABLE SET search_path='' AS $$
DECLARE
 settings jsonb:=h.ritual_settings;
 schedule jsonb;
 exceptions jsonb:=settings->'exceptions';
 days jsonb;
 month_days jsonb;
 dow integer:=extract(isodow FROM d)::int-1;
BEGIN
 SELECT value INTO schedule FROM jsonb_array_elements(coalesce(settings->'history','[]')) WHERE value->>'from'<=d::text
 ORDER BY value->>'from' DESC LIMIT 1;
 IF coalesce((coalesce(schedule,settings)->>'paused')::boolean,false) THEN RETURN false; END IF;
 IF exceptions->d::text->>'kind' IN ('skip','move') THEN RETURN false; END IF;
 IF EXISTS(SELECT 1 FROM jsonb_each(exceptions) WHERE value->>'kind'='move' AND value->>'to'=d::text) THEN RETURN true; END IF;
 schedule:=coalesce(schedule,to_jsonb(h));
 days:=coalesce(nullif(schedule->'custom_days','null'),'[]');
 month_days:=coalesce(nullif(schedule->'custom_month_days','null'),'[]');
 CASE lower(schedule->>'frequency')
 WHEN 'weekly' THEN RETURN dow=coalesce((days->>0)::int,0);
 WHEN 'weekdays','5x_week' THEN RETURN dow<5;
 WHEN 'weekends' THEN RETURN dow>=5;
 WHEN '3x_week' THEN RETURN (CASE WHEN days='[]' THEN '[0,2,4]'::jsonb ELSE days END) @> to_jsonb(dow);
 WHEN 'custom' THEN
  IF coalesce(schedule->>'customPeriod',CASE WHEN month_days='[]' THEN 'week' ELSE 'month' END)<>'month' THEN RETURN days @> to_jsonb(dow); END IF;
 WHEN 'monthly' THEN NULL;
 ELSE RETURN true;
 END CASE;
 RETURN EXISTS(SELECT 1 FROM jsonb_array_elements_text(CASE WHEN month_days='[]' THEN '[1]'::jsonb ELSE month_days END)
   WHERE least(greatest(1,value::int),extract(day FROM date_trunc('month',d)+interval '1 month - 1 day')::int)=extract(day FROM d));
END $$;
REVOKE ALL ON FUNCTION public.cosmiq_ritual_due_on(public.habits,date) FROM PUBLIC,anon,authenticated;

CREATE FUNCTION public.cosmiq_move_session(p_id uuid,p_from date,p_to date)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE
 uid uuid:=auth.uid();
 task public.daily_tasks;
 template public.daily_tasks;
 habit public.habits;
 exceptions jsonb;
 origin text;
BEGIN
 IF uid IS NULL OR NOT EXISTS(SELECT 1 FROM public.user_companion WHERE user_id=uid AND product_mode='cosmiq')
 THEN RAISE EXCEPTION 'Session unavailable'; END IF;
 IF p_to IS NULL OR p_from IS NULL OR p_from=p_to THEN RAISE EXCEPTION 'Choose another date'; END IF;
 PERFORM pg_advisory_xact_lock(hashtext(uid::text),hashtext('quest-recurrence'));
 SELECT * INTO task FROM public.daily_tasks WHERE id=p_id AND user_id=uid FOR UPDATE;
 IF NOT FOUND OR task.task_date IS DISTINCT FROM p_from OR task.completed OR task.excluded_from_planner_at IS NOT NULL
 THEN RAISE EXCEPTION 'Session changed'; END IF;

 IF task.habit_source_id IS NOT NULL THEN
  SELECT * INTO habit FROM public.habits WHERE id=task.habit_source_id AND user_id=uid FOR UPDATE;
  IF NOT FOUND OR NOT coalesce(habit.is_active,true) THEN RAISE EXCEPTION 'Session unavailable'; END IF;
  IF public.cosmiq_ritual_due_on(habit,p_to) THEN RAISE EXCEPTION 'Session date occupied'; END IF;
  IF EXISTS(SELECT 1 FROM public.habit_completions WHERE user_id=uid AND habit_id=habit.id AND date IN(p_from,p_to))
    OR EXISTS(SELECT 1 FROM public.daily_tasks WHERE user_id=uid AND habit_source_id=habit.id AND task_date=p_to)
  THEN RAISE EXCEPTION 'Session date occupied'; END IF;
  exceptions:=coalesce(habit.ritual_settings->'exceptions','{}'::jsonb);
  SELECT key INTO origin FROM jsonb_each(exceptions) WHERE value->>'kind'='move' AND value->>'to'=p_from::text;
  origin:=coalesce(origin,p_from::text);
  IF origin=p_to::text THEN exceptions:=exceptions-origin;
  ELSE
   IF exceptions ? p_to::text THEN RAISE EXCEPTION 'Session date occupied'; END IF;
   exceptions:=jsonb_set(exceptions,ARRAY[origin],jsonb_build_object('kind','move','to',p_to));
  END IF;
  habit.ritual_settings:=jsonb_set(coalesce(habit.ritual_settings,'{}'::jsonb),'{exceptions}',exceptions);
  IF NOT public.cosmiq_ritual_due_on(habit,p_to) THEN RAISE EXCEPTION 'Session unavailable'; END IF;
  UPDATE public.habits SET ritual_settings=habit.ritual_settings WHERE id=habit.id AND user_id=uid;
 ELSIF task.parent_template_id IS NOT NULL OR task.is_recurring THEN
  SELECT * INTO template FROM public.daily_tasks WHERE id=coalesce(task.parent_template_id,task.id) AND user_id=uid FOR UPDATE;
  IF NOT FOUND OR NOT coalesce(template.is_recurring,false) THEN RAISE EXCEPTION 'Session unavailable'; END IF;
  IF EXISTS(SELECT 1 FROM public.daily_tasks WHERE user_id=uid AND (id=template.id OR parent_template_id=template.id) AND task_date=p_to)
    OR (public.cosmiq_quest_occurs(template,p_to) AND NOT EXISTS(SELECT 1 FROM public.cosmiq_quest_occurrence_skips
       WHERE user_id=uid AND template_id=template.id AND occurrence_date=p_to))
  THEN RAISE EXCEPTION 'Session date occupied'; END IF;
  UPDATE public.daily_tasks SET session_series_anchor=coalesce(task_date,created_at::date) WHERE id=template.id AND session_series_anchor IS NULL;
  INSERT INTO public.cosmiq_quest_occurrence_skips(user_id,template_id,occurrence_date)
    VALUES(uid,template.id,p_from) ON CONFLICT DO NOTHING;
  PERFORM set_config('cosmiq.single_session_id',task.id::text,true);
 ELSIF task.manual_series_id IS NOT NULL THEN
  IF EXISTS(SELECT 1 FROM public.daily_tasks WHERE user_id=uid AND manual_series_id=task.manual_series_id AND task_date=p_to)
  THEN RAISE EXCEPTION 'Session date occupied'; END IF;
 ELSE RAISE EXCEPTION 'Session unavailable';
 END IF;
 UPDATE public.daily_tasks SET task_date=p_to,recurrence_override=true WHERE id=p_id AND user_id=uid;
 PERFORM set_config('cosmiq.single_session_id','',true);
END $$;
REVOKE ALL ON FUNCTION public.cosmiq_move_session(uuid,date,date) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.cosmiq_move_session(uuid,date,date) TO authenticated;
