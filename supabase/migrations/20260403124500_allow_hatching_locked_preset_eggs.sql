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

  IF COALESCE(trim(p_preset_id), '') = '' THEN
    RAISE EXCEPTION 'Preset id is required';
  END IF;

  IF v_companion.preset_id IS NOT NULL AND v_companion.preset_id <> p_preset_id THEN
    RAISE EXCEPTION 'Companion already has a different preset';
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

  RETURN QUERY
  UPDATE public.user_companion
  SET
    preset_id = p_preset_id,
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

REVOKE EXECUTE ON FUNCTION public.hatch_companion_with_preset(uuid, text, text, text, text, text, text, double precision, double precision, text, double precision, double precision, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.hatch_companion_with_preset(uuid, text, text, text, text, text, text, double precision, double precision, text, double precision, double precision, integer) TO authenticated;
