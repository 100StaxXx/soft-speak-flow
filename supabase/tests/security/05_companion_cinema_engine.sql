\set ON_ERROR_STOP 1

BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap;
SELECT no_plan();

\ir _support/helpers.sql

SELECT test_security.seed_fixtures();

UPDATE public.user_companion
SET
  preset_id = 'fox',
  spirit_animal = 'Fox',
  core_element = 'nature',
  product_mode = 'cosmiq',
  current_stage = 1,
  current_xp = 10,
  current_image_url = 'https://example.com/cosmiq-stage-1.png',
  initial_image_url = 'https://example.com/cosmiq-egg.png'
WHERE id = '22000000-0000-0000-0000-000000000001';

UPDATE public.user_companion
SET
  preset_id = NULL,
  spirit_animal = 'Dove',
  core_element = 'light',
  product_mode = 'graceward',
  current_stage = 1,
  current_xp = 10
WHERE id = '22000000-0000-0000-0000-000000000002';

SELECT is(
  (SELECT product_mode FROM public.user_companion
   WHERE id = '22000000-0000-0000-0000-000000000001'),
  'cosmiq',
  'cinema fixture is an explicit Cosmiq companion'
);

SELECT test_security.set_auth('service_role');

CREATE TEMP TABLE first_evolution_event AS
SELECT public.enqueue_cosmiq_cinema_event_internal(
  '10000000-0000-0000-0000-000000000001',
  '22000000-0000-0000-0000-000000000001'
) AS event_id;

GRANT SELECT ON first_evolution_event TO authenticated;

SELECT is(
  (SELECT count(*) FROM public.companion_cinema_events
   WHERE companion_id = '22000000-0000-0000-0000-000000000001'
     AND event_type = 'evolution'),
  1::bigint,
  'hatch progression queues exactly one personalized evolution event'
);

SELECT is(
  (SELECT boundary_level FROM public.companion_cinema_events
   WHERE id = (SELECT event_id FROM first_evolution_event)),
  5,
  'the first background package targets only the next visual boundary'
);

SELECT results_eq(
  $$
    SELECT duration_seconds, audio_strategy, provider_model, max_render_attempts
    FROM public.companion_cinema_events
    WHERE id = (SELECT event_id FROM first_evolution_event)
  $$,
  $$ VALUES (
    12,
    'native'::text,
    'fal-ai/kling-video/v3/standard/image-to-video'::text,
    2
  ) $$,
  'evolution events use the standard native-audio two-candidate contract'
);

SELECT is(
  (SELECT context_snapshot ->> 'currentStage'
   FROM public.companion_cinema_events
   WHERE id = (SELECT event_id FROM first_evolution_event)),
  '1',
  'the event freezes the per-user progression context used for rendering'
);

CREATE TEMP TABLE duplicate_evolution_event AS
SELECT public.enqueue_cosmiq_cinema_event_internal(
  '10000000-0000-0000-0000-000000000001',
  '22000000-0000-0000-0000-000000000001'
) AS event_id;

SELECT is(
  (SELECT event_id FROM duplicate_evolution_event),
  (SELECT event_id FROM first_evolution_event),
  'duplicate background requests reuse the same paid-work identity'
);

INSERT INTO public.companion_cinema_renders (
  event_id, user_id, companion_id, candidate_index, status, provider_model,
  provider_task_id, provider_status, prompt, start_image_url,
  end_image_bucket, end_image_path, duration_seconds, generate_audio,
  video_bucket, video_path, qa_score, selected, retry_count, error_code,
  error_message, submitted_at, completed_at
)
VALUES (
  (SELECT event_id FROM first_evolution_event),
  '10000000-0000-0000-0000-000000000001',
  '22000000-0000-0000-0000-000000000001',
  1, 'failed', 'fal-ai/kling-video/v3/standard/image-to-video',
  'stale-provider-task', 'FAILED', 'stale retry candidate',
  'https://example.com/cosmiq-stage-1.png', 'companion-cinema-private',
  'user-a/event/end.webp', 12, true, 'companion-cinema-private',
  'user-a/event/stale.mp4', 0.1, false, 3, 'provider_timeout',
  'synthetic render failure', now(), now()
);

UPDATE public.companion_cinema_events
SET status = 'failed',
    render_attempt_count = 2,
    selected_render_id = (
      SELECT id FROM public.companion_cinema_renders
      WHERE event_id = (SELECT event_id FROM first_evolution_event)
        AND candidate_index = 1
    ),
    video_bucket = 'companion-cinema-private',
    video_path = 'user-a/event/stale.mp4',
    ready_at = now(),
    error_code = 'provider_timeout',
    error_message = 'synthetic failure',
    next_retry_at = now() + interval '5 minutes'
