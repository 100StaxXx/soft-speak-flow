-- Canonicalize preset-backed companion image URLs to the shipped preset art pack.
-- Legacy presets without real shipped coverage (notably raven) are intentionally skipped.

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
WHERE uc.id = cui.id
  AND (
    cui.canonical_initial_image_url IS DISTINCT FROM uc.initial_image_url
    OR (
      cui.canonical_current_image_url IS NOT NULL
      AND cui.canonical_current_image_url IS DISTINCT FROM uc.current_image_url
    )
    OR (
      cui.current_stage <= 0
      AND (
        uc.dormant_image_url IS NOT NULL
        OR uc.dormant_image_focal_x IS NOT NULL
        OR uc.dormant_image_focal_y IS NOT NULL
        OR uc.neglected_image_url IS NOT NULL
        OR uc.neglected_image_focal_x IS NOT NULL
        OR uc.neglected_image_focal_y IS NOT NULL
      )
    )
    OR (
      cui.canonical_dormant_image_url IS NOT NULL
      AND cui.canonical_dormant_image_url IS DISTINCT FROM uc.dormant_image_url
    )
    OR (
      cui.canonical_neglected_image_url IS NOT NULL
      AND cui.canonical_neglected_image_url IS DISTINCT FROM uc.neglected_image_url
    )
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
  AND canonical_evolution_images.canonical_image_url IS NOT NULL
  AND canonical_evolution_images.canonical_image_url IS DISTINCT FROM ce.image_url;
