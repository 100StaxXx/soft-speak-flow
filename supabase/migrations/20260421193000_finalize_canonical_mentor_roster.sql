-- Finalize the canonical active mentor roster after the Final 6 rebrand + Lyra activation.
-- This migration keeps the settings dropdown DB-driven by normalizing persisted mentor rows
-- and repairing profile selections that still point at retired legacy mentor records.

-- Preview-only mentors should never appear in active mentor queries.
UPDATE public.mentors
SET is_active = false
WHERE slug IN ('the-guy', 'reign', 'atlas', 'carmen', 'solace', 'elizabeth', 'sienna', 'stryker', 'eli');

-- Rewrite selected mentor ids from retired legacy mentor rows to their canonical replacements.
WITH mentor_slug_rewrites (legacy_slug, canonical_slug) AS (
  VALUES
    ('atlas', 'sage'),
    ('carmen', 'icon'),
    ('solace', 'charles'),
    ('elizabeth', 'charles'),
    ('sienna', 'princess'),
    ('stryker', 'operator'),
    ('eli', 'rival'),
    ('reign', 'rival')
),
mentor_id_rewrites AS (
  SELECT legacy.id AS legacy_id, canonical.id AS canonical_id
  FROM mentor_slug_rewrites rewrites
  JOIN public.mentors legacy
    ON legacy.slug = rewrites.legacy_slug
  JOIN public.mentors canonical
    ON canonical.slug = rewrites.canonical_slug
)
UPDATE public.profiles AS profiles
SET selected_mentor_id = mentor_id_rewrites.canonical_id
FROM mentor_id_rewrites
WHERE profiles.selected_mentor_id = mentor_id_rewrites.legacy_id;

-- Keep onboarding_data.mentorId aligned with the repaired canonical mentor ids.
WITH mentor_slug_rewrites (legacy_slug, canonical_slug) AS (
  VALUES
    ('atlas', 'sage'),
    ('carmen', 'icon'),
    ('solace', 'charles'),
    ('elizabeth', 'charles'),
    ('sienna', 'princess'),
    ('stryker', 'operator'),
    ('eli', 'rival'),
    ('reign', 'rival')
),
mentor_id_rewrites AS (
  SELECT legacy.id AS legacy_id, canonical.id AS canonical_id
  FROM mentor_slug_rewrites rewrites
  JOIN public.mentors legacy
    ON legacy.slug = rewrites.legacy_slug
  JOIN public.mentors canonical
    ON canonical.slug = rewrites.canonical_slug
)
UPDATE public.profiles AS profiles
SET onboarding_data = jsonb_set(
  COALESCE(profiles.onboarding_data, '{}'::jsonb),
  '{mentorId}',
  to_jsonb(mentor_id_rewrites.canonical_id::text),
  true
)
FROM mentor_id_rewrites
WHERE profiles.onboarding_data IS NOT NULL
  AND profiles.onboarding_data->>'mentorId' = mentor_id_rewrites.legacy_id::text;
