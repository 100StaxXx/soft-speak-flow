\set ON_ERROR_STOP 1

BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap;
SELECT no_plan();

\ir _support/helpers.sql

SELECT test_security.seed_fixtures();
SELECT test_security.set_auth('authenticated', '10000000-0000-0000-0000-000000000001');

UPDATE public.user_companion
SET
  current_stage = 2,
  current_xp = 30,
  core_element = 'fire',
  current_image_url = 'https://example.com/security-user-a-invalid-stage2.png',
  initial_image_url = 'https://example.com/security-user-a-egg.png',
  updated_at = NOW()
WHERE id = '22000000-0000-0000-0000-000000000001';

DELETE FROM public.companion_evolutions
WHERE companion_id = '22000000-0000-0000-0000-000000000001';

INSERT INTO public.companion_evolutions (
  companion_id,
  stage,
  image_url,
  xp_at_evolution,
  evolved_at
)
VALUES
  (
    '22000000-0000-0000-0000-000000000001',
    0,
    'https://example.com/security-user-a-egg.png',
    0,
    NOW() - INTERVAL '3 minutes'
  ),
  (
    '22000000-0000-0000-0000-000000000001',
    1,
    'https://example.com/security-user-a-stage1.png',
    10,
    NOW() - INTERVAL '2 minutes'
  ),
  (
    '22000000-0000-0000-0000-000000000001',
    2,
    'https://example.com/security-user-a-invalid-stage2.png',
    29,
    NOW() - INTERVAL '1 minute'
  );

SELECT is(
  public.get_highest_valid_claimed_companion_stage('22000000-0000-0000-0000-000000000001'::uuid),
  1,
  'highest valid claimed stage ignores evolution rows below the stage threshold'
);

SELECT ok(
  (SELECT repaired
   FROM public.repair_auto_advanced_companion_state('22000000-0000-0000-0000-000000000001'::uuid)
   LIMIT 1),
  'repair_auto_advanced_companion_state rolls impossible claimed stages back to the last valid stage'
);

SELECT is(
  (SELECT current_stage
   FROM public.user_companion
   WHERE id = '22000000-0000-0000-0000-000000000001'),
  1,
  'repair restores current_stage to the highest valid claimed stage'
);

SELECT is(
  (SELECT current_image_url
   FROM public.user_companion
   WHERE id = '22000000-0000-0000-0000-000000000001'),
  'https://example.com/security-user-a-stage1.png',
  'repair restores the latest valid claimed-stage image'
);

SELECT is(
  test_security.exec_row_count($$
    DELETE FROM public.companion_evolutions ce
    USING public.evolution_thresholds et
    WHERE ce.companion_id = '22000000-0000-0000-0000-000000000001'::uuid
      AND ce.stage = et.stage
      AND ce.stage > 0
      AND COALESCE(ce.xp_at_evolution, -1) < et.xp_required
  $$),
  1,
  'threshold cleanup removes invalid positive-stage evolution rows'
);

INSERT INTO public.companion_evolutions (
  companion_id,
  stage,
  image_url,
  xp_at_evolution,
  evolved_at
)
VALUES (
  '22000000-0000-0000-0000-000000000001',
  2,
  'https://example.com/security-user-a-stage2.png',
  30,
  NOW()
);

UPDATE public.user_companion
SET
  current_stage = 2,
  current_image_url = 'https://example.com/security-user-a-stage2.png',
  updated_at = NOW()
WHERE id = '22000000-0000-0000-0000-000000000001';

SELECT is(
  public.get_highest_valid_claimed_companion_stage('22000000-0000-0000-0000-000000000001'::uuid),
  2,
  'highest valid claimed stage includes legitimate evolution rows at the threshold'
);

INSERT INTO public.companion_evolutions (
  companion_id,
  stage,
  image_url,
  xp_at_evolution,
  evolved_at
)
VALUES (
  '22000000-0000-0000-0000-000000000001',
  5,
  'https://example.com/security-user-a-stage5.png',
  100,
  NOW()
);

SELECT is(
  public.get_highest_valid_claimed_companion_stage('22000000-0000-0000-0000-000000000001'::uuid),
  5,
  'highest valid claimed stage tolerates legacy gaps and visual-boundary rows'
);

SELECT is(
  (SELECT repaired
   FROM public.repair_auto_advanced_companion_state('22000000-0000-0000-0000-000000000001'::uuid)
   LIMIT 1),
  FALSE,
  'repair leaves already-valid claimed stages untouched'
);

SELECT is(
  (SELECT current_stage
   FROM public.user_companion
   WHERE id = '22000000-0000-0000-0000-000000000001'),
  2,
  'valid claimed stages survive reconciliation'
);

SELECT is(
  (SELECT current_image_url
   FROM public.user_companion
   WHERE id = '22000000-0000-0000-0000-000000000001'),
  'https://example.com/security-user-a-stage2.png',
  'valid claimed-stage images survive reconciliation'
);

SELECT set_config('app.settings.supabase_url', 'https://example.supabase.co', true);

