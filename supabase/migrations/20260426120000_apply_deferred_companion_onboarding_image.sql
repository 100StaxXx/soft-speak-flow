CREATE OR REPLACE FUNCTION public.apply_deferred_companion_onboarding_image(
  p_companion_id uuid,
  p_image_url text,
  p_image_focal_x double precision DEFAULT NULL,
  p_image_focal_y double precision DEFAULT NULL,
  p_visual_identity_profile jsonb DEFAULT NULL,
  p_image_lineage_metadata jsonb DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_user_id uuid := auth.uid();
  v_companion public.user_companion%ROWTYPE;
  v_generation_metadata jsonb;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF p_companion_id IS NULL THEN
    RAISE EXCEPTION 'companion_id is required';
  END IF;

  IF p_image_url IS NULL OR btrim(p_image_url) = '' THEN
    RAISE EXCEPTION 'image_url is required';
  END IF;

  SELECT *
  INTO v_companion
  FROM public.user_companion
  WHERE id = p_companion_id
    AND user_id = v_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Companion not found';
  END IF;

  -- This writer is only for the fast onboarding path: an AI egg record is
  -- created immediately, then the generated egg art catches up if it is safe.
  IF v_companion.preset_id IS NOT NULL
    OR v_companion.current_stage <> 0
    OR v_companion.image_lineage_metadata IS NOT NULL
    OR v_companion.current_image_url IS DISTINCT FROM v_companion.initial_image_url
  THEN
    RETURN;
  END IF;

  UPDATE public.user_companion
  SET
    current_image_url = p_image_url,
    current_image_focal_x = COALESCE(p_image_focal_x, 0.5),
    current_image_focal_y = COALESCE(p_image_focal_y, 0.5),
    initial_image_url = p_image_url,
    initial_image_focal_x = COALESCE(p_image_focal_x, 0.5),
    initial_image_focal_y = COALESCE(p_image_focal_y, 0.5),
    visual_identity_profile = COALESCE(public.user_companion.visual_identity_profile, p_visual_identity_profile),
    image_lineage_metadata = COALESCE(public.user_companion.image_lineage_metadata, p_image_lineage_metadata),
    updated_at = now()
  WHERE id = p_companion_id
    AND user_id = v_user_id
    AND current_stage = 0;

  v_generation_metadata := jsonb_strip_nulls(jsonb_build_object(
    'deferredOnboardingImageAppliedAt', now(),
    'imageFocalX', p_image_focal_x,
    'imageFocalY', p_image_focal_y,
    'imageLineageMetadata', p_image_lineage_metadata
  ));

  INSERT INTO public.companion_evolutions (
    companion_id,
    stage,
    image_url,
    xp_at_evolution,
    generation_metadata
  ) VALUES (
    p_companion_id,
    0,
    p_image_url,
    0,
    v_generation_metadata
  )
  ON CONFLICT (companion_id, stage) DO UPDATE
  SET
    image_url = EXCLUDED.image_url,
    generation_metadata = COALESCE(public.companion_evolutions.generation_metadata, '{}'::jsonb)
      || EXCLUDED.generation_metadata;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.apply_deferred_companion_onboarding_image(
  uuid,
  text,
  double precision,
  double precision,
  jsonb,
  jsonb
) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.apply_deferred_companion_onboarding_image(
  uuid,
  text,
  double precision,
  double precision,
  jsonb,
  jsonb
) TO authenticated;

COMMENT ON FUNCTION public.apply_deferred_companion_onboarding_image(
  uuid,
  text,
  double precision,
  double precision,
  jsonb,
  jsonb
) IS 'Applies a deferred AI onboarding egg image to a still-unhatched AI companion without blocking tutorial handoff.';
