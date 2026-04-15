-- Repair cached companion names so preset/species labels never masquerade as canonical proper names.

CREATE OR REPLACE FUNCTION public._normalize_companion_name_token(value text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT NULLIF(
    trim(
      regexp_replace(
        lower(coalesce(value, '')),
        '[^a-z0-9]+',
        ' ',
        'g'
      )
    ),
    ''
  );
$$;

CREATE OR REPLACE FUNCTION public._synthesize_canonical_companion_name(
  seed_input text,
  element text,
  spirit_animal text,
  preset_id text,
  preset_display_name text
)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  normalized_element text := coalesce(public._normalize_companion_name_token(element), 'default');
  prefix_pool text[];
  middle_pool text[] := ARRAY['l', 'r', 'v', 'th', 'n', 's'];
  suffix_pool text[] := ARRAY['a', 'is', 'or', 'en', 'yn', 'el', 'ia', 'eth'];
  identity_labels text[];
  identity_key text;
  hash_one int;
  hash_two int;
  hash_three int;
  prefix text;
  middle text;
  suffix text;
BEGIN
  prefix_pool := CASE normalized_element
    WHEN 'fire' THEN ARRAY['sol', 'pyra', 'igni', 'kae', 'ember']
    WHEN 'storm' THEN ARRAY['vol', 'zira', 'tesa', 'arca', 'rael']
    WHEN 'void' THEN ARRAY['vora', 'noxa', 'zael', 'xyra', 'khae']
    WHEN 'nature' THEN ARRAY['gaia', 'verd', 'syl', 'mora', 'bryn']
    WHEN 'water' THEN ARRAY['aqua', 'mar', 'thal', 'nera', 'sere']
    WHEN 'earth' THEN ARRAY['gaia', 'bryn', 'terra', 'mora', 'verd']
    WHEN 'air' THEN ARRAY['aero', 'zeph', 'lyra', 'cael', 'syl']
    WHEN 'light' THEN ARRAY['luma', 'heli', 'auri', 'cira', 'sera']
    WHEN 'shadow' THEN ARRAY['nyx', 'umbra', 'vela', 'mora', 'shade']
    WHEN 'electric' THEN ARRAY['vol', 'zira', 'tesa', 'arca', 'rael']
    WHEN 'cosmic' THEN ARRAY['nova', 'astra', 'oria', 'cela', 'vexa']
    ELSE ARRAY['kae', 'lyra', 'sera', 'nova', 'aeri']
  END;

  SELECT coalesce(array_agg(label ORDER BY label), ARRAY[]::text[])
  INTO identity_labels
  FROM unnest(ARRAY[
    public._normalize_companion_name_token(spirit_animal),
    public._normalize_companion_name_token(preset_id),
    public._normalize_companion_name_token(preset_display_name)
  ]) AS label
  WHERE label IS NOT NULL;

  identity_key := array_to_string(identity_labels, '|');

  hash_one := abs(('x' || substr(md5(coalesce(seed_input, '') || ':' || normalized_element || ':' || coalesce(identity_key, '')), 1, 8))::bit(32)::int);
  hash_two := abs(('x' || substr(md5(coalesce(seed_input, '') || ':middle:' || normalized_element || ':' || coalesce(identity_key, '')), 1, 8))::bit(32)::int);
  hash_three := abs(('x' || substr(md5(coalesce(seed_input, '') || ':suffix:' || normalized_element || ':' || coalesce(identity_key, '')), 1, 8))::bit(32)::int);

  prefix := prefix_pool[(hash_one % array_length(prefix_pool, 1)) + 1];
  middle := middle_pool[(hash_two % array_length(middle_pool, 1)) + 1];
  suffix := suffix_pool[(hash_three % array_length(suffix_pool, 1)) + 1];

  RETURN initcap(
    regexp_replace(
      prefix || middle || suffix,
      '[^a-z]',
      '',
      'gi'
    )
  );
END;
$$;

WITH companion_base AS (
  SELECT
    uc.id,
    uc.user_id,
    uc.current_stage,
    uc.cached_creature_name,
    uc.spirit_animal,
    uc.core_element,
    uc.preset_id,
    cp.display_name AS preset_display_name,
    public._normalize_companion_name_token(uc.cached_creature_name) AS normalized_cached_name,
    public._normalize_companion_name_token(uc.spirit_animal) AS normalized_spirit_animal,
    public._normalize_companion_name_token(uc.preset_id) AS normalized_preset_id,
    public._normalize_companion_name_token(cp.display_name) AS normalized_preset_display_name
  FROM public.user_companion AS uc
  LEFT JOIN public.companion_presets AS cp
    ON cp.id = uc.preset_id
),
target_companions AS (
  SELECT *
  FROM companion_base
  WHERE normalized_cached_name IS NULL
    OR normalized_cached_name IN (
      'companion',
      'your companion',
      'unknown',
      coalesce(normalized_spirit_animal, ''),
      coalesce(normalized_preset_id, ''),
      coalesce(normalized_preset_display_name, '')
    )
),
cleared_invalid_cache AS (
  UPDATE public.user_companion AS uc
  SET cached_creature_name = NULL
  FROM target_companions AS tc
  WHERE uc.id = tc.id
    AND tc.normalized_cached_name IS NOT NULL
  RETURNING uc.id
),
valid_card_names AS (
  SELECT
    tc.id AS companion_id,
    cards.creature_name,
    ROW_NUMBER() OVER (
      PARTITION BY tc.id
      ORDER BY
        CASE
          WHEN tc.current_stage IS NOT NULL AND cards.evolution_stage = tc.current_stage THEN 0
          ELSE 1
        END,
        cards.evolution_stage ASC,
        cards.creature_name ASC
    ) AS name_rank
  FROM target_companions AS tc
  JOIN public.companion_evolution_cards AS cards
    ON cards.companion_id = tc.id
  WHERE public._normalize_companion_name_token(cards.creature_name) IS NOT NULL
    AND public._normalize_companion_name_token(cards.creature_name) NOT IN (
      'companion',
      'your companion',
      'unknown',
      coalesce(tc.normalized_spirit_animal, ''),
      coalesce(tc.normalized_preset_id, ''),
      coalesce(tc.normalized_preset_display_name, '')
    )
),
best_card_names AS (
  SELECT companion_id, creature_name
  FROM valid_card_names
  WHERE name_rank = 1
),
canonical_repairs AS (
  SELECT
    tc.id AS companion_id,
    coalesce(
      bcn.creature_name,
      public._synthesize_canonical_companion_name(
        tc.id::text || ':' || tc.user_id::text || ':' || coalesce(tc.current_stage, 0)::text,
        tc.core_element,
        tc.spirit_animal,
        tc.preset_id,
        tc.preset_display_name
      )
    ) AS canonical_name
  FROM target_companions AS tc
  LEFT JOIN best_card_names AS bcn
    ON bcn.companion_id = tc.id
)
UPDATE public.user_companion AS uc
SET cached_creature_name = cr.canonical_name
FROM canonical_repairs AS cr
WHERE uc.id = cr.companion_id
  AND uc.cached_creature_name IS DISTINCT FROM cr.canonical_name;

DROP FUNCTION public._synthesize_canonical_companion_name(text, text, text, text, text);
DROP FUNCTION public._normalize_companion_name_token(text);
