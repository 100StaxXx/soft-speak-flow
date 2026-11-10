-- Unify COSMIQ time blocks with the existing quest table. Legacy records remain as a read-only archive.
ALTER TABLE public.daily_tasks ADD COLUMN IF NOT EXISTS schedule_timezone text;
ALTER TABLE public.daily_tasks ADD COLUMN IF NOT EXISTS schedule_end_time time;
ALTER TABLE public.daily_tasks ADD COLUMN IF NOT EXISTS recurrence_override boolean NOT NULL DEFAULT false;
CREATE TABLE public.cosmiq_commitment_quest_archive (
 user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE, block_id text NOT NULL,
 task_id uuid NOT NULL, original_block jsonb NOT NULL, timezone text NOT NULL,
 migrated_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(user_id,block_id)
);
ALTER TABLE public.cosmiq_commitment_quest_archive ENABLE ROW LEVEL SECURITY;
CREATE POLICY owner_read ON public.cosmiq_commitment_quest_archive FOR SELECT TO authenticated USING(user_id=auth.uid());
REVOKE ALL ON public.cosmiq_commitment_quest_archive FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.cosmiq_commitment_quest_archive TO authenticated;
GRANT ALL ON public.cosmiq_commitment_quest_archive TO service_role;
LOCK TABLE public.cosmiq_commitment_schedules, public.cosmiq_commitment_check_offs IN EXCLUSIVE MODE;
DO $$
DECLARE s record; b jsonb; first_day date; task_id uuid; history public.cosmiq_commitment_check_offs; minutes int;
BEGIN
 FOR s IN SELECT cs.* FROM public.cosmiq_commitment_schedules cs WHERE EXISTS(SELECT 1 FROM public.user_companion c WHERE c.user_id=cs.user_id AND c.product_mode='cosmiq') LOOP
  FOR b IN SELECT value FROM jsonb_array_elements(s.blocks) LOOP
   first_day:=(b->>'starts_on')::date;
   IF b->>'repeat'='weekly' THEN
    WHILE NOT (b->'days' @> jsonb_build_array(extract(dow FROM first_day)::int)) LOOP first_day:=first_day+1; END LOOP;
   END IF;
   SELECT * INTO history FROM public.cosmiq_commitment_check_offs WHERE user_id=s.user_id AND block_id=b->>'id' AND occurrence_date=first_day;
   task_id:=coalesce(history.id,gen_random_uuid());
   minutes:=round(extract(epoch FROM ((b->>'end')::time-(b->>'start')::time))/60)::int;
   IF minutes<=0 THEN minutes:=minutes+1440; END IF;
   INSERT INTO public.cosmiq_commitment_quest_archive(user_id,block_id,task_id,original_block,timezone) VALUES(s.user_id,b->>'id',task_id,b,s.timezone);
   INSERT INTO public.daily_tasks(id,user_id,task_text,task_date,scheduled_time,estimated_duration,schedule_timezone,schedule_end_time,
     is_recurring,recurrence_pattern,recurrence_days,recurrence_end_date,difficulty,xp_reward,source,completed,completed_at,flexibility,must_calendar_block,excluded_from_planner_at)
   VALUES(task_id,s.user_id,b->>'title',first_day,(b->>'start')::time,minutes,s.timezone,(b->>'end')::time,
    b->>'repeat'='weekly',CASE WHEN b->>'repeat'='weekly' THEN 'custom' END,
    CASE WHEN b->>'repeat'='weekly' THEN ARRAY(SELECT (value::int+6)%7 FROM jsonb_array_elements_text(b->'days') ORDER BY (value::int+6)%7) END,
    (b->>'ends_on')::date,'easy',10,'manual',coalesce(history.completed,false),history.completed_at,'fixed',true,
    CASE WHEN (b->>'ends_on')::date<first_day THEN now() END);
  END LOOP;
 END LOOP;
 -- Every historical check-off keeps its own UUID, including blocks subsequently removed from the old schedule.
 FOR history IN SELECT co.* FROM public.cosmiq_commitment_check_offs co WHERE EXISTS(SELECT 1 FROM public.user_companion c WHERE c.user_id=co.user_id AND c.product_mode='cosmiq') LOOP
  IF NOT EXISTS(SELECT 1 FROM public.daily_tasks WHERE id=history.id) THEN
   SELECT a.task_id INTO task_id FROM public.cosmiq_commitment_quest_archive a WHERE a.user_id=history.user_id AND a.block_id=history.block_id;
   INSERT INTO public.daily_tasks(id,user_id,task_text,task_date,scheduled_time,estimated_duration,schedule_timezone,schedule_end_time,parent_template_id,
     is_recurring,difficulty,xp_reward,source,completed,completed_at,flexibility,must_calendar_block,recurrence_override)
   VALUES(history.id,history.user_id,history.title,history.occurrence_date,(history.starts_at AT TIME ZONE history.timezone)::time,
    round(extract(epoch FROM history.ends_at-history.starts_at)/60)::int,history.timezone,(history.ends_at AT TIME ZONE history.timezone)::time,
    task_id,false,'easy',10,'recurring',history.completed,history.completed_at,'fixed',true,true);
  END IF;
 END LOOP;
