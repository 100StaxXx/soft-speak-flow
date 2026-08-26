-- Make the companion asset registry describe real files only.
-- The wider Cosmiq catalog remains available for existing companions, while
-- new preset choices are limited to the fully built 3x3 matrix.

DELETE FROM public.companion_preset_assets
WHERE preset_id IN (
  'dragon', 'wolf', 'fox', 'owl', 'lion', 'phoenix', 'pegasus',
  'griffin', 'sphinx', 'leviathan', 'mechanicaldragon', 'tanuki',
  'buttercat'
);

-- Raven has no verified bundled replacement pack in this release. Keep its
-- existing registry rows untouched so legacy owners retain their companion;
-- the application catalog still marks it legacy and never offers it anew.

WITH species AS (
  SELECT * FROM (VALUES
    ('dragon'), ('wolf'), ('fox'), ('owl'), ('lion'), ('phoenix'),
    ('pegasus'), ('griffin'), ('sphinx'), ('leviathan'),
    ('mechanicaldragon'), ('tanuki'), ('buttercat')
  ) AS s(id)
),
elements AS (
  SELECT * FROM (VALUES
    ('fire'), ('ice'), ('storm'), ('nature'), ('void'), ('light')
  ) AS e(id)
),
verified_early_tiers AS (
  SELECT * FROM (VALUES
    ('t1_hatchling', 't1_youth', 1, 4),
    ('t2_initiate', 't2_guardian', 5, 12)
  ) AS t(tier, storage_tier, stage_start, stage_end)
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
  species.id,
  verified_early_tiers.tier,
  'normal',
  elements.id,
  'companion-presets',
  species.id || '/' || verified_early_tiers.storage_tier || '/normal/' ||
    species.id || '__' || verified_early_tiers.storage_tier || '__normal__' ||
    elements.id || '.png',
  verified_early_tiers.stage_start,
  verified_early_tiers.stage_end
FROM species
CROSS JOIN elements
CROSS JOIN verified_early_tiers;

WITH supported_species AS (
  SELECT * FROM (VALUES ('fox'), ('phoenix'), ('leviathan')) AS s(id)
),
supported_elements AS (
  SELECT * FROM (VALUES ('fire'), ('ice'), ('nature')) AS e(id)
),
verified_late_tiers AS (
  SELECT * FROM (VALUES
    ('t3_awakened', 13, 20),
    ('t4_guardian', 21, 35),
    ('t5_champion', 36, 55),
    ('t6_mythic', 56, 80),
    ('t7_ascended', 81, 100)
  ) AS t(tier, stage_start, stage_end)
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
  supported_species.id,
  verified_late_tiers.tier,
  'normal',
  supported_elements.id,
  'companion-presets',
  supported_species.id || '/' || verified_late_tiers.tier || '/normal/' ||
    supported_species.id || '__' || verified_late_tiers.tier || '__normal__' ||
    supported_elements.id || '.png',
  verified_late_tiers.stage_start,
  verified_late_tiers.stage_end
FROM supported_species
CROSS JOIN supported_elements
CROSS JOIN verified_late_tiers;

CREATE OR REPLACE FUNCTION public.resolve_companion_preset_stage_image_url(
  p_preset_id TEXT,
  p_stage INTEGER,
  p_element TEXT,
  p_state TEXT DEFAULT 'normal'
)
RETURNS TEXT
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_stage INTEGER := LEAST(GREATEST(COALESCE(p_stage, 0), 0), 100);
  v_preset_id TEXT := public.normalize_companion_preset_slug(p_preset_id);
  v_element TEXT := public.normalize_companion_element_slug(p_element);
  v_state TEXT := lower(trim(COALESCE(p_state, 'normal')));
  v_bucket_name TEXT := NULL;
  v_storage_path TEXT := NULL;
  v_project_url TEXT := NULL;
  v_is_bundled_asset BOOLEAN := FALSE;
BEGIN
  IF v_preset_id = '' THEN
    RETURN NULL;
  END IF;

  SELECT cpa.bucket_name, cpa.storage_path
  INTO v_bucket_name, v_storage_path
  FROM public.companion_preset_assets AS cpa
  WHERE cpa.preset_id = v_preset_id
    AND cpa.state = v_state
    AND cpa.element = v_element
    AND v_stage BETWEEN cpa.stage_start AND cpa.stage_end
  ORDER BY cpa.stage_start DESC, cpa.stage_end ASC
  LIMIT 1;

  IF v_storage_path IS NULL THEN
    RETURN NULL;
  END IF;

  v_is_bundled_asset := v_state = 'normal' AND (
    v_stage BETWEEN 1 AND 4
    OR (
      v_stage >= 13
      AND v_preset_id IN ('fox', 'phoenix', 'leviathan')
      AND v_element IN ('fire', 'ice', 'nature')
    )
  );

  IF v_is_bundled_asset THEN
    RETURN '/' || COALESCE(v_bucket_name, 'companion-presets') || '/' || v_storage_path;
  END IF;

  v_project_url := public.resolve_supabase_project_url();
  IF v_project_url IS NULL THEN
    RETURN '/' || COALESCE(v_bucket_name, 'companion-presets') || '/' || v_storage_path;
  END IF;

  RETURN v_project_url || '/storage/v1/object/public/' ||
    COALESCE(v_bucket_name, 'companion-presets') || '/' || v_storage_path;
END;
$function$;

CREATE OR REPLACE FUNCTION public.enforce_supported_cosmiq_companion_selection()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $function$
DECLARE
  v_preset_id TEXT := public.normalize_companion_preset_slug(NEW.preset_id);
  v_element TEXT := public.normalize_companion_element_slug(NEW.core_element);
  v_selection_changed BOOLEAN := TG_OP = 'INSERT';
BEGIN
  IF TG_OP = 'UPDATE' THEN
    v_selection_changed :=
      NEW.preset_id IS DISTINCT FROM OLD.preset_id
      OR NEW.core_element IS DISTINCT FROM OLD.core_element;
  END IF;

  IF NOT v_selection_changed OR NEW.preset_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF v_preset_id NOT IN ('fox', 'phoenix', 'leviathan')
    OR v_element NOT IN ('fire', 'ice', 'nature') THEN
    RAISE EXCEPTION
      'Cosmiq selection is currently limited to Kitsune, Phoenix, or Leviathan in Fire, Ice, or Nature.';
  END IF;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS enforce_supported_cosmiq_companion_selection
  ON public.user_companion;
CREATE TRIGGER enforce_supported_cosmiq_companion_selection
BEFORE INSERT OR UPDATE
ON public.user_companion
FOR EACH ROW
EXECUTE FUNCTION public.enforce_supported_cosmiq_companion_selection();

-- Older non-hatch videos were generated from only the new portrait. Invalidate
-- them before backfilling endpoint metadata so they cannot masquerade as true
-- previous-to-next evolution transitions.
WITH invalid_jobs AS (
  SELECT evolution_id
  FROM public.companion_animation_jobs
  WHERE stage IN (5, 13, 21, 36, 56, 81)
    AND NULLIF(BTRIM(start_image_url), '') IS NULL
)
UPDATE public.companion_evolutions AS evolution
SET animation_status = 'skipped',
    animation_video_url = NULL,
    animation_storage_path = NULL,
    animation_provider_task_id = NULL,
    animation_error_code = 'legacy_evolution_endpoints_unverified',
    animation_error_message =
      'Legacy evolution animation was invalidated because its prior and next portrait endpoints were not locked.',
    animation_completed_at = now()
WHERE evolution.id IN (SELECT evolution_id FROM invalid_jobs);

UPDATE public.companion_animation_jobs
SET status = 'failed',
    provider_task_id = NULL,
    provider_status = NULL,
    video_url = NULL,
    storage_path = NULL,
    error_code = 'legacy_evolution_endpoints_unverified',
    error_message =
      'Legacy evolution animation was invalidated because its prior and next portrait endpoints were not locked.',
    retry_count = 0,
    next_retry_at = NULL,
    started_at = NULL,
    completed_at = now(),
    updated_at = now()
WHERE stage IN (5, 13, 21, 36, 56, 81)
  AND NULLIF(BTRIM(start_image_url), '') IS NULL;

WITH boundary_map AS (
  SELECT * FROM (VALUES
    (1, 0), (5, 1), (13, 5), (21, 13),
    (36, 21), (56, 36), (81, 56)
  ) AS b(stage, previous_stage)
)
UPDATE public.companion_animation_jobs AS job
SET start_image_url = COALESCE(
      (
        SELECT previous.image_url
        FROM public.companion_evolutions AS previous
        WHERE previous.companion_id = job.companion_id
          AND previous.stage = boundary_map.previous_stage
        ORDER BY previous.evolved_at DESC
        LIMIT 1
      ),
      companion.initial_image_url
    ),
    updated_at = now()
FROM boundary_map,
     public.user_companion AS companion
WHERE job.stage = boundary_map.stage
  AND companion.id = job.companion_id
  AND NULLIF(BTRIM(job.start_image_url), '') IS NULL;

COMMENT ON COLUMN public.companion_animation_jobs.start_image_url IS
  'Exact prior approved portrait required as the first frame for every companion visual-boundary animation.';
