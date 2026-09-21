-- Companion progression art is a release artifact, not a runtime generation job.
-- This table is the server-side mirror of src/config/premadeCompanionAssets.ts.

CREATE TABLE IF NOT EXISTS public.companion_premade_asset_contracts (
  product_mode TEXT NOT NULL CHECK (product_mode IN ('graceward', 'cosmiq')),
  species TEXT NOT NULL,
  element TEXT NOT NULL CHECK (element IN ('fire', 'ice', 'storm', 'nature', 'void', 'light')),
  boundary_level INTEGER NOT NULL CHECK (boundary_level IN (1, 5, 13, 21, 36, 56, 81)),
  previous_boundary_level INTEGER NOT NULL CHECK (previous_boundary_level IN (0, 1, 5, 13, 21, 36, 56)),
  asset_version TEXT NOT NULL DEFAULT 'v1',
  portrait_bucket TEXT NOT NULL DEFAULT 'companion-presets',
  portrait_storage_path TEXT NOT NULL,
  video_bucket TEXT NOT NULL DEFAULT 'companion-animation-videos',
  video_storage_path TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (product_mode, species, element, boundary_level),
  UNIQUE (portrait_bucket, portrait_storage_path),
  UNIQUE (video_bucket, video_storage_path)
);

ALTER TABLE public.companion_premade_asset_contracts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can read companion premade asset contracts"
  ON public.companion_premade_asset_contracts;
CREATE POLICY "Authenticated users can read companion premade asset contracts"
  ON public.companion_premade_asset_contracts
  FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Service role can manage companion premade asset contracts"
  ON public.companion_premade_asset_contracts;
CREATE POLICY "Service role can manage companion premade asset contracts"
  ON public.companion_premade_asset_contracts
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

WITH product_species AS (
  SELECT * FROM (VALUES
    ('graceward', 'lamb'),
    ('graceward', 'lion'),
    ('graceward', 'stag'),
    ('graceward', 'dove'),
    ('graceward', 'eagle'),
    ('graceward', 'wolf'),
    ('cosmiq', 'fox'),
    ('cosmiq', 'phoenix'),
    ('cosmiq', 'leviathan')
  ) AS value(product_mode, species)
),
elements AS (
  SELECT * FROM (VALUES
    ('fire'), ('ice'), ('storm'), ('nature'), ('void'), ('light')
  ) AS value(element)
),
boundaries AS (
  SELECT * FROM (VALUES
    (1, 0),
    (5, 1),
    (13, 5),
    (21, 13),
    (36, 21),
    (56, 36),
    (81, 56)
  ) AS value(boundary_level, previous_boundary_level)
)
INSERT INTO public.companion_premade_asset_contracts (
  product_mode,
  species,
  element,
  boundary_level,
  previous_boundary_level,
  asset_version,
  portrait_bucket,
  portrait_storage_path,
  video_bucket,
  video_storage_path
)
SELECT
  product_species.product_mode,
  product_species.species,
  elements.element,
  boundaries.boundary_level,
  boundaries.previous_boundary_level,
  'v1',
  'companion-presets',
  'premade/v1/' || product_species.product_mode || '/' || product_species.species || '/' ||
    elements.element || '/portraits/level-' || boundaries.boundary_level || '.webp',
  'companion-animation-videos',
  'premade/v1/' || product_species.product_mode || '/' || product_species.species || '/' ||
    elements.element || '/videos/level-' || boundaries.previous_boundary_level || '-to-' ||
    boundaries.boundary_level || '.mp4'
FROM product_species
CROSS JOIN elements
CROSS JOIN boundaries
ON CONFLICT (product_mode, species, element, boundary_level) DO UPDATE
SET
  previous_boundary_level = EXCLUDED.previous_boundary_level,
  asset_version = EXCLUDED.asset_version,
  portrait_bucket = EXCLUDED.portrait_bucket,
  portrait_storage_path = EXCLUDED.portrait_storage_path,
  video_bucket = EXCLUDED.video_bucket,
  video_storage_path = EXCLUDED.video_storage_path,
  updated_at = now();

COMMENT ON TABLE public.companion_premade_asset_contracts IS
  'Complete expected Higgsfield portrait/video matrix. Runtime claims require both matching storage objects.';