END $$;
-- Preserve reward amounts, timestamps and idempotency receipts; attach their quest identity so replay and Undo see the existing award.
UPDATE public.xp_events x SET event_metadata=x.event_metadata||jsonb_build_object('task_id',co.id,'legacy_event_type',x.event_type),
 event_type=CASE WHEN x.event_type='commitment_complete' THEN 'task_complete' ELSE 'task_undo' END
FROM public.cosmiq_commitment_check_offs co WHERE x.user_id=co.user_id AND x.event_metadata->>'commitment_id'=co.id::text
 AND x.event_type IN ('commitment_complete','commitment_undo') AND EXISTS(SELECT 1 FROM public.daily_tasks t WHERE t.id=co.id AND t.user_id=co.user_id);
-- Already published evidence keeps its old identity in the book; the alias prevents a second chapter credit.
INSERT INTO public.cosmiq_episode_facts(user_id,fact_id,episode_id)
 SELECT f.user_id,'quest:'||co.id,f.episode_id FROM public.cosmiq_episode_facts f
 JOIN public.cosmiq_commitment_check_offs co ON f.user_id=co.user_id AND f.fact_id='commitment:'||co.id
 ON CONFLICT DO NOTHING;
-- Remove the legacy evidence union. Confirm exact source before changing the queue.
DO $$ DECLARE definition text; first_pos int; end_pos int; BEGIN
 definition:=pg_get_functiondef('public.cosmiq_queue_episode(uuid,boolean)'::regprocedure);
 first_pos:=strpos(definition,E' UNION ALL\n SELECT jsonb_build_object(\'id\',\'commitment:\'');
 IF first_pos=0 THEN RAISE EXCEPTION 'Legacy chapter evidence changed'; END IF;
 end_pos:=strpos(substr(definition,first_pos),' ) verified;');
 IF end_pos=0 THEN RAISE EXCEPTION 'Chapter evidence boundary changed'; END IF;
 EXECUTE substr(definition,1,first_pos-1)||substr(definition,first_pos+end_pos-1);
END $$;
ALTER TABLE public.cosmiq_commitment_schedules ADD COLUMN archived_blocks jsonb;
UPDATE public.cosmiq_commitment_schedules SET archived_blocks=blocks,blocks='[]'::jsonb
 WHERE EXISTS(SELECT 1 FROM public.user_companion c WHERE c.user_id=cosmiq_commitment_schedules.user_id AND c.product_mode='cosmiq');
REVOKE INSERT,UPDATE,DELETE ON public.cosmiq_commitment_schedules FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.cosmiq_set_commitment_completion(text,date,boolean,integer) FROM PUBLIC,anon,authenticated;

