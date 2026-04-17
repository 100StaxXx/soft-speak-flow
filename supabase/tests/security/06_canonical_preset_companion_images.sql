\set ON_ERROR_STOP 1

BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap;
SELECT no_plan();

\ir _support/helpers.sql

SELECT test_security.seed_fixtures();
SELECT set_config('app.settings.supabase_url', 'https://example.supabase.co', true);

UPDATE public.user_companion
SET
  preset_id = 'fox',
  spirit_animal = 'Fox',
  core_element = 'nature',
  current_stage = 5,
  current_image_url = 'https://example.com/custom-fox-current.png',
  current_image_focal_x = 0.42,
  current_image_focal_y = 0.58,
  initial_image_url = 'https://example.com/custom-fox-initial.png',
  initial_image_focal_x = 0.31,
  initial_image_focal_y = 0.69,
  dormant_image_url = 'https://example.com/custom-fox-dormant.png',
  dormant_image_focal_x = 0.12,
  dormant_image_focal_y = 0.88,
  neglected_image_url = 'https://example.com/custom-fox-neglected.png',
  neglected_image_focal_x = 0.19,
  neglected_image_focal_y = 0.81,
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
    'https://example.com/custom-fox-stage0.png',
    0,
    NOW() - INTERVAL '5 minutes'
  ),
  (
    '22000000-0000-0000-0000-000000000001',
    5,
    'https://example.com/custom-fox-stage5.png',
    100,
    NOW() - INTERVAL '1 minute'
  );

UPDATE public.user_companion
SET
  preset_id = 'dragon',
  spirit_animal = 'Dragon',
  core_element = 'fire',
  current_stage = 0,
  current_image_url = 'https://example.com/custom-dragon-egg.png',
  initial_image_url = 'https://example.com/custom-dragon-initial.png',
  dormant_image_url = 'https://example.com/custom-dragon-dormant.png',
  dormant_image_focal_x = 0.2,
  dormant_image_focal_y = 0.8,
  neglected_image_url = 'https://example.com/custom-dragon-neglected.png',
  neglected_image_focal_x = 0.3,
  neglected_image_focal_y = 0.7,
  updated_at = NOW()
WHERE id = '22000000-0000-0000-0000-000000000002';

DELETE FROM public.companion_evolutions
WHERE companion_id = '22000000-0000-0000-0000-000000000002';

INSERT INTO public.companion_evolutions (
  companion_id,
  stage,
  image_url,
  xp_at_evolution,
  evolved_at
)
VALUES (
  '22000000-0000-0000-0000-000000000002',
  0,
  'https://example.com/custom-dragon-stage0.png',
  0,
  NOW()
);

INSERT INTO public.user_companion (
  id,
  user_id,
  preset_id,
  favorite_color,
  spirit_animal,
  core_element,
  story_tone,
  current_stage,
  current_xp,
  current_image_url,
  initial_image_url,
  dormant_image_url,
  neglected_image_url
)
VALUES (
  '22000000-0000-0000-0000-0000000000aa',
  '10000000-0000-0000-0000-000000000003',
  'raven',
  'violet',
  'Raven',
  'void',
  'epic_adventure',
  5,
  100,
  'https://example.com/custom-raven-current.png',
  'https://example.com/custom-raven-initial.png',
  'https://example.com/custom-raven-dormant.png',
  'https://example.com/custom-raven-neglected.png'
)
ON CONFLICT (id) DO UPDATE
SET
  preset_id = EXCLUDED.preset_id,
  current_stage = EXCLUDED.current_stage,
  current_xp = EXCLUDED.current_xp,
  current_image_url = EXCLUDED.current_image_url,
  initial_image_url = EXCLUDED.initial_image_url,
  dormant_image_url = EXCLUDED.dormant_image_url,
  neglected_image_url = EXCLUDED.neglected_image_url,
  core_element = EXCLUDED.core_element,
  spirit_animal = EXCLUDED.spirit_animal,
  updated_at = NOW();

