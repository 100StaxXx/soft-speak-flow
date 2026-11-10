BEGIN;
-- Additive, owner-private story layer. Existing epics/tasks remain authoritative.
CREATE TABLE public.cosmiq_episode_preferences (
 user_id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
 enabled boolean NOT NULL DEFAULT false, ai_consent boolean NOT NULL DEFAULT false,
 close_time time NOT NULL DEFAULT '19:30' CHECK(close_time<'24:00'), start_time time CHECK(start_time<'24:00'),
 timezone text NOT NULL DEFAULT 'UTC', hemisphere text NOT NULL DEFAULT 'north' CHECK(hemisphere IN ('north','south')),
 tone text NOT NULL DEFAULT 'adventurous' CHECK(tone IN ('gentle','adventurous','playful')),
 notifications boolean NOT NULL DEFAULT false, suggestions boolean NOT NULL DEFAULT true,
 rest_until date, character_mode text NOT NULL DEFAULT 'companion' CHECK(character_mode IN ('companion','avatar','photo')),
 tutorial_seen boolean NOT NULL DEFAULT false, next_close_at timestamptz NOT NULL,
 capture_start_at timestamptz NOT NULL DEFAULT now(), next_start_at timestamptz NOT NULL DEFAULT now(), window_start timestamptz NOT NULL DEFAULT now(),
 CHECK(NOT enabled OR ai_consent), CHECK(start_time IS NULL OR start_time <> close_time)
);
CREATE TABLE public.cosmiq_seasonal_arcs (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
 season_key text NOT NULL, season text NOT NULL CHECK(season IN ('winter','spring','summer','fall')),
 title text NOT NULL, summary text NOT NULL DEFAULT '', continuity text NOT NULL DEFAULT '',
 starts_on date NOT NULL, ends_on date NOT NULL, UNIQUE(user_id,season_key)
);
CREATE TABLE public.cosmiq_story_characters (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
 mode text NOT NULL CHECK(mode IN ('avatar','photo')), description text NOT NULL CHECK(length(description)<=1200),
 image_path text NOT NULL, approved_at timestamptz, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.cosmiq_episodes (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
 arc_id uuid NOT NULL REFERENCES public.cosmiq_seasonal_arcs(id) ON DELETE CASCADE,
 companion_id uuid NOT NULL REFERENCES public.user_companion(id) ON DELETE CASCADE,
 character_id uuid REFERENCES public.cosmiq_story_characters(id) ON DELETE SET NULL,
 kind text NOT NULL CHECK(kind IN ('prologue','daily')), cycle_key text NOT NULL,
 status text NOT NULL DEFAULT 'queued' CHECK(status IN ('queued','writing','illustrating','ready','error')),
 title text NOT NULL DEFAULT 'A new page', window_start timestamptz NOT NULL, window_end timestamptz NOT NULL,
 facts jsonb NOT NULL DEFAULT '[]', appearance jsonb NOT NULL DEFAULT '{}', script jsonb,
 pages jsonb NOT NULL DEFAULT '[]', position int NOT NULL DEFAULT 0 CHECK(position>=0), finished_at timestamptz,
 choice_id text, correction text CHECK(length(correction)<=1000), ready_at timestamptz,
 lease_token uuid, lease_until timestamptz, attempts int NOT NULL DEFAULT 0,
 next_attempt_at timestamptz NOT NULL DEFAULT now(), error_code text,
 created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(user_id,cycle_key), CHECK(window_end>=window_start)
);
CREATE UNIQUE INDEX cosmiq_one_prologue ON public.cosmiq_episodes(user_id) WHERE kind='prologue';
CREATE INDEX cosmiq_episode_owner_time ON public.cosmiq_episodes(user_id,window_end DESC);
CREATE INDEX cosmiq_episode_work ON public.cosmiq_episodes(next_attempt_at) WHERE status IN ('queued','writing','illustrating');
CREATE TABLE public.cosmiq_companion_story_paths (
 user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
 companion_id uuid NOT NULL REFERENCES public.user_companion(id) ON DELETE CASCADE,
 target_stage int NOT NULL, source_episode_id uuid NOT NULL REFERENCES public.cosmiq_episodes(id) ON DELETE CASCADE,
 path jsonb NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(companion_id,target_stage)
);
CREATE TABLE public.cosmiq_episode_facts (
 user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
 fact_id text NOT NULL, episode_id uuid NOT NULL REFERENCES public.cosmiq_episodes(id) ON DELETE CASCADE,
 PRIMARY KEY(user_id,fact_id)
);
CREATE TABLE public.cosmiq_quest_suggestion_feedback (
 user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
 suggestion_id text NOT NULL CHECK(length(suggestion_id)<=200), action text NOT NULL CHECK(action IN ('accepted','dismissed')),
 created_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(user_id,suggestion_id)
);
DO $$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['cosmiq_episode_preferences','cosmiq_seasonal_arcs','cosmiq_story_characters','cosmiq_episodes','cosmiq_episode_facts','cosmiq_quest_suggestion_feedback','cosmiq_companion_story_paths'] LOOP
  EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',t);
  EXECUTE format('REVOKE ALL ON public.%I FROM PUBLIC, anon, authenticated',t);
  EXECUTE format('GRANT ALL ON public.%I TO service_role',t);
  EXECUTE format('GRANT SELECT ON public.%I TO authenticated',t);
  EXECUTE format('CREATE POLICY owner_read ON public.%I FOR SELECT TO authenticated USING(user_id=(SELECT auth.uid()))',t);
 END LOOP;
END $$;
INSERT INTO storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
 VALUES('cosmiq-storybook','cosmiq-storybook',false,10485760,ARRAY['image/png','image/jpeg','image/webp']) ON CONFLICT(id) DO NOTHING;
CREATE POLICY storybook_private_read ON storage.objects FOR SELECT TO authenticated
 USING(bucket_id='cosmiq-storybook' AND (storage.foldername(name))[1]=(SELECT auth.uid())::text);
-- Client may only upload/delete its temporary reference, never rewrite generated book art.
CREATE POLICY storybook_reference_insert ON storage.objects FOR INSERT TO authenticated
 WITH CHECK(bucket_id='cosmiq-storybook' AND (storage.foldername(name))[1]=(SELECT auth.uid())::text AND (storage.foldername(name))[2]='references');
CREATE POLICY storybook_reference_delete ON storage.objects FOR DELETE TO authenticated
 USING(bucket_id='cosmiq-storybook' AND (storage.foldername(name))[1]=(SELECT auth.uid())::text AND (storage.foldername(name))[2]='references');

CREATE FUNCTION public.cosmiq_next_local_time(p_time time,p_timezone text,p_after timestamptz) RETURNS timestamptz
 LANGUAGE plpgsql STABLE SET search_path=public,pg_temp AS $$
DECLARE d date:=(p_after AT TIME ZONE p_timezone)::date; target timestamptz;
BEGIN
 target := (d+p_time) AT TIME ZONE p_timezone;
 IF target<=p_after THEN target:=((d+1)+p_time) AT TIME ZONE p_timezone; END IF;
 RETURN target;
END $$;

CREATE FUNCTION public.cosmiq_ensure_story_preferences(p_user uuid) RETURNS void
 LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE tz text; close_at time;
BEGIN
 IF NOT EXISTS(SELECT 1 FROM user_companion WHERE user_id=p_user AND product_mode='cosmiq') THEN RAISE EXCEPTION 'COSMIQ companion required'; END IF;
 SELECT CASE WHEN EXISTS(SELECT 1 FROM pg_timezone_names WHERE name=p.timezone) THEN p.timezone ELSE 'UTC' END INTO tz FROM profiles p WHERE id=p_user;
 SELECT evening_time INTO close_at FROM companion_celebration_preferences WHERE user_id=p_user;
 close_at:=coalesce(close_at,'19:30'); tz:=coalesce(tz,'UTC');
 INSERT INTO cosmiq_episode_preferences(user_id,timezone,close_time,next_close_at)
 VALUES(p_user,tz,close_at,cosmiq_next_local_time(close_at,tz,now())) ON CONFLICT DO NOTHING;
END $$;

CREATE FUNCTION public.cosmiq_ensure_arc(p_user uuid,p_day date) RETURNS uuid
 LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE hemi text; m int:=extract(month FROM p_day); y int:=extract(year FROM p_day); q int; s text; start_on date; a uuid;
BEGIN
 SELECT hemisphere INTO hemi FROM cosmiq_episode_preferences WHERE user_id=p_user;
 q:=floor((m%12)/3.0)::int;
 start_on:=make_date(CASE WHEN m<3 THEN y-1 ELSE y END,CASE WHEN q=0 THEN 12 ELSE q*3 END,1);
 s:=(CASE WHEN hemi='south' THEN ARRAY['summer','fall','winter','spring'] ELSE ARRAY['winter','spring','summer','fall'] END)[q+1];
 INSERT INTO cosmiq_seasonal_arcs(user_id,season_key,season,title,starts_on,ends_on)
 VALUES(p_user,hemi||'-'||start_on::text,s,initcap(s)||' Arc',start_on,(start_on+interval '3 months')::date)
 ON CONFLICT(user_id,season_key) DO UPDATE SET season_key=excluded.season_key RETURNING id INTO a;
 RETURN a;
END $$;

-- Called under the preference-row lock. Contribution IDs are consumed exactly once.
CREATE FUNCTION public.cosmiq_queue_episode(p_user uuid,p_prologue boolean DEFAULT false) RETURNS uuid
 LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE p cosmiq_episode_preferences; c user_companion; a uuid; e uuid; end_at timestamptz; f jsonb; character uuid;
BEGIN
 SELECT * INTO p FROM cosmiq_episode_preferences WHERE user_id=p_user FOR UPDATE;
 IF NOT p.enabled OR NOT p.ai_consent THEN RETURN NULL; END IF;
 IF p_prologue AND EXISTS(SELECT 1 FROM cosmiq_episodes WHERE user_id=p_user AND kind='prologue') THEN RETURN NULL; END IF;
 SELECT * INTO c FROM user_companion WHERE user_id=p_user AND product_mode='cosmiq' ORDER BY id LIMIT 1;
 IF c.id IS NULL THEN RETURN NULL; END IF;
 end_at:=CASE WHEN p_prologue THEN now() ELSE p.next_close_at END;
 a:=cosmiq_ensure_arc(p_user,(end_at AT TIME ZONE p.timezone)::date);
 IF p.character_mode<>'companion' THEN SELECT id INTO character FROM cosmiq_story_characters WHERE user_id=p_user AND mode=p.character_mode AND approved_at IS NOT NULL ORDER BY approved_at DESC LIMIT 1; END IF;
 SELECT coalesce(jsonb_agg(fact ORDER BY completed_at),'[]') INTO f FROM (
 SELECT jsonb_build_object('id','quest:'||t.id,'kind',CASE WHEN t.is_milestone THEN 'milestone' ELSE 'quest' END,'title',left(t.task_text,300),'completed_at',t.completed_at,'campaign_id',t.epic_id) fact,t.completed_at
 FROM daily_tasks t WHERE NOT p_prologue AND t.user_id=p_user AND t.completed AND t.completed_at>=p.capture_start_at AND t.completed_at<end_at
 AND NOT EXISTS(SELECT 1 FROM cosmiq_episode_facts ef WHERE ef.user_id=p_user AND ef.fact_id='quest:'||t.id)
 UNION ALL
 SELECT jsonb_build_object('id','milestone:'||m.id,'kind','milestone','title',left(m.title,300),'completed_at',m.completed_at,'campaign_id',m.epic_id),m.completed_at
 FROM epic_milestones m WHERE NOT p_prologue AND m.user_id=p_user AND m.completed_at>=p.capture_start_at AND m.completed_at<end_at
 AND NOT EXISTS(SELECT 1 FROM cosmiq_episode_facts ef WHERE ef.user_id=p_user AND ef.fact_id='milestone:'||m.id)
 AND (m.task_id IS NULL OR NOT EXISTS(SELECT 1 FROM daily_tasks t WHERE t.id=m.task_id AND t.completed))
 ) verified;
 INSERT INTO cosmiq_episodes(user_id,arc_id,companion_id,character_id,kind,cycle_key,window_start,window_end,facts,appearance)
 VALUES(p_user,a,c.id,character,CASE WHEN p_prologue THEN 'prologue' ELSE 'daily' END,
 CASE WHEN p_prologue THEN 'prologue' ELSE end_at::text END,least(p.window_start,end_at),end_at,f,
 jsonb_build_object('tone',p.tone,'name',c.companion_name,'image_url',c.current_image_url,'stage',c.current_stage,'campaigns',(SELECT coalesce(jsonb_agg(jsonb_build_object('id',id,'title',left(title,200),'start_date',start_date,'end_date',end_date)),'[]') FROM epics WHERE user_id=p_user AND status='active'),'growth_path',(SELECT path FROM cosmiq_companion_story_paths WHERE companion_id=c.id AND target_stage<=c.current_stage ORDER BY target_stage DESC LIMIT 1)))
 ON CONFLICT(user_id,cycle_key) DO NOTHING RETURNING id INTO e;
 IF e IS NOT NULL AND NOT p_prologue THEN
  INSERT INTO cosmiq_episode_facts(user_id,fact_id,episode_id) SELECT p_user,value->>'id',e FROM jsonb_array_elements(f) ON CONFLICT DO NOTHING;
  -- Keep gap activity: next window begins at this close, even if the UI opens later.
  UPDATE cosmiq_episode_preferences SET window_start=end_at,
    next_close_at=cosmiq_next_local_time(close_time,timezone,end_at),
    next_start_at=CASE WHEN start_time IS NULL THEN end_at ELSE cosmiq_next_local_time(start_time,timezone,end_at) END WHERE user_id=p_user;
 END IF;
 RETURN e;
END $$;

CREATE FUNCTION public.cosmiq_story_action(p_action text,p_payload jsonb DEFAULT '{}') RETURNS jsonb
 LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE uid uuid:=auth.uid(); p cosmiq_episode_preferences; e cosmiq_episodes; tz text; selected text; c user_companion; target int; chosen jsonb;
BEGIN
 IF uid IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
 PERFORM cosmiq_ensure_story_preferences(uid);
 SELECT * INTO p FROM cosmiq_episode_preferences WHERE user_id=uid FOR UPDATE;
 IF p_action='preferences' THEN
  tz:=coalesce(p_payload->>'timezone',p.timezone);
  IF NOT EXISTS(SELECT 1 FROM pg_timezone_names WHERE name=tz) THEN RAISE EXCEPTION 'Invalid timezone'; END IF;
  UPDATE cosmiq_episode_preferences SET
   enabled=coalesce((p_payload->>'enabled')::boolean,enabled), ai_consent=coalesce((p_payload->>'ai_consent')::boolean,ai_consent),
   close_time=coalesce((p_payload->>'close_time')::time,close_time),
   start_time=CASE WHEN p_payload ? 'start_time' THEN (p_payload->>'start_time')::time ELSE start_time END,
   timezone=tz,hemisphere=coalesce(p_payload->>'hemisphere',hemisphere),tone=coalesce(p_payload->>'tone',tone),
   notifications=coalesce((p_payload->>'notifications')::boolean,notifications), suggestions=coalesce((p_payload->>'suggestions')::boolean,suggestions),
   rest_until=CASE WHEN p_payload ? 'rest_until' THEN (p_payload->>'rest_until')::date ELSE rest_until END,
   character_mode=coalesce(p_payload->>'character_mode',character_mode)
  WHERE user_id=uid RETURNING * INTO p;
  -- Only an explicit schedule change moves a pending boundary. No retroactive rewrite.
  IF p_payload ?| ARRAY['close_time','start_time','timezone','enabled'] THEN
   UPDATE cosmiq_episode_preferences SET next_close_at=cosmiq_next_local_time(p.close_time,p.timezone,now()),
    next_start_at=CASE WHEN p.start_time IS NULL THEN now() ELSE cosmiq_next_local_time(p.start_time,p.timezone,now()) END
   WHERE user_id=uid;
  END IF;
  IF p.enabled THEN
   -- Legacy recap history stays readable; avoid two automated recap products.
   UPDATE companion_celebration_preferences SET enabled=false WHERE user_id=uid;
   PERFORM cosmiq_queue_episode(uid,true);
  END IF;
 ELSIF p_action='read' THEN
  SELECT * INTO e FROM cosmiq_episodes WHERE id=(p_payload->>'id')::uuid AND user_id=uid AND status='ready' FOR UPDATE;
  IF e.id IS NULL THEN RAISE EXCEPTION 'Episode unavailable'; END IF;
  UPDATE cosmiq_episodes SET position=greatest(0,least(coalesce((p_payload->>'position')::int,position),jsonb_array_length(pages)-1)),
   finished_at=CASE WHEN (p_payload->>'finished')::boolean THEN coalesce(finished_at,now()) ELSE finished_at END WHERE id=e.id;
 ELSIF p_action='choice' THEN
  SELECT * INTO e FROM cosmiq_episodes WHERE id=(p_payload->>'id')::uuid AND user_id=uid AND status='ready' FOR UPDATE;
  selected:=p_payload->>'choice_id';
  IF e.id IS NULL OR NOT EXISTS(SELECT 1 FROM jsonb_array_elements(e.script->'choices') c WHERE c->>'id'=selected) THEN RAISE EXCEPTION 'Invalid story choice'; END IF;
  IF e.choice_id IS NULL THEN UPDATE cosmiq_episodes SET choice_id=selected WHERE id=e.id; END IF;
 ELSIF p_action='correction' THEN
  UPDATE cosmiq_episodes SET correction=left(p_payload->>'text',1000) WHERE id=(p_payload->>'id')::uuid AND user_id=uid AND status='ready';
 ELSIF p_action='growth_path' THEN
  SELECT * INTO c FROM user_companion WHERE user_id=uid AND product_mode='cosmiq' ORDER BY id LIMIT 1 FOR UPDATE;
  target:=get_next_visual_evolution_stage(c.current_stage);
  IF c.current_stage<1 OR target IS NULL OR c.current_xp<get_companion_progression_threshold(c.id,target) THEN RAISE EXCEPTION 'Growth choice is not ready'; END IF;
  SELECT * INTO e FROM cosmiq_episodes WHERE id=(p_payload->>'episode_id')::uuid AND user_id=uid AND companion_id=c.id AND status='ready';
  SELECT value INTO chosen FROM jsonb_array_elements(e.script->'growth_paths') WHERE value->>'id'=p_payload->>'path_id';
  IF chosen IS NULL THEN RAISE EXCEPTION 'Invalid growth direction'; END IF;
  INSERT INTO cosmiq_companion_story_paths(user_id,companion_id,target_stage,source_episode_id,path)
  VALUES(uid,c.id,target,e.id,chosen) ON CONFLICT(companion_id,target_stage) DO NOTHING;
 ELSIF p_action='approve_character' THEN
  UPDATE cosmiq_story_characters SET approved_at=coalesce(approved_at,now()) WHERE id=(p_payload->>'id')::uuid AND user_id=uid RETURNING mode INTO selected;
  IF selected IS NULL THEN RAISE EXCEPTION 'Character unavailable'; END IF;
  UPDATE cosmiq_episode_preferences SET character_mode=selected WHERE user_id=uid;
 ELSIF p_action='suggestion' THEN
  INSERT INTO cosmiq_quest_suggestion_feedback(user_id,suggestion_id,action) VALUES(uid,p_payload->>'id',p_payload->>'action')
  ON CONFLICT(user_id,suggestion_id) DO UPDATE SET action=excluded.action;
 ELSIF p_action='tutorial' THEN
  UPDATE cosmiq_episode_preferences SET tutorial_seen=true WHERE user_id=uid;
 ELSIF p_action='retry' THEN
  UPDATE cosmiq_episodes SET status=CASE WHEN script IS NULL THEN 'queued' ELSE 'illustrating' END,attempts=0,error_code=NULL,next_attempt_at=now()
   WHERE id=(p_payload->>'id')::uuid AND user_id=uid AND status='error' AND p.enabled AND p.ai_consent;
 ELSIF p_action<>'load' THEN RAISE EXCEPTION 'Unknown story action';
 END IF;
 PERFORM cosmiq_ensure_arc(uid,(now() AT TIME ZONE p.timezone)::date);
 RETURN jsonb_build_object('preferences',(SELECT to_jsonb(v) FROM cosmiq_episode_preferences v WHERE user_id=uid));
END $$;

CREATE FUNCTION public.cosmiq_claim_episode() RETURNS SETOF public.cosmiq_episodes
 LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE pref record; work uuid;
BEGIN
 -- Bounded backfill: one elapsed day/user/tick. Exact stored boundaries survive DST/travel.
 FOR pref IN SELECT user_id FROM cosmiq_episode_preferences WHERE enabled AND ai_consent AND next_close_at<=now() ORDER BY next_close_at LIMIT 20 FOR UPDATE SKIP LOCKED LOOP
  PERFORM cosmiq_queue_episode(pref.user_id);
 END LOOP;
 SELECT e.id INTO work FROM cosmiq_episodes e JOIN cosmiq_episode_preferences p USING(user_id)
 WHERE p.enabled AND p.ai_consent AND e.status IN ('queued','writing','illustrating') AND e.next_attempt_at<=now()
 AND (e.lease_until IS NULL OR e.lease_until<now())
 AND NOT EXISTS(SELECT 1 FROM cosmiq_episodes earlier WHERE earlier.user_id=e.user_id AND (earlier.created_at,CASE WHEN earlier.kind='prologue' THEN 0 ELSE 1 END,earlier.window_end,earlier.id)<(e.created_at,CASE WHEN e.kind='prologue' THEN 0 ELSE 1 END,e.window_end,e.id) AND earlier.status<>'ready')
 ORDER BY e.created_at LIMIT 1 FOR UPDATE OF e SKIP LOCKED;
 RETURN QUERY UPDATE cosmiq_episodes SET lease_token=gen_random_uuid(),lease_until=now()+interval '5 minutes'
 WHERE id=work RETURNING *;
END $$;
CREATE FUNCTION public.cosmiq_publish_episode(p_episode uuid,p_lease uuid) RETURNS boolean
 LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE e cosmiq_episodes;
BEGIN
 SELECT * INTO e FROM cosmiq_episodes WHERE id=p_episode AND lease_token=p_lease AND lease_until>now() FOR UPDATE;
 IF e.id IS NULL OR e.script IS NULL OR jsonb_array_length(e.pages)<>jsonb_array_length(e.script->'pages')
 OR EXISTS(SELECT 1 FROM jsonb_array_elements(e.pages) page WHERE coalesce(page->>'image_path','')='') THEN RETURN false; END IF;
 IF NOT EXISTS(SELECT 1 FROM cosmiq_episode_preferences WHERE user_id=e.user_id AND enabled AND ai_consent) THEN RETURN false; END IF;
 UPDATE cosmiq_episodes SET status='ready',title=e.script->>'title',ready_at=now(),lease_token=NULL,lease_until=NULL,error_code=NULL WHERE id=e.id;
 UPDATE cosmiq_seasonal_arcs SET title=e.script->>'arc_title',summary=e.script->>'arc_summary',continuity=e.script->>'continuity' WHERE id=e.arc_id;
 IF EXISTS(SELECT 1 FROM cosmiq_episode_preferences WHERE user_id=e.user_id AND enabled AND notifications) THEN
  INSERT INTO push_notification_queue(user_id,notification_type,title,body,scheduled_for,status,source_table,source_id,dedupe_key,priority,payload,delivered)
  VALUES(e.user_id,'cosmiq_episode','Your next chapter is ready','Open your private picture story, then shape tomorrow.',now(),'queued','cosmiq_episodes',e.id,'episode:'||e.id,40,
   jsonb_build_object('url','/companion?episode='||e.id,'product_mode','cosmiq'),false) ON CONFLICT(dedupe_key) DO NOTHING;
 END IF;
 RETURN true;
END $$;

-- No default-public security-definer entry points.
REVOKE ALL ON FUNCTION public.cosmiq_ensure_story_preferences(uuid),public.cosmiq_ensure_arc(uuid,date),public.cosmiq_queue_episode(uuid,boolean),public.cosmiq_claim_episode(),public.cosmiq_publish_episode(uuid,uuid),public.cosmiq_story_action(text,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.cosmiq_story_action(text,jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cosmiq_ensure_story_preferences(uuid),public.cosmiq_ensure_arc(uuid,date),public.cosmiq_queue_episode(uuid,boolean),public.cosmiq_claim_episode(),public.cosmiq_publish_episode(uuid,uuid) TO service_role;
CREATE TABLE public.cosmiq_character_preview_quota (
 user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
 day date NOT NULL DEFAULT current_date, count int NOT NULL DEFAULT 0, PRIMARY KEY(user_id,day)
);
ALTER TABLE public.cosmiq_character_preview_quota ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.cosmiq_character_preview_quota FROM PUBLIC,anon,authenticated;
GRANT ALL ON public.cosmiq_character_preview_quota TO service_role;
CREATE FUNCTION public.cosmiq_reserve_character_preview(p_user uuid) RETURNS boolean
 LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE used int;
BEGIN
 INSERT INTO cosmiq_character_preview_quota(user_id,count) VALUES(p_user,1)
 ON CONFLICT(user_id,day) DO UPDATE SET count=cosmiq_character_preview_quota.count+1 WHERE cosmiq_character_preview_quota.count<3
 RETURNING count INTO used;
 RETURN used IS NOT NULL;
END $$;
REVOKE ALL ON FUNCTION public.cosmiq_reserve_character_preview(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.cosmiq_reserve_character_preview(uuid) TO service_role;
INSERT INTO public.cost_guardrail_config(scope_type,scope_key,enabled,monthly_budget_usd,alert_thresholds,metadata)
VALUES ('feature','cosmiq_storybook',true,35,ARRAY[50,80,90,100],'{"description":"Private daily storybook and approved character previews"}'),
 ('endpoint','cosmiq-episode-worker',true,30,ARRAY[50,80,90,100],'{"description":"Resumable picture-book worker"}'),
 ('endpoint','cosmiq-character-preview',true,5,ARRAY[50,80,90,100],'{"description":"Three character previews per user/day"}')
ON CONFLICT(scope_type,scope_key) DO NOTHING;
-- Temporary references are recorded for account deletion and swept after abandoned uploads.
CREATE FUNCTION public.cosmiq_register_story_reference() RETURNS trigger
 LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
BEGIN
 IF NEW.bucket_id='cosmiq-storybook' AND (storage.foldername(NEW.name))[2]='references' THEN
  INSERT INTO user_storage_assets(user_id,bucket_id,storage_path,source_kind)
  VALUES(((storage.foldername(NEW.name))[1])::uuid,NEW.bucket_id,NEW.name,'cosmiq_story_reference')
  ON CONFLICT(bucket_id,storage_path) DO NOTHING;
 END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.cosmiq_register_story_reference() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER cosmiq_story_reference_ledger AFTER INSERT ON storage.objects
 FOR EACH ROW EXECUTE FUNCTION public.cosmiq_register_story_reference();
CREATE FUNCTION public.cosmiq_expired_story_references() RETURNS TABLE(path text)
 LANGUAGE sql SECURITY DEFINER SET search_path=public,pg_temp AS $$
 SELECT name FROM storage.objects WHERE bucket_id='cosmiq-storybook' AND (storage.foldername(name))[2]='references'
 AND created_at<now()-interval '1 day' ORDER BY created_at LIMIT 50;
$$;
REVOKE ALL ON FUNCTION public.cosmiq_expired_story_references() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.cosmiq_expired_story_references() TO service_role;
-- Cron uses the existing private internal secret, never a browser key.
SELECT cron.schedule('cosmiq-episode-worker','* * * * *', $$SELECT public.invoke_edge_function_with_internal_secret('cosmiq-episode-worker','{}'::jsonb);$$);
COMMIT;
