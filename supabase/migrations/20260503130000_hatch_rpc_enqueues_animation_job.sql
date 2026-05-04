-- Extend hatch_companion_with_preset to enqueue a Kling animation job for the
-- newly hatched stage-1 portrait. Mirrors the enqueue logic in
-- _shared/companionAnimationJobs.ts: 10-video lifetime cap per companion,
-- evolution_id-uniqueness via the existing partial index, and the page image
-- (current_image_url) as the source — never the launcher icon.

CREATE OR REPLACE FUNCTION public.hatch_companion_with_preset(
  p_companion_id uuid,
  p_preset_id text,
  p_spirit_animal text,
  p_favorite_color text,
  p_core_element text,
  p_story_tone text,
  p_initial_image_url text,
  p_initial_image_focal_x double precision,
  p_initial_image_focal_y double precision,
  p_current_image_url text,
  p_current_image_focal_x double precision,
  p_current_image_focal_y double precision,
  p_xp_at_evolution integer
)
RETURNS TABLE(
  id uuid,
  preset_id text,
  spirit_animal text,
  favorite_color text,
  core_element text,
  story_tone text,
  current_stage integer,
  current_image_url text,
  current_image_focal_x double precision,
  current_image_focal_y double precision,
  initial_image_url text,
  initial_image_focal_x double precision,
  initial_image_focal_y double precision,
  evolution_id uuid
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_user_id uuid := auth.uid();
  v_companion public.user_companion%ROWTYPE;
  v_evolution_id uuid;
  v_locked_preset_id text;
  v_resolved_preset_id text;
  v_lifetime_count integer;
  v_lifetime_cap constant integer := 10;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT *
  INTO v_companion
  FROM public.user_companion
  WHERE public.user_companion.id = p_companion_id
    AND public.user_companion.user_id = v_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Companion not found';
  END IF;

  IF COALESCE(v_companion.current_stage, 0) <> 0 THEN
    RAISE EXCEPTION 'Only stage 0 companions can hatch';
  END IF;

  v_locked_preset_id := NULLIF(BTRIM(v_companion.preset_id), '');
  v_resolved_preset_id := COALESCE(NULLIF(BTRIM(p_preset_id), ''), v_locked_preset_id);

  IF v_resolved_preset_id IS NULL THEN
    RAISE EXCEPTION 'Choose a companion form before hatching.';
  END IF;

  IF v_locked_preset_id IS NOT NULL AND v_locked_preset_id <> v_resolved_preset_id THEN
    RAISE EXCEPTION 'Companion already has a preset';
  END IF;

  SELECT public.companion_evolutions.id
  INTO v_evolution_id
  FROM public.companion_evolutions
  WHERE public.companion_evolutions.companion_id = p_companion_id
    AND public.companion_evolutions.stage = 1
  ORDER BY public.companion_evolutions.evolved_at DESC
  LIMIT 1;

  IF v_evolution_id IS NULL THEN
    INSERT INTO public.companion_evolutions (
      companion_id,
      stage,
      image_url,
      xp_at_evolution
    )
    VALUES (
      p_companion_id,
      1,
      p_current_image_url,
      GREATEST(COALESCE(p_xp_at_evolution, 0), 0)
    )
    RETURNING public.companion_evolutions.id
    INTO v_evolution_id;
  END IF;

  -- Enqueue a Kling animation job for the new portrait. The processor cron
  -- gates on COMPANION_KLING_ENABLED + cost guardrails, so this insert is
  -- always safe even when the feature is dark — the job just gets marked
  -- 'skipped' on the next tick.
  IF p_current_image_url IS NOT NULL AND BTRIM(p_current_image_url) <> '' THEN
    SELECT COUNT(*)
    INTO v_lifetime_count
    FROM public.companion_animation_jobs
    WHERE public.companion_animation_jobs.companion_id = p_companion_id;

    IF v_lifetime_count < v_lifetime_cap THEN
      INSERT INTO public.companion_animation_jobs (
        companion_id,
        evolution_id,
        user_id,
        source_image_url,
        provider,
        provider_model,
        status
      )
      VALUES (
        p_companion_id,
        v_evolution_id,
        v_user_id,
        p_current_image_url,
        'fal-kling-v3',
        'fal-ai/kling-video/v3/standard/image-to-video',
        'pending'
      )
      ON CONFLICT (evolution_id) DO NOTHING;

      -- Mirror pending state to the evolution row so the UI can subscribe.
      UPDATE public.companion_evolutions
      SET
        animation_status = 'pending',
        animation_provider = 'fal-kling-v3',
        animation_error = NULL
      WHERE public.companion_evolutions.id = v_evolution_id
        AND public.companion_evolutions.animation_status IS DISTINCT FROM 'succeeded';
    END IF;
  END IF;

  RETURN QUERY
  UPDATE public.user_companion
  SET
    preset_id = v_resolved_preset_id,
    spirit_animal = p_spirit_animal,
    favorite_color = p_favorite_color,
    core_element = p_core_element,
    story_tone = p_story_tone,
    current_stage = 1,
    current_image_url = p_current_image_url,
    current_image_focal_x = p_current_image_focal_x,
    current_image_focal_y = p_current_image_focal_y,
    initial_image_url = COALESCE(p_initial_image_url, public.user_companion.initial_image_url),
    initial_image_focal_x = COALESCE(p_initial_image_focal_x, public.user_companion.initial_image_focal_x),
    initial_image_focal_y = COALESCE(p_initial_image_focal_y, public.user_companion.initial_image_focal_y),
    dormant_image_url = NULL,
    dormant_image_focal_x = NULL,
    dormant_image_focal_y = NULL,
    neglected_image_url = NULL,
    neglected_image_focal_x = NULL,
    neglected_image_focal_y = NULL,
    scarred_image_url = NULL,
    updated_at = now()
  WHERE public.user_companion.id = p_companion_id
    AND public.user_companion.user_id = v_user_id
  RETURNING
    public.user_companion.id,
    public.user_companion.preset_id,
    public.user_companion.spirit_animal,
    public.user_companion.favorite_color,
    public.user_companion.core_element,
    public.user_companion.story_tone,
    public.user_companion.current_stage,
    public.user_companion.current_image_url,
    public.user_companion.current_image_focal_x,
    public.user_companion.current_image_focal_y,
    public.user_companion.initial_image_url,
    public.user_companion.initial_image_focal_x,
    public.user_companion.initial_image_focal_y,
    v_evolution_id;
END;
$function$;