UPDATE public.profiles
SET
  onboarding_completed = true,
  onboarding_step = 'complete',
  onboarding_data = jsonb_build_object(
    'walkthrough_completed', true,
    'guided_tutorial', jsonb_build_object(
      'completedSteps', jsonb_build_array(
        'quests_campaigns_intro',
        'create_quest',
        'morning_checkin',
        'evolve_companion',
        'post_evolution_companion_intro'
      ),
      'milestonesCompleted', jsonb_build_array(
        'complete_companion_evolution',
        'post_evolution_companion_intro'
      )
    )
  )
WHERE id = '10000000-0000-0000-0000-000000000001';

DELETE FROM public.companion_evolutions
WHERE companion_id = '22000000-0000-0000-0000-000000000001';

INSERT INTO public.companion_evolutions (
  companion_id,
  stage,
  image_url,
  xp_at_evolution,
  evolved_at
)
VALUES (
  '22000000-0000-0000-0000-000000000001',
  0,
  '/companion-eggs/egg__t0_egg__normal__nature.png',
  0,
  NOW() - INTERVAL '6 minutes'
);

UPDATE public.user_companion
SET
  preset_id = 'fox',
  spirit_animal = 'Fox',
  core_element = 'nature',
  current_stage = 0,
  current_xp = 100,
  current_image_url = '/companion-eggs/egg__t0_egg__normal__nature.png',
  initial_image_url = '/companion-eggs/egg__t0_egg__normal__nature.png',
  updated_at = NOW()
WHERE id = '22000000-0000-0000-0000-000000000001';

SELECT ok(
  (SELECT repaired
   FROM public.repair_auto_advanced_companion_state('22000000-0000-0000-0000-000000000001'::uuid)
   LIMIT 1),
  'repair restores legacy preset-backed level 5 companions even when only the egg claim row remains'
);

SELECT is(
  (SELECT current_stage
   FROM public.user_companion
   WHERE id = '22000000-0000-0000-0000-000000000001'),
  5,
  'legacy preset-backed companions are restored to their earned level when the hatch tutorial is complete'
);

SELECT is(
  public.get_highest_valid_claimed_companion_stage('22000000-0000-0000-0000-000000000001'::uuid),
  5,
  'legacy preset-backed companion repair backfills valid visual-boundary claim history'
);

SELECT is(
  (SELECT count(*)
   FROM public.companion_evolutions
   WHERE companion_id = '22000000-0000-0000-0000-000000000001'
     AND stage BETWEEN 1 AND 5),
  2::bigint,
  'legacy preset-backed repair inserts only missing visual-boundary evolution rows up to the restored level'
);

SELECT is(
  (SELECT count(*)
   FROM public.companion_evolutions
   WHERE companion_id = '22000000-0000-0000-0000-000000000001'
     AND stage IN (2, 3, 4)),
  0::bigint,
  'legacy preset-backed repair does not create intermediate evolution rows'
);

SELECT is(
  (SELECT current_image_url
   FROM public.user_companion
   WHERE id = '22000000-0000-0000-0000-000000000001'),
  'https://example.supabase.co/storage/v1/object/public/companion-presets/fox/t2_guardian/normal/fox__t2_guardian__normal__nature.png',
  'legacy preset-backed repair restores the later-tier companion art instead of leaving the egg art in place'
);

UPDATE public.profiles
SET
  onboarding_completed = false,
  onboarding_step = 'journey-begins',
  onboarding_data = '{}'::jsonb
WHERE id = '10000000-0000-0000-0000-000000000001';

DELETE FROM public.companion_evolutions
WHERE companion_id = '22000000-0000-0000-0000-000000000001';

INSERT INTO public.companion_evolutions (
  companion_id,
  stage,
  image_url,
  xp_at_evolution,
  evolved_at
)
VALUES (
  '22000000-0000-0000-0000-000000000001',
  0,
  '/companion-eggs/egg__t0_egg__normal__fire.png',
  0,
  NOW() - INTERVAL '2 minutes'
);

UPDATE public.user_companion
SET
  preset_id = 'griffin',
  spirit_animal = 'Griffin',
  core_element = 'fire',
  current_stage = 0,
  current_xp = 100,
  current_image_url = '/companion-eggs/egg__t0_egg__normal__fire.png',
  initial_image_url = '/companion-eggs/egg__t0_egg__normal__fire.png',
  updated_at = NOW()
WHERE id = '22000000-0000-0000-0000-000000000001';

SELECT is(
  (SELECT repaired
   FROM public.repair_auto_advanced_companion_state('22000000-0000-0000-0000-000000000001'::uuid)
   LIMIT 1),
  FALSE,
  'repair leaves true stage 0 eggs untouched when there is no hatch-progress evidence'
);

SELECT is(
  (SELECT current_stage
   FROM public.user_companion
   WHERE id = '22000000-0000-0000-0000-000000000001'),
  0,
  'true stage 0 eggs stay at stage 0 even when XP is high but no hatch progress exists'
);

SELECT is(
  public.get_highest_valid_claimed_companion_stage('22000000-0000-0000-0000-000000000001'::uuid),
  0,
  'strict stage 0 egg validation still holds for true unhatched companions'
);

SELECT test_security.reset_auth();

SELECT * FROM finish();
ROLLBACK;