WHERE id = (SELECT event_id FROM first_evolution_event);

SELECT public.enqueue_cosmiq_cinema_event_internal(
  '10000000-0000-0000-0000-000000000001',
  '22000000-0000-0000-0000-000000000001'
);

SELECT results_eq(
  $$
    SELECT status, render_attempt_count, selected_render_id IS NULL,
           video_path IS NULL, ready_at IS NULL, error_code,
           error_message, next_retry_at IS NULL
    FROM public.companion_cinema_events
    WHERE id = (SELECT event_id FROM first_evolution_event)
  $$,
  $$ VALUES (
    'queued'::text, 0, true, true, true,
    NULL::text, NULL::text, true
  ) $$,
  'retrying a terminal event clears stale event state and diagnostics'
);

SELECT results_eq(
  $$
    SELECT status, provider_task_id IS NULL, provider_status IS NULL,
           video_path IS NULL, qa_score IS NULL, selected, retry_count,
           error_code IS NULL, submitted_at IS NULL, completed_at IS NULL
    FROM public.companion_cinema_renders
    WHERE event_id = (SELECT event_id FROM first_evolution_event)
      AND candidate_index = 1
  $$,
  $$ VALUES (
    'queued'::text, true, true, true, true, false, 0,
    true, true, true
  ) $$,
  'retrying terminal work never polls or selects a stale paid provider task'
);

UPDATE public.companion_cinema_renders
SET status = 'failed',
    provider_task_id = 'active-attempt-failure',
    retry_count = 1
WHERE event_id = (SELECT event_id FROM first_evolution_event)
  AND candidate_index = 1;

SELECT public.enqueue_cosmiq_cinema_event_internal(
  '10000000-0000-0000-0000-000000000001',
  '22000000-0000-0000-0000-000000000001'
);

SELECT is(
  (SELECT provider_task_id FROM public.companion_cinema_renders
   WHERE event_id = (SELECT event_id FROM first_evolution_event)
     AND candidate_index = 1),
  'active-attempt-failure',
  'a duplicate enqueue does not restart a candidate while its event is nonterminal'
);

DELETE FROM public.companion_cinema_renders
WHERE event_id = (SELECT event_id FROM first_evolution_event);

SELECT throws_ok(
  $$
    SELECT public.enqueue_cosmiq_cinema_event_internal(
      '10000000-0000-0000-0000-000000000002',
      '22000000-0000-0000-0000-000000000002'
    )
  $$,
  'P0001',
  'Cinematic prebuilds are only available for Cosmiq companions',
  'Graceward is rejected before any evolution cinema event can be created'
);

CREATE TEMP TABLE first_watch AS
SELECT * FROM public.start_companion_cinema_interaction_internal(
  '10000000-0000-0000-0000-000000000001',
  '22000000-0000-0000-0000-000000000001',
  'watch',
  'Focused Watch',
  'Your companion kept watch.',
  NULL,
  '{"focusMinutes":25}'::jsonb,
  now() + interval '25 minutes',
  8,
  'fal-ai/kling-video/v3/standard/image-to-video'
);

SELECT is((SELECT reused FROM first_watch), false, 'the first Watch creates paid work');

CREATE TEMP TABLE duplicate_watch AS
SELECT * FROM public.start_companion_cinema_interaction_internal(
  '10000000-0000-0000-0000-000000000001',
  '22000000-0000-0000-0000-000000000001',
  'watch',
  'Focused Watch',
  'Your companion kept watch.',
  NULL,
  '{"focusMinutes":25}'::jsonb,
  now() + interval '25 minutes',
  8,
  'fal-ai/kling-video/v3/standard/image-to-video'
);

SELECT is((SELECT reused FROM duplicate_watch), true, 'rapid duplicate Watch starts reuse the active run');
SELECT is(
  (SELECT run_id FROM duplicate_watch),
  (SELECT run_id FROM first_watch),
  'the duplicate Watch returns the original run identity'
);
SELECT is(
  (SELECT count(*) FROM public.companion_cinema_events
   WHERE event_type = 'watch'
     AND companion_id = '22000000-0000-0000-0000-000000000001'),
  1::bigint,
  'Watch idempotency prevents duplicate provider events'
);