DELETE FROM public.companion_evolutions
WHERE companion_id = '22000000-0000-0000-0000-0000000000aa';

INSERT INTO public.companion_evolutions (
  companion_id,
  stage,
  image_url,
  xp_at_evolution,
  evolved_at
)
VALUES (
  '22000000-0000-0000-0000-0000000000aa',
  5,
  'https://example.com/custom-raven-stage5.png',
  100,
  NOW()
);

WITH active_shipped_presets(id) AS (
  VALUES
    ('dragon'),
    ('wolf'),
    ('fox'),
    ('owl'),
    ('lion'),
    ('phoenix'),
    ('pegasus'),
    ('griffin'),
    ('sphinx'),
    ('leviathan'),
    ('mechanicaldragon'),
    ('tanuki'),
    ('buttercat')
),
full_remote_presets(id) AS (
  VALUES
    ('dragon'),
    ('wolf'),
    ('fox'),
    ('owl'),
    ('lion'),
    ('phoenix'),
    ('pegasus'),
    ('leviathan'),
    ('buttercat')
),
canonical_user_companion_images AS (
  SELECT
    uc.id,
    COALESCE(uc.current_stage, 0) AS current_stage,
    '/companion-eggs/egg__t0_egg__normal__' || public.normalize_companion_element_slug(uc.core_element) || '.png'
      AS canonical_initial_image_url,
    CASE
      WHEN COALESCE(uc.current_stage, 0) <= 0 THEN
        '/companion-eggs/egg__t0_egg__normal__' || public.normalize_companion_element_slug(uc.core_element) || '.png'
      WHEN COALESCE(uc.current_stage, 0) <= 20 THEN
        public.resolve_companion_preset_stage_image_url(
          uc.preset_id,
          uc.current_stage,
          uc.core_element,
          'normal'
        )
      WHEN frp.id IS NOT NULL THEN
        public.resolve_companion_preset_stage_image_url(
          uc.preset_id,
          uc.current_stage,
          uc.core_element,
          'normal'
        )
      ELSE NULL
    END AS canonical_current_image_url,
    CASE
      WHEN COALESCE(uc.current_stage, 0) <= 0 THEN NULL
      WHEN frp.id IS NOT NULL THEN
        public.resolve_companion_preset_stage_image_url(
          uc.preset_id,
          uc.current_stage,
          uc.core_element,
          'dormant'
        )
      ELSE NULL
    END AS canonical_dormant_image_url,
    CASE
      WHEN COALESCE(uc.current_stage, 0) <= 0 THEN NULL
      WHEN frp.id IS NOT NULL THEN
        public.resolve_companion_preset_stage_image_url(
          uc.preset_id,
          uc.current_stage,
          uc.core_element,
          'neglected'
        )
      ELSE NULL
    END AS canonical_neglected_image_url
  FROM public.user_companion AS uc
  INNER JOIN active_shipped_presets AS asp
    ON asp.id = uc.preset_id
  LEFT JOIN full_remote_presets AS frp
    ON frp.id = uc.preset_id
)
UPDATE public.user_companion AS uc
SET
  initial_image_url = cui.canonical_initial_image_url,
  initial_image_focal_x = CASE
    WHEN cui.canonical_initial_image_url IS DISTINCT FROM uc.initial_image_url THEN NULL
    ELSE uc.initial_image_focal_x
  END,
  initial_image_focal_y = CASE
    WHEN cui.canonical_initial_image_url IS DISTINCT FROM uc.initial_image_url THEN NULL
    ELSE uc.initial_image_focal_y
  END,
  current_image_url = COALESCE(cui.canonical_current_image_url, uc.current_image_url),
  current_image_focal_x = CASE
    WHEN cui.canonical_current_image_url IS NOT NULL
      AND cui.canonical_current_image_url IS DISTINCT FROM uc.current_image_url THEN NULL
    ELSE uc.current_image_focal_x
  END,
  current_image_focal_y = CASE
    WHEN cui.canonical_current_image_url IS NOT NULL
      AND cui.canonical_current_image_url IS DISTINCT FROM uc.current_image_url THEN NULL
    ELSE uc.current_image_focal_y
  END,
  dormant_image_url = CASE
    WHEN cui.current_stage <= 0 THEN NULL
    WHEN cui.canonical_dormant_image_url IS NOT NULL THEN cui.canonical_dormant_image_url
    ELSE uc.dormant_image_url
  END,
  dormant_image_focal_x = CASE
    WHEN cui.current_stage <= 0 THEN NULL
    WHEN cui.canonical_dormant_image_url IS NOT NULL
      AND cui.canonical_dormant_image_url IS DISTINCT FROM uc.dormant_image_url THEN NULL
    ELSE uc.dormant_image_focal_x
  END,
  dormant_image_focal_y = CASE
    WHEN cui.current_stage <= 0 THEN NULL
    WHEN cui.canonical_dormant_image_url IS NOT NULL
      AND cui.canonical_dormant_image_url IS DISTINCT FROM uc.dormant_image_url THEN NULL
    ELSE uc.dormant_image_focal_y
  END,
  neglected_image_url = CASE
    WHEN cui.current_stage <= 0 THEN NULL
    WHEN cui.canonical_neglected_image_url IS NOT NULL THEN cui.canonical_neglected_image_url
    ELSE uc.neglected_image_url
  END,
  neglected_image_focal_x = CASE
    WHEN cui.current_stage <= 0 THEN NULL
    WHEN cui.canonical_neglected_image_url IS NOT NULL
      AND cui.canonical_neglected_image_url IS DISTINCT FROM uc.neglected_image_url THEN NULL
    ELSE uc.neglected_image_focal_x
  END,
  neglected_image_focal_y = CASE
    WHEN cui.current_stage <= 0 THEN NULL
    WHEN cui.canonical_neglected_image_url IS NOT NULL
      AND cui.canonical_neglected_image_url IS DISTINCT FROM uc.neglected_image_url THEN NULL
    ELSE uc.neglected_image_focal_y
  END,
  updated_at = NOW()
