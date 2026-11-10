-- Time blocks are scheduled quests. Preserve recurrence, IDs, history and reserved time.
UPDATE public.cosmiq_commitment_schedules s SET blocks=(SELECT coalesce(jsonb_agg(b || '{"track_completion":true}'::jsonb ORDER BY n),'[]'::jsonb) FROM jsonb_array_elements(s.blocks) WITH ORDINALITY AS x(b,n));
CREATE OR REPLACE FUNCTION public.cosmiq_set_commitment_completion(p_block_id text,p_occurrence_date date,p_completed boolean,p_expected_revision integer DEFAULT 0)
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
   IF item IS NULL THEN RAISE EXCEPTION 'Time block unavailable'; END IF;
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
