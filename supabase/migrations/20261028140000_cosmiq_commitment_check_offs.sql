-- COSMIQ-only commitment completion. Reserved intervals remain unchanged.
CREATE FUNCTION public.cosmiq_valid_commitment_tracking(blocks jsonb)
RETURNS boolean LANGUAGE sql IMMUTABLE SET search_path = '' AS $$
 SELECT coalesce(bool_and(NOT (b ? 'track_completion') OR jsonb_typeof(b->'track_completion')='boolean'),true)
 FROM jsonb_array_elements(blocks) b;
$$;
ALTER TABLE public.cosmiq_commitment_schedules ADD CONSTRAINT commitment_tracking_boolean
 CHECK (public.cosmiq_valid_commitment_tracking(blocks));

CREATE TABLE public.cosmiq_commitment_check_offs (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
 block_id text NOT NULL CHECK(length(block_id) BETWEEN 1 AND 100),
 occurrence_date date NOT NULL,
 title text NOT NULL,
 kind text NOT NULL CHECK(kind IN ('work','school','commute','other')),
 timezone text NOT NULL,
 starts_at timestamptz NOT NULL, ends_at timestamptz NOT NULL,
 completed boolean NOT NULL DEFAULT false,
 completed_at timestamptz,
 xp_awarded integer NOT NULL DEFAULT 0 CHECK(xp_awarded BETWEEN 0 AND 10),
 revision integer NOT NULL DEFAULT 0 CHECK(revision>=0),
 updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(user_id,block_id,occurrence_date),
 CHECK(ends_at>starts_at), CHECK((completed AND completed_at IS NOT NULL) OR (NOT completed AND completed_at IS NULL))
);
CREATE INDEX cosmiq_completed_commitments ON public.cosmiq_commitment_check_offs(user_id,completed_at) WHERE completed;
ALTER TABLE public.cosmiq_commitment_check_offs ENABLE ROW LEVEL SECURITY;
CREATE POLICY commitment_check_off_owner_read ON public.cosmiq_commitment_check_offs FOR SELECT TO authenticated
 USING(user_id=(SELECT auth.uid()));
REVOKE ALL ON public.cosmiq_commitment_check_offs FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.cosmiq_commitment_check_offs TO authenticated;
GRANT ALL ON public.cosmiq_commitment_check_offs TO service_role;

-- Match the calendar's conservative DST boundaries: the first copy of a
-- folded start, last copy of a folded end, and the nearest real gap boundary.
CREATE FUNCTION public.cosmiq_commitment_boundary(p_date date,p_time time,p_timezone text,p_end boolean)
RETURNS timestamptz LANGUAGE plpgsql STABLE SET search_path = '' AS $$
DECLARE wall timestamp:=p_date+p_time; candidate timestamptz; result timestamptz; adjusted timestamp; offset_minutes integer;
BEGIN
 result:=wall AT TIME ZONE p_timezone;
 IF result AT TIME ZONE p_timezone<>wall THEN
   FOR offset_minutes IN 1..180 LOOP
     adjusted:=wall+make_interval(mins=>CASE WHEN p_end THEN offset_minutes ELSE -offset_minutes END);
     candidate:=adjusted AT TIME ZONE p_timezone;
     IF candidate AT TIME ZONE p_timezone=adjusted THEN result:=candidate; wall:=adjusted; EXIT; END IF;
   END LOOP;
 END IF;
 FOREACH offset_minutes IN ARRAY ARRAY[-120,-90,-60,-30,0,30,60,90,120] LOOP
   candidate:=(wall AT TIME ZONE p_timezone)+make_interval(mins=>offset_minutes);
   IF candidate AT TIME ZONE p_timezone=wall THEN result:=CASE WHEN p_end THEN greatest(result,candidate) ELSE least(result,candidate) END; END IF;
 END LOOP;
 RETURN result;
END $$;
REVOKE ALL ON FUNCTION public.cosmiq_commitment_boundary(date,time,text,boolean) FROM PUBLIC,anon,authenticated;

CREATE FUNCTION public.cosmiq_set_commitment_completion(p_block_id text,p_occurrence_date date,p_completed boolean,p_expected_revision integer DEFAULT 0)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
 uid uuid:=auth.uid(); schedule public.cosmiq_commitment_schedules;
 item jsonb; saved public.cosmiq_commitment_check_offs;
 starts timestamptz; ends timestamptz; delta integer:=0; reward record;
