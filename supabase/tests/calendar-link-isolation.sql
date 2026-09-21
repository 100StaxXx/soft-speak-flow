BEGIN;

DO $check$
DECLARE uid uuid := gen_random_uuid(); other_uid uuid := gen_random_uuid(); cid uuid := gen_random_uuid();
  tid uuid; duplicate uuid; linkid uuid; snap jsonb; ok boolean; token uuid; second_token uuid;
  other_cid uuid := gen_random_uuid(); sent_id uuid; sent_snap jsonb;
BEGIN
  INSERT INTO auth.users(id) VALUES(uid),(other_uid);
  INSERT INTO public.user_calendar_connections(id,user_id,provider,sync_enabled) VALUES(cid,uid,'google',true);
  PERFORM set_config('request.jwt.claim.sub',uid::text,true);
  snap := '{"task_text":"Calendar migration test","task_date":"2026-09-19","scheduled_time":null,"estimated_duration":1440,"location":null,"notes":null}'::jsonb;
  tid := public.import_calendar_quest(cid,'test-calendar','test-event',snap,true,'UTC','event');
  duplicate := public.import_calendar_quest(cid,'test-calendar','test-event',snap,true,'UTC','event');
  IF tid <> duplicate THEN RAISE EXCEPTION 'Duplicate import created two tasks'; END IF;
  SELECT id INTO linkid FROM public.calendar_quest_imports WHERE task_id=tid;
  token := public.claim_calendar_quest_sync(linkid,0);
  IF token IS NULL THEN RAISE EXCEPTION 'Could not claim enabled link'; END IF;
  second_token := public.claim_calendar_quest_sync(linkid,0);
  IF second_token IS NOT NULL THEN RAISE EXCEPTION 'Concurrent sync acquired a second claim'; END IF;
  ok := public.apply_calendar_quest_sync(linkid,0,token,snap,snap || '{"task_text":"Updated"}'::jsonb);
  IF NOT ok THEN RAISE EXCEPTION 'Valid update failed'; END IF;
  ok := public.apply_calendar_quest_sync(linkid,0,token,snap,snap);
  IF ok THEN RAISE EXCEPTION 'Stale revision accepted'; END IF;
  PERFORM set_config('request.jwt.claim.sub',other_uid::text,true);
  ok := public.apply_calendar_quest_sync(linkid,1,token,snap,snap);
  IF ok THEN RAISE EXCEPTION 'Cross-user update accepted'; END IF;
  IF public.claim_calendar_quest_sync(linkid,1) IS NOT NULL THEN RAISE EXCEPTION 'Cross-user claim accepted'; END IF;
  BEGIN
    PERFORM public.import_calendar_quest(cid,'test-calendar','other-event',snap,true,'UTC','event');
    RAISE EXCEPTION 'Cross-user import accepted';
  EXCEPTION WHEN OTHERS THEN IF SQLERRM = 'Cross-user import accepted' THEN RAISE; END IF; END;
  PERFORM set_config('request.jwt.claim.sub',uid::text,true);
  token := public.claim_calendar_quest_sync(linkid,1);
  PERFORM public.set_calendar_quest_sync(linkid,false);
  IF public.calendar_quest_sync_is_current(linkid,1,token) THEN RAISE EXCEPTION 'Pause did not invalidate in-flight claim'; END IF;
  IF public.apply_calendar_quest_sync(linkid,1,token,snap,snap) THEN RAISE EXCEPTION 'Paused update accepted'; END IF;
  IF public.claim_calendar_quest_sync(linkid,2) IS NOT NULL THEN RAISE EXCEPTION 'Paused link claimed'; END IF;
  PERFORM public.set_calendar_quest_sync(linkid,true);
  token := public.claim_calendar_quest_sync(linkid,3);
  UPDATE public.calendar_quest_imports SET sync_lease_until=now()-interval '1 second' WHERE id=linkid;
  IF public.calendar_quest_sync_is_current(linkid,3,token) THEN RAISE EXCEPTION 'Expired lease accepted'; END IF;
  second_token := public.claim_calendar_quest_sync(linkid,3);
  IF second_token IS NULL OR second_token=token THEN RAISE EXCEPTION 'Expired lease did not recover'; END IF;
  PERFORM public.release_calendar_quest_sync(linkid,token);
  IF NOT public.calendar_quest_sync_is_current(linkid,3,second_token) THEN RAISE EXCEPTION 'Old release revoked new claim'; END IF;
  PERFORM public.release_calendar_quest_sync(linkid,second_token);
  snap := snap || '{"task_text":"External task","completed":false,"estimated_duration":30}'::jsonb;
  tid := public.import_calendar_quest(cid,'test-list','test-task',snap,true,'UTC','task');
  SELECT id INTO linkid FROM public.calendar_quest_imports WHERE task_id=tid;
  token := public.claim_calendar_quest_sync(linkid,0);
  ok := public.apply_calendar_quest_sync(linkid,0,token,snap,snap || '{"completed":true}'::jsonb);
  IF NOT ok OR NOT (SELECT completed FROM public.daily_tasks WHERE id=tid) THEN RAISE EXCEPTION 'Task completion did not sync'; END IF;
  IF (SELECT xp_reward FROM public.daily_tasks WHERE id=tid) <> 0 THEN RAISE EXCEPTION 'Import awarded XP'; END IF;
  IF (SELECT completed_at FROM public.daily_tasks WHERE id=tid) IS NULL THEN RAISE EXCEPTION 'Completion timestamp missing'; END IF;
  -- NULL duration is unknown, not an invented week-long task.
  snap := snap || '{"estimated_duration":null,"completed":true}'::jsonb;
  tid := public.import_calendar_quest(cid,'test-list','completed-task',snap,true,'UTC','task');
  IF (SELECT estimated_duration FROM public.daily_tasks WHERE id=tid) IS NOT NULL THEN RAISE EXCEPTION 'NULL duration changed'; END IF;
  IF (SELECT completed_at FROM public.daily_tasks WHERE id=tid) IS NULL THEN RAISE EXCEPTION 'Imported completion timestamp missing'; END IF;
  SELECT id INTO linkid FROM public.calendar_quest_imports WHERE task_id=tid;
  token := public.claim_calendar_quest_sync(linkid,0);
  ok := public.apply_calendar_quest_sync(linkid,0,token,snap,snap || '{"task_text":"Renamed"}'::jsonb);
  IF NOT ok OR (SELECT estimated_duration FROM public.daily_tasks WHERE id=tid) IS NOT NULL THEN RAISE EXCEPTION 'NULL duration did not survive sync'; END IF;
  tid := public.import_calendar_quest(cid,'test-calendar','long-event',snap || '{"estimated_duration":14400}'::jsonb,true,'UTC','event');
  IF (SELECT estimated_duration FROM public.daily_tasks WHERE id=tid) <> 14400 THEN RAISE EXCEPTION 'Multi-day event was shortened'; END IF;
  -- Sending to one destination must not silently upgrade other legacy links.
  INSERT INTO public.user_calendar_connections(id,user_id,provider,sync_enabled,primary_calendar_id)
    VALUES(other_cid,uid,'outlook',true,'outlook-calendar');
  INSERT INTO public.daily_tasks(user_id,task_text,task_date,scheduled_time,source,difficulty)
    VALUES(uid,'Sent quest','2026-09-19','10:00','manual','easy') RETURNING id INTO sent_id;
  INSERT INTO public.quest_calendar_links(user_id,task_id,connection_id,provider,external_calendar_id,external_event_id,sync_mode)
    VALUES(uid,sent_id,cid,'google','google-calendar','sent-google','send_only'),
      (uid,sent_id,other_cid,'outlook','outlook-calendar','old-outlook','send_only');
  sent_snap := '{"task_text":"Sent quest","task_date":"2026-09-19","scheduled_time":"10:00","estimated_duration":null,"location":null,"notes":null}'::jsonb;
  PERFORM public.register_sent_calendar_quest(sent_id,'UTC',cid,'sent-google','event',sent_snap || '{"task_text":"stale"}'::jsonb);
  IF EXISTS(SELECT 1 FROM public.calendar_quest_imports WHERE task_id=sent_id) THEN RAISE EXCEPTION 'Registered stale send baseline'; END IF;
  PERFORM public.register_sent_calendar_quest(sent_id,'UTC',cid,'sent-google','event',sent_snap);
  IF (SELECT count(*) FROM public.calendar_quest_imports WHERE task_id=sent_id) <> 1
      OR NOT EXISTS(SELECT 1 FROM public.calendar_quest_imports WHERE task_id=sent_id AND external_id='sent-google')
    THEN RAISE EXCEPTION 'Send registered unrelated links'; END IF;
  duplicate := public.import_calendar_quest(other_cid,'outlook-calendar','old-outlook',snap,true,'UTC','event');
  IF duplicate <> sent_id THEN RAISE EXCEPTION 'Legacy event import duplicated sent quest'; END IF;
  INSERT INTO public.quest_outlook_task_links(user_id,task_id,connection_id,external_task_list_id,external_task_id,sync_mode)
    VALUES(uid,sent_id,other_cid,'todo-list','old-todo','send_only');
  duplicate := public.import_calendar_quest(other_cid,'todo-list','old-todo',snap,true,'UTC','task');
  IF duplicate <> sent_id THEN RAISE EXCEPTION 'Legacy To Do import duplicated sent quest'; END IF;
  PERFORM public.register_sent_calendar_quest(sent_id,'UTC',other_cid,'old-todo','task',sent_snap || '{"completed":false}'::jsonb);
  IF (SELECT count(*) FROM public.calendar_quest_imports WHERE task_id=sent_id) <> 2 THEN RAISE EXCEPTION 'Task send registration failed'; END IF;
  -- Exercise actual authenticated privileges/RLS, not only SECURITY DEFINER guards.
  INSERT INTO public.user_calendar_connections(user_id,provider,sync_enabled)
    VALUES(other_uid,'google',true) RETURNING id INTO other_cid;
  PERFORM set_config('request.jwt.claim.sub',other_uid::text,true);
  tid := public.import_calendar_quest(other_cid,'private-list','private-task',snap,true,'UTC','task');
  SELECT id INTO linkid FROM public.calendar_quest_imports WHERE task_id=tid;
  PERFORM set_config('request.jwt.claim.sub',uid::text,true);
  SET LOCAL ROLE authenticated;
  IF EXISTS(SELECT 1 FROM public.calendar_quest_imports WHERE user_id<>uid) THEN RAISE EXCEPTION 'RLS exposed another user'; END IF;
  IF NOT EXISTS(SELECT 1 FROM public.calendar_quest_imports WHERE user_id=uid) THEN RAISE EXCEPTION 'RLS hid own links'; END IF;
  IF public.claim_calendar_quest_sync(linkid,0) IS NOT NULL THEN RAISE EXCEPTION 'Authenticated role claimed another user link'; END IF;
  IF has_table_privilege('authenticated','public.calendar_quest_imports','INSERT')
     OR has_table_privilege('authenticated','public.calendar_quest_imports','UPDATE')
     OR has_table_privilege('authenticated','public.calendar_quest_imports','DELETE')
    THEN RAISE EXCEPTION 'Direct link mutation is allowed'; END IF;
  IF has_function_privilege('anon','public.claim_calendar_quest_sync(uuid,bigint)','EXECUTE')
    THEN RAISE EXCEPTION 'Anonymous sync is allowed'; END IF;
  RESET ROLE;
END $check$;

ROLLBACK;
