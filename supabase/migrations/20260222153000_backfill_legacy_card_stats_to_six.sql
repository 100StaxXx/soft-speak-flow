-- Backfill legacy companion evolution cards from 3-stat snapshots
-- (mind/body/soul) to the canonical 6-stat snapshot expected by UI.
--
-- Idempotency:
-- - Only targets rows that still contain mind/body/soul
-- - Skips rows that already have all six stats as numeric values
-- - Re-running this migration is safe and results in 0 additional updates

WITH legacy_rows AS (
  SELECT
    c.id,
    (20 + (c.evolution_stage * 8))::numeric AS base_stat,
    CASE
      WHEN jsonb_typeof(c.stats -> 'body') = 'number' THEN (c.stats ->> 'body')::numeric
      ELSE NULL
    END AS body_stat,
    CASE
      WHEN jsonb_typeof(c.stats -> 'mind') = 'number' THEN (c.stats ->> 'mind')::numeric
      ELSE NULL
    END AS mind_stat,
    CASE
      WHEN jsonb_typeof(c.stats -> 'soul') = 'number' THEN (c.stats ->> 'soul')::numeric
      ELSE NULL
    END AS soul_stat
  FROM public.companion_evolution_cards c
  WHERE c.stats ? 'mind'
    AND c.stats ? 'body'
    AND c.stats ? 'soul'
    AND (
      jsonb_typeof(c.stats -> 'vitality') IS DISTINCT FROM 'number'
      OR jsonb_typeof(c.stats -> 'wisdom') IS DISTINCT FROM 'number'
      OR jsonb_typeof(c.stats -> 'discipline') IS DISTINCT FROM 'number'
      OR jsonb_typeof(c.stats -> 'resolve') IS DISTINCT FROM 'number'
      OR jsonb_typeof(c.stats -> 'creativity') IS DISTINCT FROM 'number'
      OR jsonb_typeof(c.stats -> 'alignment') IS DISTINCT FROM 'number'
    )
),
normalized AS (
  SELECT
    id,
    GREATEST(
      0,
      LEAST(
        1000,
        ROUND(((COALESCE(body_stat, base_stat) - base_stat) / 0.15))
      )
    )::integer AS body_source,
    GREATEST(
      0,
      LEAST(
        1000,
        ROUND(((COALESCE(mind_stat, base_stat) - base_stat) / 0.15))
      )
    )::integer AS mind_source,
    GREATEST(
      0,
      LEAST(
        1000,
        ROUND(((COALESCE(soul_stat, base_stat) - base_stat) / 0.15))
      )
    )::integer AS soul_source
  FROM legacy_rows
)
UPDATE public.companion_evolution_cards c
SET stats = jsonb_build_object(
  'vitality', n.body_source,
  'wisdom', n.mind_source,
  'discipline', n.body_source,
  'resolve', n.soul_source,
  'creativity', n.mind_source,
  'alignment', n.soul_source
)
FROM normalized n
WHERE c.id = n.id;