SELECT throws_ok(
  $$
    SELECT * FROM public.start_companion_cinema_interaction_internal(
      '10000000-0000-0000-0000-000000000001',
      '22000000-0000-0000-0000-000000000001',
      'forge', 'Forge', 'Forged.', NULL, '{}'::jsonb, NULL, 12,
      'fal-ai/kling-video/v3/standard/image-to-video'
    )
  $$,
  'P0001',
  'cinema_forge_intention_required',
  'Forge rejects a missing intention before paid work starts'
);

SELECT throws_ok(
  $$
    SELECT * FROM public.start_companion_cinema_interaction_internal(
      '10000000-0000-0000-0000-000000000002',
      '22000000-0000-0000-0000-000000000002',
      'watch', 'Watch', 'Watched.', NULL, '{}'::jsonb, NULL, 8,
      'fal-ai/kling-video/v3/standard/image-to-video'
    )
  $$,
  'P0001',
  'cinema_companion_unavailable',
  'Graceward is rejected before interaction cinema work starts'
);

CREATE TEMP TABLE failed_forge AS
SELECT * FROM public.start_companion_cinema_interaction_internal(
  '10000000-0000-0000-0000-000000000001',
  '22000000-0000-0000-0000-000000000001',
  'forge', 'Forge', 'Forged.', 'Ship the release', '{}'::jsonb,
  now() + interval '15 minutes', 12,
  'fal-ai/kling-video/v3/standard/image-to-video'
);

UPDATE public.companion_cinema_events
SET status = 'failed', error_code = 'synthetic_failure'
WHERE id = (SELECT event_id FROM failed_forge);

CREATE TEMP TABLE retried_forge AS
SELECT * FROM public.start_companion_cinema_interaction_internal(
  '10000000-0000-0000-0000-000000000001',
  '22000000-0000-0000-0000-000000000001',
  'forge', 'Forge', 'Forged.', 'Ship the release', '{}'::jsonb,
  now() + interval '15 minutes', 12,
  'fal-ai/kling-video/v3/standard/image-to-video'
);

SELECT isnt(
  (SELECT run_id FROM retried_forge),
  (SELECT run_id FROM failed_forge),
  'a terminal provider failure starts a fresh recoverable interaction run'
);

SELECT is(
  (SELECT status FROM public.companion_interaction_runs
   WHERE id = (SELECT run_id FROM failed_forge)),
  'failed',
  'the stale active run is repaired when its linked event is terminal'
);

UPDATE public.companion_interaction_runs
SET status = 'completed', completed_at = now()
WHERE id = (SELECT run_id FROM first_watch);
UPDATE public.companion_cinema_limits SET daily_limit = 1 WHERE interaction_type = 'watch';

SELECT throws_ok(
  $$
    SELECT * FROM public.start_companion_cinema_interaction_internal(
      '10000000-0000-0000-0000-000000000001',
      '22000000-0000-0000-0000-000000000001',
      'watch', 'Watch again', 'Watched.', NULL, '{}'::jsonb, NULL, 8,
      'fal-ai/kling-video/v3/standard/image-to-video'
    )
  $$,
  'P0001',
  'cinema_daily_limit_reached',
  'the database enforces per-user daily cinema quotas'
);

INSERT INTO public.companion_cinema_renders (
  event_id, user_id, companion_id, candidate_index, status, provider_model,
  prompt, start_image_url, end_image_bucket, end_image_path,
  duration_seconds, generate_audio, video_bucket, video_path, qa_score, selected
)
VALUES
  (
    (SELECT event_id FROM first_evolution_event),
    '10000000-0000-0000-0000-000000000001',
    '22000000-0000-0000-0000-000000000001',
    1, 'selected', 'fal-ai/kling-video/v3/standard/image-to-video',
    'synthetic candidate one', 'https://example.com/cosmiq-stage-1.png',
    'companion-cinema-private', 'user-a/event/end.webp', 12, true,
    'companion-cinema-private', 'user-a/event/candidate-1.mp4', 0.95, true
  ),
  (
    (SELECT event_id FROM first_evolution_event),
    '10000000-0000-0000-0000-000000000001',
    '22000000-0000-0000-0000-000000000001',
    2, 'rejected', 'fal-ai/kling-video/v3/standard/image-to-video',
    'synthetic candidate two', 'https://example.com/cosmiq-stage-1.png',
    'companion-cinema-private', 'user-a/event/end.webp', 12, true,
    'companion-cinema-private', 'user-a/event/candidate-2.mp4', 0.72, false
  );

