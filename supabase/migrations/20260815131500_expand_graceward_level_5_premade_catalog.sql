-- The full Graceward Level 1-5 production run unlocks every symbolic species
-- and element that was visible-but-disabled in the initial launch picker.

WITH graceward_species AS (
  SELECT * FROM (VALUES
    ('lamb'), ('lion'), ('stag'), ('dove'), ('eagle'), ('wolf')
  ) AS value(species)
),
elements AS (
  SELECT * FROM (VALUES
    ('fire'), ('ice'), ('storm'), ('nature'), ('void'), ('light')
  ) AS value(element)
),
boundaries AS (
  SELECT * FROM (VALUES
    (1, 0),
    (5, 1)
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
  'graceward',
  graceward_species.species,
  elements.element,
  boundaries.boundary_level,
  boundaries.previous_boundary_level,
  'v1',
  'companion-presets',
  'premade/v1/graceward/' || graceward_species.species || '/' ||
    elements.element || '/portraits/level-' || boundaries.boundary_level || '.webp',
  'companion-animation-videos',
  'premade/v1/graceward/' || graceward_species.species || '/' ||
    elements.element || '/videos/level-' || boundaries.previous_boundary_level || '-to-' ||
    boundaries.boundary_level || '.mp4'
FROM graceward_species
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
  'Expected Higgsfield portrait/video matrix. Graceward covers Lamb/Lion/Stag/Dove/Eagle/Wolf across all six elements at visual boundaries 1 and 5; Cosmiq retains its complete progression contract.';
