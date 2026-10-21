\set ON_ERROR_STOP 1
BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap;
SELECT no_plan();
\ir _support/helpers.sql
SELECT test_security.seed_fixtures();
UPDATE public.user_companion SET product_mode='graceward',current_stage=1,current_xp=10
 WHERE user_id='10000000-0000-0000-0000-000000000001';
UPDATE public.user_companion SET product_mode='cosmiq',current_stage=1,current_xp=10
 WHERE user_id='10000000-0000-0000-0000-000000000002';
SELECT test_security.set_auth('anon');
SELECT throws_ok($$SELECT public.complete_graceward_bible_quest(1,ARRAY[1,0,2,1,3])$$,'42501',NULL,'anonymous callers cannot award rewards');
SELECT test_security.set_auth('authenticated','10000000-0000-0000-0000-000000000002');
SELECT throws_ok($$SELECT public.complete_graceward_bible_quest(1,ARRAY[1,0,2,1,3])$$,'P0001','A hatched Graceward companion is required','Cosmiq cannot earn Adventure rewards');
SELECT test_security.set_auth('authenticated','10000000-0000-0000-0000-000000000001');
SELECT throws_ok($$SELECT public.complete_graceward_bible_quest(2,ARRAY[0,2,1,3,0])$$,'P0001','Previous trail is incomplete','trails unlock in order');
SELECT throws_ok($$SELECT public.complete_graceward_bible_quest(1,ARRAY[1,0,NULL,1,3])$$,'P0001','Five valid answers are required','malformed answers cannot claim rewards');
CREATE TEMP TABLE first_reward AS SELECT public.complete_graceward_bible_quest(1,ARRAY[1,0,2,1,3]) AS value;
SELECT is((SELECT (value->>'score')::integer FROM first_reward),5,'server scores correct answers');
SELECT is((SELECT (value->>'xp_awarded')::integer FROM first_reward),20,'real XP writer awards the advertised 20 XP');
SELECT is((SELECT (value->>'coins_awarded')::integer FROM first_reward),10,'first completion earns ten coins');
SELECT is((SELECT current_xp FROM public.user_companion WHERE user_id=auth.uid()),30,'real companion XP grows');
SELECT is((public.complete_graceward_bible_quest(1,ARRAY[1,0,2,1,3])->>'already_completed')::boolean,true,'retry returns the saved receipt');
SELECT is((SELECT current_xp FROM public.user_companion WHERE user_id=auth.uid()),30,'retry does not award twice');
SELECT throws_ok($$INSERT INTO public.graceward_adventure_completions(user_id,node_id,score) VALUES(auth.uid(),3,5)$$,'42501',NULL,'clients cannot forge completion');
SELECT test_security.reset_auth();
CREATE FUNCTION test_security.fail_adventure_xp() RETURNS trigger LANGUAGE plpgsql AS $$
 BEGIN RAISE EXCEPTION 'Injected Adventure XP failure' USING ERRCODE='23514'; END;
$$;
CREATE TRIGGER test_adventure_xp_failure BEFORE INSERT ON public.xp_events
 FOR EACH ROW EXECUTE FUNCTION test_security.fail_adventure_xp();
SELECT test_security.set_auth('authenticated','10000000-0000-0000-0000-000000000001');
SELECT throws_ok($$SELECT public.complete_graceward_bible_quest(2,ARRAY[0,2,1,3,0])$$,'23514','Injected Adventure XP failure','XP failure rolls back completion');
SELECT is((SELECT count(*)::integer FROM public.get_graceward_adventure_progress()),1,'failed reward leaves next trail incomplete');
SELECT is((SELECT current_xp FROM public.user_companion WHERE user_id=auth.uid()),30,'failed reward leaves XP unchanged');
SELECT test_security.reset_auth();
DROP TRIGGER test_adventure_xp_failure ON public.xp_events;
SELECT test_security.set_auth('authenticated','10000000-0000-0000-0000-000000000001');
SELECT is((public.complete_graceward_bible_quest(2,ARRAY[0,2,1,3,0])->>'xp_awarded')::integer,20,'second trail earns real XP');
SELECT is((public.complete_graceward_bible_quest(3,ARRAY[0,0,0,0,0])->>'score')::integer,1,'participation completion uses server score');
SELECT is((SELECT count(*)::integer FROM public.get_graceward_adventure_progress()),3,'chapter progress persists');
SELECT is((SELECT current_xp FROM public.user_companion WHERE user_id=auth.uid()),70,'chapter awards exactly sixty XP');
SELECT test_security.set_auth('authenticated','10000000-0000-0000-0000-000000000002');
SELECT is((SELECT count(*)::integer FROM public.get_graceward_adventure_progress()),0,'another account cannot read progress');
SELECT is((SELECT current_xp FROM public.user_companion WHERE user_id=auth.uid()),10,'Cosmiq XP is unchanged');
SELECT * FROM finish();
ROLLBACK;
