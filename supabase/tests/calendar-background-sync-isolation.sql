BEGIN;
DO $check$
DECLARE uid uuid:=gen_random_uuid(); other_uid uuid:=gen_random_uuid(); cid uuid:=gen_random_uuid(); aid uuid:=gen_random_uuid();
  tid uuid; linkid uuid; snap jsonb; runid uuid; run2 uuid; claim public.calendar_quest_imports; token uuid; ok boolean;
BEGIN
  INSERT INTO auth.users(id) VALUES(uid),(other_uid);
  INSERT INTO public.user_calendar_connections(id,user_id,provider,sync_enabled) VALUES(cid,uid,'google',true),(aid,uid,'apple',true);
  PERFORM set_config('request.jwt.claim.sub',uid::text,true);
  snap := '{"task_text":"Background test","task_date":"2026-09-19","scheduled_time":null,"estimated_duration":1440,"location":null,"notes":null}'::jsonb;
  tid:=public.import_calendar_quest(cid,'calendar','event',snap,true,'UTC','event');
  SELECT id INTO linkid FROM public.calendar_quest_imports WHERE task_id=tid;
  PERFORM public.import_calendar_quest(aid,'calendar','apple-event',snap,true,'UTC','event');
  PERFORM set_config('request.jwt.claim.role','service_role',true);
  IF public.claim_calendar_sync_worker() IS NOT NULL THEN RAISE EXCEPTION 'Worker enabled by default'; END IF;
  UPDATE public.calendar_sync_worker_control SET enabled=true;
  runid:=public.claim_calendar_sync_worker();
  IF runid IS NULL OR public.claim_calendar_sync_worker() IS NOT NULL THEN RAISE EXCEPTION 'Dispatcher lease failed'; END IF;
  IF EXISTS(SELECT 1 FROM public.claim_next_calendar_background_sync(gen_random_uuid())) THEN RAISE EXCEPTION 'Invalid dispatcher token accepted'; END IF;
  -- Foreground already working: the server must not compete.
  token:=public.claim_calendar_quest_sync(linkid,0);
  IF EXISTS(SELECT 1 FROM public.claim_next_calendar_background_sync(runid)) THEN RAISE EXCEPTION 'Apple or busy link claimed'; END IF;
  PERFORM public.release_calendar_quest_sync(linkid,token);
  SELECT * INTO claim FROM public.claim_next_calendar_background_sync(runid);
  IF claim.id IS DISTINCT FROM linkid OR claim.sync_token IS NULL THEN RAISE EXCEPTION 'Expected cloud link not claimed'; END IF;
  IF public.claim_calendar_quest_sync(linkid,0) IS NOT NULL THEN RAISE EXCEPTION 'Foreground competed with worker'; END IF;
  ok:=public.finish_calendar_background_sync(other_uid,linkid,0,claim.sync_token,snap,snap,'linked');
  IF ok THEN RAISE EXCEPTION 'Cross-owner completion accepted'; END IF;
  -- A concurrent local edit must survive even when the remote write already finished.
  UPDATE public.daily_tasks SET task_text='New local edit' WHERE id=tid;
  ok:=public.finish_calendar_background_sync(uid,linkid,0,claim.sync_token,snap,snap,'linked');
  IF ok OR (SELECT task_text FROM public.daily_tasks WHERE id=tid)<>'New local edit' THEN RAISE EXCEPTION 'Stale snapshot overwritten'; END IF;
  IF (SELECT sync_token FROM public.calendar_quest_imports WHERE id=linkid) IS NOT NULL THEN RAISE EXCEPTION 'Stale attempt stranded lease'; END IF;
  UPDATE public.daily_tasks SET task_text='Background test' WHERE id=tid;
  UPDATE public.calendar_quest_imports SET next_background_sync_at=now()-interval '1 second' WHERE id=linkid;
  SELECT * INTO claim FROM public.claim_next_calendar_background_sync(runid);
  ok:=public.finish_calendar_background_sync(uid,linkid,0,claim.sync_token,snap,snap,'retry','Provider unavailable',900);
  IF NOT ok OR (SELECT background_failure_count FROM public.calendar_quest_imports WHERE id=linkid)<>1
    OR (SELECT next_background_sync_at FROM public.calendar_quest_imports WHERE id=linkid)<now()+interval '15 minutes' THEN RAISE EXCEPTION 'Retry backoff not honored'; END IF;
  IF EXISTS(SELECT 1 FROM public.claim_next_calendar_background_sync(runid)) THEN RAISE EXCEPTION 'Backoff or Apple bypassed'; END IF;
  UPDATE public.calendar_quest_imports SET next_background_sync_at=now()-interval '1 second' WHERE id=linkid;
  IF EXISTS(SELECT 1 FROM public.claim_next_calendar_background_sync(runid)) THEN RAISE EXCEPTION 'Account Retry-After bypassed'; END IF;
  UPDATE public.calendar_sync_connection_backoff SET retry_after=now()-interval '1 second' WHERE connection_id=cid;
  SELECT * INTO claim FROM public.claim_next_calendar_background_sync(runid);
  ok:=public.finish_calendar_background_sync(uid,linkid,claim.revision,claim.sync_token,snap,snap || '{"task_text":"Remote update"}'::jsonb,'linked');
  IF NOT ok OR (SELECT task_text FROM public.daily_tasks WHERE id=tid)<>'Remote update'
    OR (SELECT background_failure_count FROM public.calendar_quest_imports WHERE id=linkid)<>0
    OR (SELECT xp_reward FROM public.daily_tasks WHERE id=tid)<>0 THEN RAISE EXCEPTION 'Safe worker update failed'; END IF;
  snap:=snap || '{"task_text":"Remote update"}'::jsonb;
  UPDATE public.calendar_quest_imports SET next_background_sync_at=now()-interval '1 second' WHERE id=linkid;
  SELECT * INTO claim FROM public.claim_next_calendar_background_sync(runid);
  PERFORM public.set_calendar_quest_sync(linkid,false);
  IF public.finish_calendar_background_sync(uid,linkid,claim.revision,claim.sync_token,snap,snap,'linked') THEN RAISE EXCEPTION 'Pause bypassed'; END IF;
  IF EXISTS(SELECT 1 FROM public.claim_next_calendar_background_sync(runid)) THEN RAISE EXCEPTION 'Paused link claimed'; END IF;
  PERFORM public.set_calendar_quest_sync(linkid,true);
  UPDATE public.calendar_quest_imports SET next_background_sync_at=now()-interval '1 second',sync_status='conflict' WHERE id=linkid;
  IF EXISTS(SELECT 1 FROM public.claim_next_calendar_background_sync(runid)) THEN RAISE EXCEPTION 'Conflict was automatically resolved'; END IF;
  UPDATE public.calendar_quest_imports SET sync_status='missing' WHERE id=linkid;
  IF EXISTS(SELECT 1 FROM public.claim_next_calendar_background_sync(runid)) THEN RAISE EXCEPTION 'Missing item retried automatically'; END IF;
  UPDATE public.calendar_quest_imports SET sync_status='linked' WHERE id=linkid;
  UPDATE public.user_calendar_connections SET sync_enabled=false WHERE id=cid;
  IF EXISTS(SELECT 1 FROM public.claim_next_calendar_background_sync(runid)) THEN RAISE EXCEPTION 'Disconnected account claimed'; END IF;
  UPDATE public.user_calendar_connections SET sync_enabled=true WHERE id=cid;
  -- Expired dispatcher and item leases recover; old releases cannot clear the new run.
  UPDATE public.calendar_sync_worker_control SET lease_until=now()-interval '1 second';
  run2:=public.claim_calendar_sync_worker();
  PERFORM public.release_calendar_sync_worker(runid);
  IF (SELECT run_token FROM public.calendar_sync_worker_control) IS DISTINCT FROM run2 THEN RAISE EXCEPTION 'Old dispatcher released new run'; END IF;
  UPDATE public.calendar_quest_imports SET sync_token=gen_random_uuid(),sync_lease_until=now()-interval '1 second' WHERE id=linkid;
  SELECT * INTO claim FROM public.claim_next_calendar_background_sync(run2);
  IF claim.id IS DISTINCT FROM linkid THEN RAISE EXCEPTION 'Expired link did not recover'; END IF;
  UPDATE public.calendar_sync_worker_control SET enabled=false;
  IF EXISTS(SELECT 1 FROM public.claim_next_calendar_background_sync(run2)) THEN RAISE EXCEPTION 'Disabled dispatcher accepted work'; END IF;