-- Upgrade existing claimed boundaries when both release artifacts are already
-- published. Missing files remain untouched and are surfaced by the claim API.
WITH eligible AS (
  SELECT
    evolution.id AS evolution_id,
    contract.asset_version,
    contract.product_mode,
    contract.species,
    contract.element,
    contract.boundary_level,
    contract.portrait_storage_path,
    contract.video_storage_path,
    COALESCE(public.resolve_supabase_project_url(), '') AS project_url,
    contract.portrait_bucket,
    contract.video_bucket
  FROM public.companion_evolutions AS evolution
  JOIN public.user_companion AS companion
    ON companion.id = evolution.companion_id
  JOIN public.companion_premade_asset_contracts AS contract
    ON contract.product_mode = companion.product_mode
    AND contract.species = CASE
      WHEN lower(trim(COALESCE(companion.spirit_animal, companion.preset_id, ''))) = 'kitsune' THEN 'fox'
      ELSE lower(regexp_replace(trim(COALESCE(companion.spirit_animal, companion.preset_id, '')), '[^a-zA-Z0-9]+', '', 'g'))
    END
    AND contract.element = public.normalize_companion_element_slug(companion.core_element)
    AND contract.boundary_level = evolution.stage
  WHERE EXISTS (
    SELECT 1
    FROM storage.objects AS portrait
    WHERE portrait.bucket_id = contract.portrait_bucket
      AND portrait.name = contract.portrait_storage_path
  )
  AND EXISTS (
    SELECT 1
    FROM storage.objects AS video
    WHERE video.bucket_id = contract.video_bucket
      AND video.name = contract.video_storage_path
  )
),
updated_evolutions AS (
  UPDATE public.companion_evolutions AS evolution
  SET
    image_url = eligible.project_url || '/storage/v1/object/public/' ||
      eligible.portrait_bucket || '/' || eligible.portrait_storage_path,
    generation_metadata = COALESCE(evolution.generation_metadata, '{}'::jsonb) ||
      jsonb_build_object(
        'sourceType', 'premade',
        'provider', 'higgsfield',
        'assetVersion', eligible.asset_version,
        'productMode', eligible.product_mode,
        'species', eligible.species,
        'element', eligible.element,
        'boundaryLevel', eligible.boundary_level,
        'portraitRegenerated', false,
        'portraitStoragePath', eligible.portrait_storage_path,
        'videoStoragePath', eligible.video_storage_path,
        'migratedAt', now()
      ),
    animation_video_url = eligible.project_url || '/storage/v1/object/public/' ||
      eligible.video_bucket || '/' || eligible.video_storage_path,
    animation_storage_path = eligible.video_storage_path,
    animation_provider = 'higgsfield',
    animation_provider_model = 'premade',
    animation_provider_task_id = NULL,
    animation_status = 'succeeded',
    animation_error_code = NULL,
    animation_error_message = NULL,
    animation_requested_at = COALESCE(evolution.animation_requested_at, now()),
    animation_completed_at = COALESCE(evolution.animation_completed_at, now())
  FROM eligible
  WHERE evolution.id = eligible.evolution_id
  RETURNING evolution.id, evolution.companion_id, evolution.stage, evolution.image_url
)
UPDATE public.user_companion AS companion
SET
  current_image_url = updated_evolutions.image_url,
  current_image_focal_x = 0.5,
  current_image_focal_y = 0.5,
  dormant_image_url = NULL,
  dormant_image_focal_x = NULL,
  dormant_image_focal_y = NULL,
  neglected_image_url = NULL,
  neglected_image_focal_x = NULL,
  neglected_image_focal_y = NULL,
  updated_at = now()
FROM updated_evolutions
WHERE companion.id = updated_evolutions.companion_id
  AND companion.current_stage = updated_evolutions.stage;

UPDATE public.companion_animation_jobs AS job
SET
  status = 'failed',
  provider_task_id = NULL,
  provider_status = NULL,
  video_url = NULL,
  storage_path = NULL,
  error_code = 'replaced_by_premade_asset',
  error_message = 'Runtime animation job retired because the release now provides a premade Higgsfield transition.',
  next_retry_at = NULL,
  completed_at = now(),
  updated_at = now()
WHERE job.status IN ('queued', 'processing')
  AND EXISTS (
    SELECT 1
    FROM public.companion_evolutions AS evolution
    WHERE evolution.id = job.evolution_id
      AND evolution.animation_status = 'succeeded'
      AND evolution.animation_provider = 'higgsfield'
      AND evolution.animation_provider_model = 'premade'
  );
