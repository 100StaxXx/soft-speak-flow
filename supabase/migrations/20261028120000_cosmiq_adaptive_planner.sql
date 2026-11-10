-- COSMIQ-only preference and feedback stores. No changes to shared profile JSON.
CREATE TABLE public.cosmiq_planner_preferences (
 user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
 interests text[] NOT NULL DEFAULT '{}', aspirations text[] NOT NULL DEFAULT '{}',
 excluded_interests text[] NOT NULL DEFAULT '{}', explicit_preferences text[] NOT NULL DEFAULT '{}',
 learning_enabled boolean NOT NULL DEFAULT true, learning_since timestamptz NOT NULL DEFAULT now(),
 forgotten_patterns text[] NOT NULL DEFAULT '{}', reviewed_at timestamptz,
 CHECK (cardinality(interests)<=100 AND cardinality(aspirations)<=100 AND cardinality(explicit_preferences)<=50),
 CHECK (octet_length(interests::text)+octet_length(aspirations::text)+octet_length(explicit_preferences::text)+octet_length(excluded_interests::text)+octet_length(forgotten_patterns::text)<30000)
);
CREATE TABLE public.cosmiq_planner_events (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
 kind text NOT NULL CHECK(kind IN ('accepted','edited','completed','uncompleted','dismissed','swapped')),
 task_id uuid, proposal_id text, title text NOT NULL CHECK(length(title)<=160),
 task_date date, before_time text, after_time text, before_duration integer, after_duration integer,
 reason text CHECK(reason IN ('not_today','wrong_time','too_long','not_interested') OR reason IS NULL),
 created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(user_id,proposal_id,kind)
);
CREATE INDEX cosmiq_planner_events_owner_time ON public.cosmiq_planner_events(user_id,created_at DESC);
ALTER TABLE public.cosmiq_planner_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cosmiq_planner_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY planner_preference_owner ON public.cosmiq_planner_preferences FOR ALL TO authenticated
 USING(user_id=(SELECT auth.uid())) WITH CHECK(user_id=(SELECT auth.uid()));
CREATE POLICY planner_event_read ON public.cosmiq_planner_events FOR SELECT TO authenticated USING(user_id=(SELECT auth.uid()));
CREATE POLICY planner_event_delete ON public.cosmiq_planner_events FOR DELETE TO authenticated USING(user_id=(SELECT auth.uid()));
CREATE POLICY planner_event_insert ON public.cosmiq_planner_events FOR INSERT TO authenticated WITH CHECK(
 user_id=(SELECT auth.uid()) AND EXISTS(SELECT 1 FROM public.cosmiq_planner_preferences p WHERE p.user_id=(SELECT auth.uid()) AND p.learning_enabled)
 AND (task_id IS NULL OR EXISTS(SELECT 1 FROM public.daily_tasks t WHERE t.id=task_id AND t.user_id=(SELECT auth.uid())))
);
REVOKE ALL ON public.cosmiq_planner_preferences,public.cosmiq_planner_events FROM anon;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.cosmiq_planner_preferences TO authenticated;
GRANT SELECT,INSERT,DELETE ON public.cosmiq_planner_events TO authenticated;
GRANT ALL ON public.cosmiq_planner_preferences,public.cosmiq_planner_events TO service_role;
-- Observe real task edits/completions, including Agenda and offline sync. Never infer duration from completion time.
CREATE FUNCTION public.cosmiq_observe_planner_task() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.cosmiq_planner_preferences WHERE user_id=NEW.user_id AND learning_enabled)
 OR NOT EXISTS(SELECT 1 FROM public.user_companion WHERE user_id=NEW.user_id AND product_mode='cosmiq') THEN RETURN NEW; END IF;
 IF NEW.scheduled_time IS DISTINCT FROM OLD.scheduled_time OR NEW.estimated_duration IS DISTINCT FROM OLD.estimated_duration THEN
 INSERT INTO public.cosmiq_planner_events(user_id,kind,task_id,title,task_date,before_time,after_time,before_duration,after_duration)
 VALUES(NEW.user_id,'edited',NEW.id,left(NEW.task_text,160),NEW.task_date,OLD.scheduled_time::text,NEW.scheduled_time::text,OLD.estimated_duration,NEW.estimated_duration);
 END IF;
 IF NEW.completed IS DISTINCT FROM OLD.completed THEN
 INSERT INTO public.cosmiq_planner_events(user_id,kind,task_id,title,task_date,after_time,after_duration)
 VALUES(NEW.user_id,CASE WHEN NEW.completed THEN 'completed' ELSE 'uncompleted' END,NEW.id,left(NEW.task_text,160),NEW.task_date,NEW.scheduled_time::text,NEW.estimated_duration);
 END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.cosmiq_observe_planner_task() FROM PUBLIC;
CREATE TRIGGER cosmiq_planner_task_observation AFTER UPDATE OF scheduled_time,estimated_duration,completed ON public.daily_tasks
 FOR EACH ROW EXECUTE FUNCTION public.cosmiq_observe_planner_task();