BEGIN
 IF uid IS NULL THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE='42501'; END IF;
 IF p_block_id IS NULL OR p_occurrence_date IS NULL OR p_completed IS NULL OR p_expected_revision IS NULL OR p_expected_revision<0 THEN RAISE EXCEPTION 'Invalid check-off'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.user_companion WHERE user_id=uid AND product_mode='cosmiq') THEN
   RAISE EXCEPTION 'COSMIQ companion required' USING ERRCODE='42501'; END IF;
 -- Match the nightly queue lock so a check-off cannot be half-captured at close.
 PERFORM 1 FROM public.cosmiq_episode_preferences WHERE user_id=uid FOR UPDATE;
 PERFORM pg_advisory_xact_lock(hashtext(uid::text),hashtext('commitment:'||p_block_id||':'||p_occurrence_date::text));
 SELECT * INTO saved FROM public.cosmiq_commitment_check_offs WHERE user_id=uid AND block_id=p_block_id AND occurrence_date=p_occurrence_date FOR UPDATE;
 IF coalesce(saved.revision,0)<>p_expected_revision THEN
   RAISE EXCEPTION 'Check-off changed; reload before continuing' USING ERRCODE='40001'; END IF;
 IF saved.id IS NOT NULL AND saved.completed=p_completed THEN RETURN to_jsonb(saved); END IF;
 IF p_completed THEN
   SELECT * INTO schedule FROM public.cosmiq_commitment_schedules WHERE user_id=uid FOR SHARE;
   SELECT b INTO item FROM jsonb_array_elements(schedule.blocks) b WHERE b->>'id'=p_block_id;
   IF item IS NULL OR item->'track_completion' IS DISTINCT FROM 'true'::jsonb THEN RAISE EXCEPTION 'Completion tracking is not enabled'; END IF;
   IF p_occurrence_date<(item->>'starts_on')::date OR (item->>'ends_on' IS NOT NULL AND p_occurrence_date>(item->>'ends_on')::date)
      OR (item->>'repeat'='once' AND p_occurrence_date<>(item->>'starts_on')::date)
      OR (item->>'repeat'='weekly' AND NOT (item->'days' @> jsonb_build_array(extract(dow FROM p_occurrence_date)::integer))) THEN
      RAISE EXCEPTION 'This block does not occur on that date'; END IF;
   starts:=public.cosmiq_commitment_boundary(p_occurrence_date,(item->>'start')::time,schedule.timezone,false);
   ends:=public.cosmiq_commitment_boundary(p_occurrence_date+CASE WHEN item->>'end'<item->>'start' THEN 1 ELSE 0 END,(item->>'end')::time,schedule.timezone,true);
   IF starts>now() OR ends<=starts THEN RAISE EXCEPTION 'This commitment has not started'; END IF;
   IF saved.id IS NULL THEN
     INSERT INTO public.cosmiq_commitment_check_offs(user_id,block_id,occurrence_date,title,kind,timezone,starts_at,ends_at)
       VALUES(uid,p_block_id,p_occurrence_date,item->>'title',item->>'kind',schedule.timezone,starts,ends) RETURNING * INTO saved;
   END IF;
   delta:=10;
 ELSE
   IF saved.id IS NULL THEN RAISE EXCEPTION 'No saved check-off to undo'; END IF;
   delta:=-saved.xp_awarded;
 END IF;
 -- The private writer supplies the existing progression/ledger behavior. Only
 -- this validated owner RPC chooses the amount; clients cannot call that writer.
 SELECT * INTO reward FROM public.award_xp_v2_unsafe_base(
   CASE WHEN p_completed THEN 'commitment_complete' ELSE 'commitment_undo' END,delta,
   jsonb_build_object('commitment_id',saved.id,'block_id',saved.block_id,'occurrence_date',saved.occurrence_date,'reward_date',saved.occurrence_date),
   'commitment:'||saved.id::text||':'||(saved.revision+1)::text);
 UPDATE public.cosmiq_commitment_check_offs SET completed=p_completed,
   completed_at=CASE WHEN p_completed THEN now() ELSE NULL END,
   xp_awarded=CASE WHEN p_completed THEN reward.xp_awarded ELSE 0 END,
   revision=saved.revision+1,updated_at=now()
   WHERE id=saved.id RETURNING * INTO saved;
 RETURN to_jsonb(saved);
END $$;
REVOKE ALL ON FUNCTION public.cosmiq_set_commitment_completion(text,date,boolean,integer) FROM PUBLIC,anon,service_role;
GRANT EXECUTE ON FUNCTION public.cosmiq_set_commitment_completion(text,date,boolean,integer) TO authenticated;

-- Existing nightly capture freezes only confirmed occurrences and consumes
-- their IDs once, just like existing quest/milestone evidence. Books stay frozen.
DO $patch$
DECLARE definition text; needle text:=' ) verified;'; addition text:=$addition$
 UNION ALL
 SELECT jsonb_build_object('id','commitment:'||co.id,'kind','commitment','title',co.title,
   'completed_at',co.completed_at,'occurrence_date',co.occurrence_date,'timezone',co.timezone,
   'starts_at',co.starts_at,'ends_at',co.ends_at),co.completed_at
 FROM cosmiq_commitment_check_offs co
 WHERE NOT p_prologue AND co.user_id=p_user AND co.completed
   AND co.completed_at>=p.capture_start_at AND co.completed_at<end_at
   AND NOT EXISTS(SELECT 1 FROM cosmiq_episode_facts ef WHERE ef.user_id=p_user AND ef.fact_id='commitment:'||co.id)
 ) verified;$addition$;
BEGIN
 definition:=pg_get_functiondef('public.cosmiq_queue_episode(uuid,boolean)'::regprocedure);
 IF (length(definition)-length(replace(definition,needle,'')))/length(needle)<>1 THEN RAISE EXCEPTION 'Episode queue changed; inspect before applying'; END IF;
 EXECUTE replace(definition,needle,addition);
END $patch$;
