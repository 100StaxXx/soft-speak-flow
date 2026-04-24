ALTER TABLE public.user_companion
ADD COLUMN IF NOT EXISTS visual_identity_profile jsonb;

DROP FUNCTION IF EXISTS public.create_companion_if_not_exists(
  uuid,
  text,
  text,
  text,
  text,
  text,
  text,
  double precision,
  double precision,
  text,
  double precision,
  double precision,
  text,
  text
);

CREATE OR REPLACE FUNCTION public.create_companion_if_not_exists(
  p_user_id uuid,
  p_preset_id text,
  p_favorite_color text,
  p_spirit_animal text,
  p_core_element text,
  p_story_tone text,
  p_current_image_url text,
  p_current_image_focal_x double precision,
  p_current_image_focal_y double precision,
  p_initial_image_url text,
  p_initial_image_focal_x double precision,
  p_initial_image_focal_y double precision,
  p_eye_color text,
  p_fur_color text,
  p_visual_identity_profile jsonb DEFAULT NULL
)
RETURNS TABLE(
  id uuid,
  user_id uuid,
  preset_id text,
  favorite_color text,
  spirit_animal text,
  core_element text,
  story_tone text,
  current_stage integer,
  current_xp integer,
  current_image_url text,
  current_image_focal_x double precision,
  current_image_focal_y double precision,
  initial_image_url text,
  initial_image_focal_x double precision,
  initial_image_focal_y double precision,
  eye_color text,
  fur_color text,
  visual_identity_profile jsonb,
  mind integer,
  body integer,
  soul integer,
  current_mood text,
  last_mood_update timestamp with time zone,
  last_energy_update timestamp with time zone,
  created_at timestamp with time zone,
  updated_at timestamp with time zone,
  is_new boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_companion public.user_companion%ROWTYPE;
  v_is_new boolean := false;
BEGIN
  IF p_user_id != auth.uid() THEN
    RAISE EXCEPTION 'Cannot create companion for another user';
  END IF;

  SELECT *
  INTO v_companion
  FROM public.user_companion
  WHERE public.user_companion.user_id = p_user_id
  ORDER BY public.user_companion.created_at DESC NULLS LAST, public.user_companion.id DESC
  LIMIT 1;

  IF NOT FOUND THEN
    INSERT INTO public.user_companion (
      user_id,
      preset_id,
      favorite_color,
      spirit_animal,
      core_element,
      story_tone,
      current_image_url,
      current_image_focal_x,
      current_image_focal_y,
      initial_image_url,
      initial_image_focal_x,
      initial_image_focal_y,
      eye_color,
      fur_color,
      visual_identity_profile
    ) VALUES (
      p_user_id,
      p_preset_id,
      p_favorite_color,
      p_spirit_animal,
      p_core_element,
      p_story_tone,
      p_current_image_url,
      p_current_image_focal_x,
      p_current_image_focal_y,
      p_initial_image_url,
      p_initial_image_focal_x,
      p_initial_image_focal_y,
      p_eye_color,
      p_fur_color,
      p_visual_identity_profile
    )
    RETURNING * INTO v_companion;

    v_is_new := true;
  ELSIF v_companion.visual_identity_profile IS NULL AND p_visual_identity_profile IS NOT NULL THEN
    UPDATE public.user_companion
    SET
      visual_identity_profile = p_visual_identity_profile,
      updated_at = now()
    WHERE public.user_companion.id = v_companion.id
    RETURNING * INTO v_companion;
  END IF;

  INSERT INTO public.companion_evolutions (
    companion_id,
    stage,
    image_url,
    xp_at_evolution
  ) VALUES (
    v_companion.id,
    0,
    COALESCE(
      v_companion.initial_image_url,
      p_initial_image_url,
      v_companion.current_image_url,
      p_current_image_url
    ),
    0
  )
  ON CONFLICT (companion_id, stage) DO NOTHING;

  RETURN QUERY SELECT
    v_companion.id,
    v_companion.user_id,
    v_companion.preset_id,
    v_companion.favorite_color,
    v_companion.spirit_animal,
    v_companion.core_element,
    v_companion.story_tone,
    v_companion.current_stage,
    v_companion.current_xp,
    v_companion.current_image_url,
    v_companion.current_image_focal_x,
    v_companion.current_image_focal_y,
    v_companion.initial_image_url,
    v_companion.initial_image_focal_x,
    v_companion.initial_image_focal_y,
    v_companion.eye_color,
    v_companion.fur_color,
    v_companion.visual_identity_profile,
    v_companion.mind,
    v_companion.body,
    v_companion.soul,
    v_companion.current_mood,
    v_companion.last_mood_update,
    v_companion.last_energy_update,
    v_companion.created_at,
    v_companion.updated_at,
    v_is_new;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.create_companion_if_not_exists(
  uuid,
  text,
  text,
  text,
  text,
  text,
  text,
  double precision,
  double precision,
  text,
  double precision,
  double precision,
  text,
  text,
  jsonb
) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.create_companion_if_not_exists(
  uuid,
  text,
  text,
  text,
  text,
  text,
  text,
  double precision,
  double precision,
  text,
  double precision,
  double precision,
  text,
  text,
  jsonb
) TO authenticated;

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