-- Deleting one occurrence skips that day instead of silently respawning it.
CREATE TABLE public.cosmiq_quest_occurrence_skips (
 user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
 template_id uuid NOT NULL REFERENCES public.daily_tasks(id) ON DELETE CASCADE,
 occurrence_date date NOT NULL, PRIMARY KEY(user_id,template_id,occurrence_date)
);
ALTER TABLE public.cosmiq_quest_occurrence_skips ENABLE ROW LEVEL SECURITY;
CREATE POLICY owner_read ON public.cosmiq_quest_occurrence_skips FOR SELECT TO authenticated USING(user_id=auth.uid());
REVOKE ALL ON public.cosmiq_quest_occurrence_skips FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.cosmiq_quest_occurrence_skips TO authenticated;
GRANT ALL ON public.cosmiq_quest_occurrence_skips TO service_role;
-- Shared quest recurrence rules (Monday=0) and an idempotent day/range materializer.
CREATE FUNCTION public.cosmiq_quest_occurs(t public.daily_tasks,d date) RETURNS boolean LANGUAGE plpgsql STABLE SET search_path='' AS $$
DECLARE dow int:=(extract(dow FROM d)::int+6)%7; anchor date:=coalesce(t.task_date,t.created_at::date); last_day int;
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
REVOKE ALL ON FUNCTION public.cosmiq_quest_occurs(public.daily_tasks,date) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.cosmiq_quest_occurs(public.daily_tasks,date) TO authenticated,service_role;
CREATE FUNCTION public.cosmiq_materialize_quests(p_from date,p_through date) RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE uid uuid:=auth.uid(); t public.daily_tasks; d date; inserted int:=0; n int; minutes int;
BEGIN
 IF uid IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.user_companion WHERE user_id=uid AND product_mode='cosmiq') THEN RETURN 0; END IF;
 IF p_from IS NULL OR p_through IS NULL OR p_through<p_from OR p_through-p_from>65 THEN RAISE EXCEPTION 'Invalid quest date range'; END IF;
 PERFORM pg_advisory_xact_lock(hashtext(uid::text),hashtext('quest-recurrence'));
 FOR t IN SELECT * FROM public.daily_tasks WHERE user_id=uid AND is_recurring AND parent_template_id IS NULL AND scheduled_time IS NOT NULL AND excluded_from_planner_at IS NULL LOOP
  FOR d IN SELECT generate_series(p_from::timestamp,p_through::timestamp,interval '1 day')::date LOOP
   IF d=t.task_date OR NOT public.cosmiq_quest_occurs(t,d) OR EXISTS(SELECT 1 FROM public.cosmiq_quest_occurrence_skips WHERE user_id=uid AND template_id=t.id AND occurrence_date=d) THEN CONTINUE; END IF;
   minutes:=t.estimated_duration;
   IF t.schedule_timezone IS NOT NULL AND t.schedule_end_time IS NOT NULL THEN
    minutes:=greatest(1,round(extract(epoch FROM public.cosmiq_commitment_boundary(d+CASE WHEN t.schedule_end_time<t.scheduled_time THEN 1 ELSE 0 END,t.schedule_end_time,t.schedule_timezone,true)-public.cosmiq_commitment_boundary(d,t.scheduled_time,t.schedule_timezone,false))/60)::int);
   END IF;
   INSERT INTO public.daily_tasks(user_id,task_text,task_date,scheduled_time,estimated_duration,schedule_timezone,schedule_end_time,
     difficulty,xp_reward,category,parent_template_id,source,is_recurring,completed,epic_id,notes,location,flexibility,must_calendar_block,
     reminder_enabled,reminder_minutes_before,reminder_offsets_minutes,sort_order)
   VALUES(uid,t.task_text,d,t.scheduled_time,minutes,t.schedule_timezone,t.schedule_end_time,t.difficulty,t.xp_reward,t.category,t.id,'recurring',false,false,
     t.epic_id,t.notes,t.location,t.flexibility,t.must_calendar_block,t.reminder_enabled,t.reminder_minutes_before,t.reminder_offsets_minutes,t.sort_order)
   ON CONFLICT(user_id,task_date,parent_template_id) DO NOTHING;
   GET DIAGNOSTICS n=ROW_COUNT; inserted:=inserted+n;
  END LOOP;
 END LOOP;
 RETURN inserted;
END $$;
REVOKE ALL ON FUNCTION public.cosmiq_materialize_quests(date,date) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.cosmiq_materialize_quests(date,date) TO authenticated;
-- Occurrence edits stay local. A series edit refreshes only future, untouched, incomplete occurrences.
CREATE FUNCTION public.cosmiq_refresh_quest_series() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.user_companion WHERE user_id=coalesce(NEW.user_id,OLD.user_id) AND product_mode='cosmiq') THEN RETURN coalesce(NEW,OLD); END IF;
 IF TG_OP='INSERT' THEN
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
  IF OLD.is_recurring AND (NEW.task_text,NEW.scheduled_time,NEW.estimated_duration,NEW.recurrence_pattern,NEW.recurrence_days,NEW.recurrence_month_days,NEW.recurrence_custom_period,NEW.recurrence_end_date,NEW.flexibility,NEW.task_date) IS DISTINCT FROM (OLD.task_text,OLD.scheduled_time,OLD.estimated_duration,OLD.recurrence_pattern,OLD.recurrence_days,OLD.recurrence_month_days,OLD.recurrence_custom_period,OLD.recurrence_end_date,OLD.flexibility,OLD.task_date) THEN
   DELETE FROM public.daily_tasks WHERE parent_template_id=OLD.id AND user_id=OLD.user_id AND NOT completed AND NOT recurrence_override AND task_date>=CURRENT_DATE;
  END IF;
 END IF;
 RETURN CASE WHEN TG_OP='DELETE' THEN OLD ELSE NEW END;
END $$;
REVOKE ALL ON FUNCTION public.cosmiq_refresh_quest_series() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER cosmiq_refresh_quest_series BEFORE INSERT OR UPDATE OR DELETE ON public.daily_tasks FOR EACH ROW EXECUTE FUNCTION public.cosmiq_refresh_quest_series();
