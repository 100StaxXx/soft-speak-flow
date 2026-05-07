-- Stop active companion animation work for levels that do not change art.
-- Completed videos/storage assets are intentionally left untouched; the app filters
-- them from the collection UI.

WITH ineligible_jobs AS (
  SELECT
    caj.id,
    caj.evolution_id
  FROM public.companion_animation_jobs caj
  WHERE caj.status IN ('queued', 'processing')
    AND (
      caj.stage < 1
      OR NOT public.is_companion_visual_boundary_stage(caj.stage)
    )
)
UPDATE public.companion_animation_jobs caj
SET
  status = 'failed',
  error_code = 'stage_not_animatable',
  error_message = 'Companion animation generation is only available for visual evolution boundary stages',
  completed_at = COALESCE(caj.completed_at, now()),
  next_retry_at = NULL,
  updated_at = now()
FROM ineligible_jobs ij
WHERE caj.id = ij.id;

WITH ineligible_evolutions AS (
  SELECT DISTINCT
    caj.evolution_id
  FROM public.companion_animation_jobs caj
  WHERE caj.error_code = 'stage_not_animatable'
    AND caj.status = 'failed'
    AND (
      caj.stage < 1
      OR NOT public.is_companion_visual_boundary_stage(caj.stage)
    )
)
UPDATE public.companion_evolutions ce
SET
  animation_status = 'skipped',
  animation_error_code = 'stage_not_animatable',
  animation_error_message = 'Companion animation generation is only available for visual evolution boundary stages',
  animation_completed_at = COALESCE(ce.animation_completed_at, now())
FROM ineligible_evolutions ie
WHERE ce.id = ie.evolution_id
  AND (
    ce.animation_status IS NULL
    OR ce.animation_status IN ('queued', 'processing')
  );
