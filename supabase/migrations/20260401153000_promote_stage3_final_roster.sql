-- Promote the Stage 3 final thirteen into the active preset roster.
-- Keep Raven available for legacy companions, but move it out of the active selection band.

UPDATE public.companion_presets
SET carousel_order = carousel_order + 100
WHERE id IN ('raven', 'leviathan', 'buttercat');

INSERT INTO public.companion_presets (
  id,
  display_name,
  carousel_order,
  role,
  signature_identity,
  anatomy_lock,
  reveal_copy
)
VALUES
  ('dragon', 'Dragon', 1, 'flagship mythic', 'western dragon silhouette, swept horns, luminous chest core, long tail', '4 legs + 2 wings; no feathers', 'Ancient, bold, and born for legendary arcs.'),
  ('wolf', 'Wolf', 2, 'grounded protector', 'thick neck ruff, alert ears, confident forward stance', '4 legs; no wings', 'Loyal, sharp, and steady through every trial.'),
  ('fox', 'Kitsune', 3, 'mystic trickster', 'fox spirit silhouette, oversized ears, luminous cheek markings, and a flowing tail fan', '4 legs; fox silhouette with magical tails', 'Mystical, clever, and lit by fox-fire.'),
  ('owl', 'Owl', 4, 'quiet oracle', 'round facial disk, ear tufts, bright moon-eyes', '2 legs + 2 wings', 'Watchful, wise, and calm under moonlit pressure.'),
  ('lion', 'Lion', 5, 'regal guardian', 'solar mane, broad paws, tufted tail', '4 legs; no wings', 'Majestic, brave, and built to hold the line.'),
  ('phoenix', 'Phoenix', 6, 'rebel mythic', 'flame crest, ember tail streamers, radiant wing edges', '2 legs + 2 wings', 'Fiery, defiant, and impossible to keep down.'),
  ('pegasus', 'Pegasus', 7, 'noble aspirational', 'feathered wings, windswept mane, athletic horse build', '4 legs + 2 wings; no horn', 'Graceful, bright, and always reaching upward.'),
  ('griffin', 'Griffin', 8, 'skybound sentinel', 'eagle beak, feathered forequarters, leonine hindquarters, proud hybrid silhouette', '4 lion legs + 2 feathered wings + eagle head', 'Regal, fierce, and born to guard the high places.'),
  ('sphinx', 'Sphinx', 9, 'enigmatic oracle', 'lion body, feathered wings, poised regal posture, knowing gaze', '4 lion legs + 2 feathered wings; no beak', 'Ancient, unreadable, and full of hidden answers.'),
  ('leviathan', 'Leviathan', 10, 'abyssal legend', 'serpentine body, fin-frill silhouette, luminous gill lines', 'aquatic serpent; no legs', 'Deep, colossal, and pulled from ancient tides.'),
  ('mechanicaldragon', 'Mechanical Dragon', 11, 'forged mythic', 'clockwork dragon silhouette, plated alloy scales, articulated wings, glowing reactor core', '4 legs + 2 wings; fully mechanical body with no organic traits', 'Forged, relentless, and humming with engineered fire.'),
  ('tanuki', 'Tanuki', 12, 'playful shapeshifter', 'round canine body, dark eye mask, plush striped tail, mischievous expression', '4 legs; raccoon-dog silhouette with no wings', 'Wry, cozy, and always halfway into a trick.'),
  ('buttercat', 'Buttercat', 13, 'whimsical rare', 'cat face, butterfly wings, soft antennae optional, plush tail', '4 cat legs + 2 butterfly wings; no insect eyes', 'Dreamy, playful, and delightfully strange.'),
  ('raven', 'Raven', 14, 'shadow scout', 'sleek hooked beak, iridescent neck sheen, intelligent stare', '2 legs + 2 wings', 'Clever, mysterious, and always one step ahead.')
ON CONFLICT (id) DO UPDATE
SET
  display_name = EXCLUDED.display_name,
  carousel_order = EXCLUDED.carousel_order,
  role = EXCLUDED.role,
  signature_identity = EXCLUDED.signature_identity,
  anatomy_lock = EXCLUDED.anatomy_lock,
  reveal_copy = EXCLUDED.reveal_copy,
  updated_at = now();

WITH selected_presets AS (
  SELECT * FROM (VALUES
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
    ('buttercat'),
    ('raven')
  ) AS p(id)
),
tiers AS (
  SELECT * FROM (VALUES
    ('t0_egg', 0, 0),
    ('t1_youth', 1, 3),
    ('t2_guardian', 4, 6),
    ('t3_champion', 7, 9),
    ('t4_mythic', 10, 12),
    ('t5_apex', 13, 14)
  ) AS t(tier, stage_start, stage_end)
),
states AS (
  SELECT * FROM (VALUES ('normal'), ('neglected'), ('dormant')) AS s(state)
),
elements AS (
  SELECT * FROM (VALUES ('fire'), ('ice'), ('storm'), ('nature'), ('void'), ('light')) AS e(element)
)
INSERT INTO public.companion_preset_assets (
  preset_id,
  tier,
  state,
  element,
  bucket_name,
  storage_path,
  stage_start,
  stage_end
)
SELECT
  p.id,
  t.tier,
  s.state,
  e.element,
  'companion-presets',
  p.id || '/' || t.tier || '/' || s.state || '/' || p.id || '__' || t.tier || '__' || s.state || '__' || e.element || '.png',
  t.stage_start,
  t.stage_end
FROM selected_presets AS p
CROSS JOIN tiers AS t
CROSS JOIN states AS s
CROSS JOIN elements AS e
ON CONFLICT (preset_id, tier, state, element) DO UPDATE
SET
  storage_path = EXCLUDED.storage_path,
  stage_start = EXCLUDED.stage_start,
  stage_end = EXCLUDED.stage_end,
  bucket_name = EXCLUDED.bucket_name,
  updated_at = now();