FROM canonical_user_companion_images AS cui
WHERE uc.id = cui.id;

WITH active_shipped_presets(id) AS (
  VALUES
    ('dragon'),
    ('wolf'),
    ('fox'),
    ('owl'),
    ('lion'),
    ('phoenix'),
    ('pegasus'),
    ('griffin'),
    ('sphinx'),
    ('leviathan'),
    ('mechanicaldragon'),
    ('tanuki'),
    ('buttercat')
),
full_remote_presets(id) AS (
  VALUES
    ('dragon'),
    ('wolf'),
    ('fox'),
    ('owl'),
    ('lion'),
    ('phoenix'),
    ('pegasus'),
    ('leviathan'),
    ('buttercat')
)
UPDATE public.companion_evolutions AS ce
SET
  image_url = canonical_evolution_images.canonical_image_url
FROM (
  SELECT
    ce_inner.id,
    CASE
      WHEN COALESCE(ce_inner.stage, 0) <= 0 THEN
        '/companion-eggs/egg__t0_egg__normal__' || public.normalize_companion_element_slug(uc.core_element) || '.png'
      WHEN COALESCE(ce_inner.stage, 0) <= 20 THEN
        public.resolve_companion_preset_stage_image_url(
          uc.preset_id,
          ce_inner.stage,
          uc.core_element,
          'normal'
        )
      WHEN frp.id IS NOT NULL THEN
        public.resolve_companion_preset_stage_image_url(
          uc.preset_id,
          ce_inner.stage,
          uc.core_element,
          'normal'
        )
      ELSE NULL
    END AS canonical_image_url
  FROM public.companion_evolutions AS ce_inner
  INNER JOIN public.user_companion AS uc
    ON uc.id = ce_inner.companion_id
  INNER JOIN active_shipped_presets AS asp
    ON asp.id = uc.preset_id
  LEFT JOIN full_remote_presets AS frp
    ON frp.id = uc.preset_id
) AS canonical_evolution_images
WHERE ce.id = canonical_evolution_images.id
  AND canonical_evolution_images.canonical_image_url IS NOT NULL;

