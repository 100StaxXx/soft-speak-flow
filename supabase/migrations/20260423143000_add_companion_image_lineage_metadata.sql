ALTER TABLE public.user_companion
ADD COLUMN IF NOT EXISTS image_lineage_metadata jsonb;

ALTER TABLE public.companion_evolutions
ADD COLUMN IF NOT EXISTS generation_metadata jsonb;

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
  text,
  jsonb
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
  p_visual_identity_profile jsonb DEFAULT NULL,
  p_image_lineage_metadata jsonb DEFAULT NULL
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
  image_lineage_metadata jsonb,
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
      visual_identity_profile,
      image_lineage_metadata
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
      p_visual_identity_profile,
      p_image_lineage_metadata
    )
    RETURNING * INTO v_companion;

    v_is_new := true;
  ELSIF (
    (v_companion.visual_identity_profile IS NULL AND p_visual_identity_profile IS NOT NULL)
    OR (v_companion.image_lineage_metadata IS NULL AND p_image_lineage_metadata IS NOT NULL)
  ) THEN
    UPDATE public.user_companion
    SET
      visual_identity_profile = COALESCE(v_companion.visual_identity_profile, p_visual_identity_profile),
      image_lineage_metadata = COALESCE(v_companion.image_lineage_metadata, p_image_lineage_metadata),
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
    v_companion.image_lineage_metadata,
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
  jsonb,
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
  jsonb,
  jsonb
) TO authenticated;
