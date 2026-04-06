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

SELECT test_security.reset_auth();

SELECT * FROM finish();
ROLLBACK;
