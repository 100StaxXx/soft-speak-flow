-- Give every companion an explicit product identity. Preset-backed and legacy
-- egg records belong to Cosmiq; generated symbolic companions belong to
-- Graceward. This removes product inference from day-to-day application code.

ALTER TABLE public.user_companion
ADD COLUMN IF NOT EXISTS product_mode TEXT;

-- Normalize the onboarding metadata too. Older Graceward builds used the
-- implementation label "christian" here even though this is a product-mode
-- field; no Cosmiq profile is changed by this predicate.
UPDATE public.profiles
SET onboarding_data = jsonb_set(
  COALESCE(onboarding_data, '{}'::jsonb),
  '{product_mode}',
  '"graceward"'::jsonb,
  true
)
WHERE onboarding_data ->> 'product_mode' = 'christian';

UPDATE public.user_companion
SET product_mode = CASE
  WHEN preset_id IS NOT NULL THEN 'cosmiq'
  WHEN lower(trim(COALESCE(spirit_animal, ''))) = 'egg' THEN 'cosmiq'
  WHEN COALESCE(current_image_url, initial_image_url, '') LIKE '%/companion-presets/%' THEN 'cosmiq'
  ELSE 'graceward'
END
WHERE product_mode IS NULL
   OR product_mode NOT IN ('graceward', 'cosmiq');

ALTER TABLE public.user_companion
ALTER COLUMN product_mode SET DEFAULT 'graceward';

ALTER TABLE public.user_companion
ALTER COLUMN product_mode SET NOT NULL;

ALTER TABLE public.user_companion
DROP CONSTRAINT IF EXISTS user_companion_product_mode_check;

ALTER TABLE public.user_companion
ADD CONSTRAINT user_companion_product_mode_check
CHECK (product_mode IN ('graceward', 'cosmiq'));

CREATE OR REPLACE FUNCTION public.normalize_companion_product_mode()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $function$
BEGIN
  IF NEW.preset_id IS NOT NULL
    OR lower(trim(COALESCE(NEW.spirit_animal, ''))) = 'egg' THEN
    NEW.product_mode := 'cosmiq';
  ELSIF NEW.product_mode IS NULL
    OR NEW.product_mode NOT IN ('graceward', 'cosmiq') THEN
    NEW.product_mode := 'graceward';
  END IF;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS normalize_companion_product_mode
  ON public.user_companion;
DROP TRIGGER IF EXISTS companion_00_normalize_product_mode
  ON public.user_companion;
CREATE TRIGGER companion_00_normalize_product_mode
BEFORE INSERT OR UPDATE OF preset_id, spirit_animal, product_mode
ON public.user_companion
FOR EACH ROW
EXECUTE FUNCTION public.normalize_companion_product_mode();

-- Only Cosmiq records are subject to the frozen 3x3 selection matrix.
-- A stage-zero Cosmiq egg may not have a species yet, but its element is still
-- restricted. Existing legacy rows may continue unchanged.
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
  IF NEW.product_mode <> 'cosmiq' THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    v_selection_changed :=
      NEW.preset_id IS DISTINCT FROM OLD.preset_id
      OR NEW.core_element IS DISTINCT FROM OLD.core_element
      OR NEW.product_mode IS DISTINCT FROM OLD.product_mode;
  END IF;

  IF NOT v_selection_changed THEN
    RETURN NEW;
  END IF;

  IF v_element NOT IN ('fire', 'ice', 'nature') THEN
    RAISE EXCEPTION
      'Cosmiq selection is currently limited to Fire, Ice, or Nature.';
  END IF;

  IF NEW.preset_id IS NOT NULL
    AND v_preset_id NOT IN ('fox', 'phoenix', 'leviathan') THEN
    RAISE EXCEPTION
      'Cosmiq selection is currently limited to Kitsune, Phoenix, or Leviathan.';
  END IF;

  RETURN NEW;
END;
$function$;

-- Retire any queued or completed Graceward hatch whose final endpoint was not
-- the explicitly approved infant anchor. This includes the old canonical-v2
-- adult fallback and prewarm rows created before the approval flag existed.
WITH invalid_graceward_hatches AS (
  SELECT job.evolution_id
  FROM public.companion_animation_jobs AS job
  JOIN public.user_companion AS companion
    ON companion.id = job.companion_id
  WHERE job.stage = 1
    AND companion.product_mode = 'graceward'
    AND (
      COALESCE(
        lower(companion.image_lineage_metadata #>>
          '{hiddenBoundaryAnchors,1,approvedForReveal}'),
        'false'
      ) <> 'true'
      OR NULLIF(
        companion.image_lineage_metadata #>>
          '{hiddenBoundaryAnchors,1,imageUrl}',
        ''
      ) IS DISTINCT FROM NULLIF(BTRIM(job.source_image_url), '')
      OR job.source_image_url LIKE
        '%/mentors-avatars/canonical/christian/v2/%'
    )
)
UPDATE public.companion_evolutions AS evolution
SET animation_status = 'skipped',
    animation_video_url = NULL,
    animation_storage_path = NULL,
    animation_provider_task_id = NULL,
    animation_error_code = 'hatch_infant_endpoint_unverified',
    animation_error_message =
      'Hatch animation invalidated because its final frame was not an approved Graceward infant anchor.',
    animation_completed_at = now()
WHERE evolution.id IN (
  SELECT evolution_id FROM invalid_graceward_hatches
);

UPDATE public.companion_animation_jobs AS job
SET status = 'failed',
    provider_task_id = NULL,
    provider_status = NULL,
    video_url = NULL,
    storage_path = NULL,
    error_code = 'hatch_infant_endpoint_unverified',
    error_message =
      'Hatch animation invalidated because its final frame was not an approved Graceward infant anchor.',
    retry_count = 0,
    next_retry_at = NULL,
    started_at = NULL,
    completed_at = now(),
    updated_at = now()
FROM public.user_companion AS companion
WHERE companion.id = job.companion_id
  AND job.stage = 1
  AND companion.product_mode = 'graceward'
  AND (
    COALESCE(
      lower(companion.image_lineage_metadata #>>
        '{hiddenBoundaryAnchors,1,approvedForReveal}'),
      'false'
    ) <> 'true'
    OR NULLIF(
      companion.image_lineage_metadata #>>
        '{hiddenBoundaryAnchors,1,imageUrl}',
      ''
    ) IS DISTINCT FROM NULLIF(BTRIM(job.source_image_url), '')
    OR job.source_image_url LIKE
      '%/mentors-avatars/canonical/christian/v2/%'
  );

COMMENT ON COLUMN public.user_companion.product_mode IS
  'Explicit companion product identity: graceward generated symbolic companion or cosmiq preset catalog companion.';