UPDATE public.companion_cinema_events
SET status = 'ready',
    selected_render_id = (
      SELECT id FROM public.companion_cinema_renders
      WHERE event_id = (SELECT event_id FROM first_evolution_event)
        AND selected
    ),
    canonical_image_bucket = 'companion-cinema-private',
    canonical_image_path = 'user-a/event/end.webp',
    video_bucket = 'companion-cinema-private',
    video_path = 'user-a/event/candidate-1.mp4',
    ready_at = now()
WHERE id = (SELECT event_id FROM first_evolution_event);

SELECT test_security.reset_auth();
SELECT test_security.set_auth('authenticated', '10000000-0000-0000-0000-000000000001');

SELECT is(
  (SELECT status FROM public.get_companion_cinema_statuses(
    '22000000-0000-0000-0000-000000000001'
  ) WHERE event_id = (SELECT event_id FROM first_evolution_event)),
  'ready',
  'the owner sees a ready package through the safe status RPC'
);

SELECT is(
  has_function_privilege(
    'authenticated',
    'public.request_next_cosmiq_cinema_event(uuid)',
    'EXECUTE'
  ),
  false,
  'authenticated users cannot bypass rollout controls to fill the cinema queue'
);

SELECT is(
  has_function_privilege(
    'authenticated',
    'public.register_user_storage_asset(uuid,text,text,text,text,uuid)',
    'EXECUTE'
  ),
  false,
  'authenticated users cannot reassign storage-ledger ownership for known paths'
);

SELECT throws_ok(
  $$ SELECT * FROM public.companion_cinema_events $$,
  '42501',
  'permission denied for table companion_cinema_events',
  'authenticated users cannot read private provider or storage metadata directly'
);

SELECT test_security.reset_auth();
SELECT test_security.set_auth('authenticated', '10000000-0000-0000-0000-000000000002');

SELECT is(
  (SELECT count(*) FROM public.get_companion_cinema_statuses(
    '22000000-0000-0000-0000-000000000001'
  )),
  0::bigint,
  'another user cannot discover a companion cinema package'
);

SELECT test_security.reset_auth();
SELECT test_security.set_auth('service_role');

UPDATE public.companion_cinema_events
SET status = 'revealed', revealed_at = now()
WHERE id = (SELECT event_id FROM first_evolution_event);

UPDATE public.user_companion
SET current_stage = 5,
    current_xp = 100,
    current_image_url = 'https://example.com/cosmiq-stage-5.png'
WHERE id = '22000000-0000-0000-0000-000000000001';

SELECT public.enqueue_cosmiq_cinema_event_internal(
  '10000000-0000-0000-0000-000000000001',
  '22000000-0000-0000-0000-000000000001'
);

SELECT is(
  (SELECT count(*) FROM public.companion_cinema_events
   WHERE companion_id = '22000000-0000-0000-0000-000000000001'
     AND event_type = 'evolution'
     AND boundary_level = 13),
  1::bigint,
  'revealing Level 5 permits exactly the next Level 13 background package'
);
SELECT is(
  (SELECT count(*) FROM public.companion_cinema_events
   WHERE companion_id = '22000000-0000-0000-0000-000000000001'
     AND event_type = 'evolution'
     AND boundary_level > 13),
  0::bigint,
  'future evolution identity remains personalized instead of being frozen at hatch'
);

SELECT test_security.reset_auth();

DELETE FROM public.user_companion
WHERE id = '22000000-0000-0000-0000-000000000001';

SELECT is(
  (SELECT count(*) FROM public.companion_cinema_events
   WHERE companion_id = '22000000-0000-0000-0000-000000000001'),
  0::bigint,
  'companion reset cascades through cinema events'
);
SELECT is(
  (SELECT count(*) FROM public.companion_cinema_renders
   WHERE companion_id = '22000000-0000-0000-0000-000000000001'),
  0::bigint,
  'companion reset cascades through private render records'
);
SELECT is(
  (SELECT count(*) FROM public.companion_interaction_runs
   WHERE companion_id = '22000000-0000-0000-0000-000000000001'),
  0::bigint,
  'companion reset cascades through interaction runs'
);

SELECT is(
  (SELECT public FROM storage.buckets WHERE id = 'companion-cinema-private'),
  false,
  'cinema assets are provisioned in a private bucket'
);

SELECT is(
  (
    SELECT count(*)
    FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND (
        COALESCE(qual, '') LIKE '%companion-cinema-private%'
        OR COALESCE(with_check, '') LIKE '%companion-cinema-private%'
      )
  ),
  0::bigint,
  'private cinema storage has no authenticated or public object policy'
);

SELECT * FROM finish();
ROLLBACK;
