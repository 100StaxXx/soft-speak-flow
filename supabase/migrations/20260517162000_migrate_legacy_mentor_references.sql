-- Collapse legacy mentor references onto the active canonical roster.
-- The April roster migration deactivated legacy mentors, but some profiles and
-- historical pep-talk rows can still point at those old IDs/slugs.

WITH legacy_mentor_map(old_slug, new_slug) AS (
  VALUES
    ('atlas', 'sage'),
    ('carmen', 'icon'),
    ('solace', 'charles'),
    ('elizabeth', 'charles'),
    ('sienna', 'princess'),
    ('stryker', 'operator'),
    ('eli', 'rival')
),
mentor_ids AS (
  SELECT
    old_mentor.id AS old_id,
    new_mentor.id AS new_id
  FROM legacy_mentor_map
  JOIN public.mentors AS old_mentor ON old_mentor.slug = legacy_mentor_map.old_slug
  JOIN public.mentors AS new_mentor ON new_mentor.slug = legacy_mentor_map.new_slug
)
UPDATE public.profiles AS profile
SET
  selected_mentor_id = mentor_ids.new_id,
  onboarding_data = CASE
    WHEN profile.onboarding_data IS NULL THEN profile.onboarding_data
    WHEN profile.onboarding_data->>'mentorId' = mentor_ids.old_id::text THEN jsonb_set(
      profile.onboarding_data,
      '{mentorId}',
      to_jsonb(mentor_ids.new_id::text),
      true
    )
    ELSE profile.onboarding_data
  END
FROM mentor_ids
WHERE profile.selected_mentor_id = mentor_ids.old_id;

WITH legacy_mentor_map(old_slug, new_slug) AS (
  VALUES
    ('atlas', 'sage'),
    ('carmen', 'icon'),
    ('solace', 'charles'),
    ('elizabeth', 'charles'),
    ('sienna', 'princess'),
    ('stryker', 'operator'),
    ('eli', 'rival')
),
mentor_ids AS (
  SELECT
    old_mentor.id AS old_id,
    new_mentor.id AS new_id
  FROM legacy_mentor_map
  JOIN public.mentors AS old_mentor ON old_mentor.slug = legacy_mentor_map.old_slug
  JOIN public.mentors AS new_mentor ON new_mentor.slug = legacy_mentor_map.new_slug
)
UPDATE public.profiles AS profile
SET
  selected_mentor_id = COALESCE(profile.selected_mentor_id, mentor_ids.new_id),
  onboarding_data = jsonb_set(
    COALESCE(profile.onboarding_data, '{}'::jsonb),
    '{mentorId}',
    to_jsonb(mentor_ids.new_id::text),
    true
  )
FROM mentor_ids
WHERE profile.onboarding_data->>'mentorId' = mentor_ids.old_id::text;

WITH legacy_mentor_map(old_slug, new_slug) AS (
  VALUES
    ('atlas', 'sage'),
    ('carmen', 'icon'),
    ('solace', 'charles'),
    ('elizabeth', 'charles'),
    ('sienna', 'princess'),
    ('stryker', 'operator'),
    ('eli', 'rival')
)
UPDATE public.daily_pep_talks AS daily
SET mentor_slug = legacy_mentor_map.new_slug
FROM legacy_mentor_map
WHERE daily.mentor_slug = legacy_mentor_map.old_slug
  AND NOT EXISTS (
    SELECT 1
    FROM public.daily_pep_talks AS canonical_daily
    WHERE canonical_daily.mentor_slug = legacy_mentor_map.new_slug
      AND canonical_daily.for_date = daily.for_date
  );

WITH legacy_mentor_map(old_slug, new_slug) AS (
  VALUES
    ('atlas', 'sage'),
    ('carmen', 'icon'),
    ('solace', 'charles'),
    ('elizabeth', 'charles'),
    ('sienna', 'princess'),
    ('stryker', 'operator'),
    ('eli', 'rival')
),
mentor_ids AS (
  SELECT
    old_mentor.id AS old_id,
    new_mentor.id AS new_id,
    legacy_mentor_map.old_slug,
    legacy_mentor_map.new_slug
  FROM legacy_mentor_map
  JOIN public.mentors AS old_mentor ON old_mentor.slug = legacy_mentor_map.old_slug
  JOIN public.mentors AS new_mentor ON new_mentor.slug = legacy_mentor_map.new_slug
)
UPDATE public.pep_talks AS pep
SET
  mentor_slug = mentor_ids.new_slug,
  mentor_id = mentor_ids.new_id
FROM mentor_ids
WHERE pep.mentor_slug = mentor_ids.old_slug
   OR pep.mentor_id = mentor_ids.old_id;
