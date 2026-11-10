-- Additive: existing campaigns, quests, milestones and completion history remain intact.
CREATE TABLE public.cosmiq_campaign_plans (
 epic_id uuid PRIMARY KEY REFERENCES public.epics(id) ON DELETE CASCADE,
 user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
 plan jsonb NOT NULL,
 updated_at timestamptz NOT NULL DEFAULT now(),
 CHECK (jsonb_typeof(plan)='object'),
 CHECK (plan->>'kind' IN ('reading','training','general')),
 CHECK (length(plan->>'outcome') BETWEEN 1 AND 500),
 CHECK (octet_length(plan::text)<8000)
);
CREATE TABLE public.cosmiq_campaign_reflections (
 epic_id uuid NOT NULL REFERENCES public.cosmiq_campaign_plans(epic_id) ON DELETE CASCADE,
 user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
 local_date date NOT NULL,
 answer text NOT NULL CHECK(length(answer) BETWEEN 1 AND 1200),
 measured_value numeric CHECK(measured_value>=0 AND measured_value<=10000000),
 skipped boolean NOT NULL DEFAULT false,
 created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(epic_id,local_date)
);
ALTER TABLE public.cosmiq_campaign_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cosmiq_campaign_reflections ENABLE ROW LEVEL SECURITY;
CREATE POLICY campaign_plan_owner ON public.cosmiq_campaign_plans FOR ALL TO authenticated
 USING(user_id=(SELECT auth.uid())) WITH CHECK(user_id=(SELECT auth.uid()) AND EXISTS(SELECT 1 FROM public.epics e WHERE e.id=epic_id AND e.user_id=(SELECT auth.uid())));
CREATE POLICY campaign_reflection_owner ON public.cosmiq_campaign_reflections FOR SELECT TO authenticated USING(user_id=(SELECT auth.uid()));
REVOKE ALL ON public.cosmiq_campaign_plans,public.cosmiq_campaign_reflections FROM anon,authenticated;
GRANT SELECT,INSERT,UPDATE ON public.cosmiq_campaign_plans TO authenticated;
GRANT SELECT ON public.cosmiq_campaign_reflections TO authenticated;
GRANT ALL ON public.cosmiq_campaign_plans,public.cosmiq_campaign_reflections TO service_role;
CREATE INDEX campaign_reflection_owner_date ON public.cosmiq_campaign_reflections(user_id,local_date DESC);
-- One atomic check-in per local day. Retrying cannot double-count a measurement.
CREATE FUNCTION public.save_cosmiq_campaign_reflection(p_epic uuid,p_date date,p_answer text,p_value numeric DEFAULT NULL,p_skip boolean DEFAULT false)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE owner_id uuid:=auth.uid(); saved_plan jsonb;
BEGIN
 IF owner_id IS NULL THEN RAISE EXCEPTION 'Sign in required'; END IF;
 SELECT p.plan INTO saved_plan FROM cosmiq_campaign_plans p JOIN epics e ON e.id=p.epic_id
 WHERE p.epic_id=p_epic AND p.user_id=owner_id AND e.user_id=owner_id AND e.status='active' FOR UPDATE OF p;
 IF NOT FOUND THEN RAISE EXCEPTION 'Active campaign required'; END IF;
 IF p_date IS NULL OR p_date<((now() AT TIME ZONE 'UTC')::date-1) OR p_date>((now() AT TIME ZONE 'UTC')::date+1) THEN RAISE EXCEPTION 'Current local day required'; END IF;
 IF p_value IS NOT NULL AND (p_skip OR p_value<0 OR p_value>10000000 OR length(coalesce(saved_plan->>'unit',''))=0) THEN RAISE EXCEPTION 'Invalid measurement'; END IF;
 INSERT INTO cosmiq_campaign_reflections(epic_id,user_id,local_date,answer,measured_value,skipped)
 VALUES(p_epic,owner_id,p_date,CASE WHEN p_skip THEN 'Skipped' ELSE trim(p_answer) END,p_value,p_skip)
 ON CONFLICT(epic_id,local_date) DO UPDATE SET answer=EXCLUDED.answer,measured_value=EXCLUDED.measured_value,skipped=EXCLUDED.skipped,created_at=now();
 IF p_value IS NOT NULL THEN UPDATE cosmiq_campaign_plans SET plan=jsonb_set(plan,'{current}',to_jsonb(p_value)),updated_at=now() WHERE epic_id=p_epic AND user_id=owner_id; END IF;
END $$;
REVOKE ALL ON FUNCTION public.save_cosmiq_campaign_reflection(uuid,date,text,numeric,boolean) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.save_cosmiq_campaign_reflection(uuid,date,text,numeric,boolean) TO authenticated;