END $check$;

-- Check actual API privileges, not only security-definer function internals.
DO $check$
BEGIN
  IF has_function_privilege('authenticated','public.claim_calendar_sync_worker()','EXECUTE')
    OR has_function_privilege('anon','public.claim_next_calendar_background_sync(uuid)','EXECUTE')
    OR has_function_privilege('authenticated','public.finish_calendar_background_sync(uuid,uuid,bigint,uuid,jsonb,jsonb,text,text,integer)','EXECUTE')
    OR has_function_privilege('authenticated','public._apply_calendar_quest_sync(uuid,uuid,bigint,uuid,jsonb,jsonb,text,text)','EXECUTE')
    OR has_function_privilege('service_role','public._apply_calendar_quest_sync(uuid,uuid,bigint,uuid,jsonb,jsonb,text,text)','EXECUTE')
    OR has_table_privilege('authenticated','public.calendar_sync_worker_control','UPDATE')
    THEN RAISE EXCEPTION 'Worker privilege leak'; END IF;
  IF NOT has_function_privilege('service_role','public.claim_calendar_sync_worker()','EXECUTE') THEN RAISE EXCEPTION 'Service cannot claim worker'; END IF;
END $check$;
SET LOCAL ROLE service_role;
SELECT set_config('request.jwt.claim.role','service_role',true);
SELECT public.claim_calendar_sync_worker();
RESET ROLE;
ROLLBACK;