SELECT is(
  (SELECT initial_image_url
   FROM public.user_companion
   WHERE id = '22000000-0000-0000-0000-000000000001'),
  '/companion-eggs/egg__t0_egg__normal__nature.png',
  'preset companions reset initial_image_url to the shared elemental egg'
);

SELECT is(
  (SELECT current_image_url
   FROM public.user_companion
   WHERE id = '22000000-0000-0000-0000-000000000001'),
  'https://example.supabase.co/storage/v1/object/public/companion-presets/fox/t2_guardian/normal/fox__t2_guardian__normal__nature.png',
  'positive-stage preset companions adopt the canonical normal preset art'
);

SELECT is(
  (SELECT dormant_image_url
   FROM public.user_companion
   WHERE id = '22000000-0000-0000-0000-000000000001'),
  'https://example.supabase.co/storage/v1/object/public/companion-presets/fox/t2_guardian/dormant/fox__t2_guardian__dormant__nature.png',
  'positive-stage preset companions adopt the canonical dormant preset art when shipped'
);

SELECT is(
  (SELECT neglected_image_url
   FROM public.user_companion
   WHERE id = '22000000-0000-0000-0000-000000000001'),
  'https://example.supabase.co/storage/v1/object/public/companion-presets/fox/t2_guardian/neglected/fox__t2_guardian__neglected__nature.png',
  'positive-stage preset companions adopt the canonical neglected preset art when shipped'
);

SELECT is(
  (SELECT current_image_focal_x
   FROM public.user_companion
   WHERE id = '22000000-0000-0000-0000-000000000001'),
  NULL::double precision,
  'changing the canonical current portrait clears stored focal metadata'
);

SELECT is(
  (SELECT image_url
   FROM public.companion_evolutions
   WHERE companion_id = '22000000-0000-0000-0000-000000000001'
     AND stage = 5),
  'https://example.supabase.co/storage/v1/object/public/companion-presets/fox/t2_guardian/normal/fox__t2_guardian__normal__nature.png',
  'companion evolution history is rewritten to the canonical preset stage art'
);

SELECT is(
  (SELECT current_image_url
   FROM public.user_companion
   WHERE id = '22000000-0000-0000-0000-000000000002'),
  '/companion-eggs/egg__t0_egg__normal__fire.png',
  'stage 0 preset companions stay on the shared elemental egg art'
);

SELECT is(
  (SELECT dormant_image_url
   FROM public.user_companion
   WHERE id = '22000000-0000-0000-0000-000000000002'),
  NULL::text,
  'stage 0 preset companions clear dormant art'
);

SELECT is(
  (SELECT neglected_image_url
   FROM public.user_companion
   WHERE id = '22000000-0000-0000-0000-000000000002'),
  NULL::text,
  'stage 0 preset companions clear neglected art'
);

SELECT is(
  (SELECT current_image_url
   FROM public.user_companion
   WHERE id = '22000000-0000-0000-0000-0000000000aa'),
  'https://example.com/custom-raven-current.png',
  'legacy presets without shipped coverage are left unchanged'
);

SELECT is(
  (SELECT image_url
   FROM public.companion_evolutions
   WHERE companion_id = '22000000-0000-0000-0000-0000000000aa'
     AND stage = 5),
  'https://example.com/custom-raven-stage5.png',
  'legacy preset evolution history is left unchanged'
);

SELECT * FROM finish();
ROLLBACK;
