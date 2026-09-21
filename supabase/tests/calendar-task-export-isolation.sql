BEGIN;
DO $check$
DECLARE uid uuid:=gen_random_uuid(); other_uid uuid:=gen_random_uuid(); google_id uuid:=gen_random_uuid(); apple_id uuid:=gen_random_uuid();
  tid uuid; intent jsonb; duplicate jsonb; claimed jsonb; intent_id uuid; rejected_id uuid; first_attempt uuid;
BEGIN
  INSERT INTO auth.users(id) VALUES(uid),(other_uid);
  INSERT INTO public.user_calendar_connections(id,user_id,provider,sync_enabled)
    VALUES(google_id,uid,'google',true),(apple_id,uid,'apple',true);
  INSERT INTO public.daily_tasks(user_id,task_text,source,notes) VALUES(uid,'Send this quest','inbox','Keep my notes') RETURNING id INTO tid;
  PERFORM set_config('request.jwt.claim.sub',uid::text,true);
  PERFORM set_config('request.jwt.claim.role','authenticated',true);
  intent:=public.prepare_calendar_task_export(tid,google_id,'list',false,'UTC'); intent_id:=(intent->>'id')::uuid;
  duplicate:=public.prepare_calendar_task_export(tid,google_id,'list',false,'UTC');
  IF intent->>'id' IS DISTINCT FROM duplicate->>'id' THEN RAISE EXCEPTION 'Repeated send created a second intent'; END IF;
  IF public.claim_calendar_task_export(intent_id,uid) IS NOT NULL THEN RAISE EXCEPTION 'Client can claim a cloud create'; END IF;
  IF public.complete_calendar_task_export(intent_id,uid,'forged') THEN RAISE EXCEPTION 'Client can forge cloud completion'; END IF;
  UPDATE public.daily_tasks SET task_text='Edited before dispatch' WHERE id=tid;
  intent:=public.prepare_calendar_task_export(tid,google_id,'list',true,'UTC');
  IF intent->'snapshot'->>'task_text'<>'Edited before dispatch' THEN RAISE EXCEPTION 'Ready intent did not refresh'; END IF;
  PERFORM set_config('request.jwt.claim.sub',other_uid::text,true);
  BEGIN
    PERFORM public.prepare_calendar_task_export(tid,google_id,'list',false,'UTC');
    RAISE EXCEPTION 'Cross-user preparation allowed';
  EXCEPTION WHEN OTHERS THEN IF SQLERRM='Cross-user preparation allowed' THEN RAISE; END IF; END;
  PERFORM set_config('request.jwt.claim.sub',uid::text,true);
  PERFORM set_config('request.jwt.claim.role','service_role',true);
  claimed:=public.claim_calendar_task_export(intent_id,uid);
  IF claimed IS NULL THEN RAISE EXCEPTION 'Server could not dispatch'; END IF;
  IF public.claim_calendar_task_export(intent_id,uid) IS NOT NULL THEN RAISE EXCEPTION 'Uncertain send dispatched twice'; END IF;
  PERFORM set_config('request.jwt.claim.role','authenticated',true);
  UPDATE public.daily_tasks SET task_text='Edited while sending' WHERE id=tid;
  intent:=public.prepare_calendar_task_export(tid,google_id,'list',false,'UTC');
  IF intent->'snapshot'->>'task_text'<>'Edited before dispatch' OR NOT (intent->>'sync_enabled')::boolean THEN RAISE EXCEPTION 'Dispatched baseline or consent changed'; END IF;
  PERFORM set_config('request.jwt.claim.role','service_role',true);
  IF NOT public.complete_calendar_task_export(intent_id,uid,'created-google-task') THEN RAISE EXCEPTION 'Could not complete export'; END IF;
  IF NOT public.complete_calendar_task_export(intent_id,uid,'created-google-task') THEN RAISE EXCEPTION 'Completion not idempotent'; END IF;
  IF public.complete_calendar_task_export(intent_id,uid,'other-google-task') THEN RAISE EXCEPTION 'Completed export changed identity'; END IF;
  IF (SELECT count(*) FROM public.calendar_quest_imports WHERE task_id=tid)<>1 THEN RAISE EXCEPTION 'Duplicate safe links'; END IF;
  IF (SELECT task_text FROM public.daily_tasks WHERE id=tid)<>'Edited while sending' THEN RAISE EXCEPTION 'Export overwrote quest'; END IF;
  IF (SELECT xp_reward FROM public.daily_tasks WHERE id=tid)<>10 THEN RAISE EXCEPTION 'Export changed XP'; END IF;
  intent:=public.prepare_calendar_task_export(tid,google_id,'rejected-list',false,'UTC'); rejected_id:=(intent->>'id')::uuid;
  claimed:=public.claim_calendar_task_export(rejected_id,uid); first_attempt:=(claimed->>'attempt_id')::uuid;
  PERFORM public.reset_rejected_calendar_task_export(rejected_id,uid,gen_random_uuid());
  IF (SELECT status FROM public.calendar_task_exports WHERE id=rejected_id)<>'dispatched' THEN RAISE EXCEPTION 'Wrong attempt reset dispatch'; END IF;
  PERFORM public.reset_rejected_calendar_task_export(rejected_id,uid,first_attempt);
  claimed:=public.claim_calendar_task_export(rejected_id,uid);
  IF claimed IS NULL OR (claimed->>'attempt_id')::uuid=first_attempt THEN RAISE EXCEPTION 'Rejected send did not get a fresh attempt'; END IF;
  PERFORM public.reset_rejected_calendar_task_export(rejected_id,uid,first_attempt);
  IF (SELECT status FROM public.calendar_task_exports WHERE id=rejected_id)<>'dispatched' THEN RAISE EXCEPTION 'Stale rejection reset a later send'; END IF;
  PERFORM set_config('request.jwt.claim.role','authenticated',true);
  intent:=public.prepare_calendar_task_export(tid,apple_id,'reminders',false,'UTC'); intent_id:=(intent->>'id')::uuid;
  PERFORM set_config('request.jwt.claim.sub',other_uid::text,true);
  IF public.claim_calendar_task_export(intent_id,uid) IS NOT NULL THEN RAISE EXCEPTION 'Another user can dispatch native export'; END IF;
  IF public.complete_calendar_task_export(intent_id,uid,'forged-reminder') THEN RAISE EXCEPTION 'Another user can finish native export'; END IF;
  PERFORM set_config('request.jwt.claim.sub',uid::text,true);
  IF public.complete_calendar_task_export(intent_id,uid,'premature') THEN RAISE EXCEPTION 'Completed before dispatch'; END IF;
  UPDATE public.user_calendar_connections SET sync_enabled=false WHERE id=apple_id;
  IF public.claim_calendar_task_export(intent_id,uid) IS NOT NULL THEN RAISE EXCEPTION 'Disconnected export dispatched'; END IF;
  UPDATE public.user_calendar_connections SET sync_enabled=true WHERE id=apple_id;
  IF public.claim_calendar_task_export(intent_id,uid) IS NULL THEN RAISE EXCEPTION 'Native owner could not dispatch'; END IF;
  IF public.claim_calendar_task_export(intent_id,uid) IS NOT NULL THEN RAISE EXCEPTION 'Native export dispatched twice'; END IF;
  IF NOT public.complete_calendar_task_export(intent_id,uid,'created-reminder') THEN RAISE EXCEPTION 'Native completion failed'; END IF;
  IF EXISTS(SELECT 1 FROM public.calendar_quest_imports WHERE provider='apple' AND sync_enabled) THEN RAISE EXCEPTION 'Enabled two-way sync without consent'; END IF;
  SET LOCAL ROLE authenticated;
  IF has_table_privilege('authenticated','public.calendar_task_exports','INSERT')
    OR has_table_privilege('authenticated','public.calendar_task_exports','UPDATE')
    OR has_function_privilege('authenticated','public.reset_rejected_calendar_task_export(uuid,uuid,uuid)','EXECUTE')
    THEN RAISE EXCEPTION 'Client can bypass export state machine'; END IF;
  IF has_function_privilege('anon','public.prepare_calendar_task_export(uuid,uuid,text,boolean,text)','EXECUTE') THEN RAISE EXCEPTION 'Anonymous export allowed'; END IF;
  RESET ROLE;
END $check$;
ROLLBACK;
