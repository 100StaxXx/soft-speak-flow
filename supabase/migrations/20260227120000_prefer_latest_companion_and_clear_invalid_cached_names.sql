-- Ensure companion creation reuses the most recent row if legacy duplicates exist
-- and clear cached names that are just the selected species label.

UPDATE public.user_companion
SET cached_creature_name = NULL
WHERE cached_creature_name IS NOT NULL
  AND lower(trim(cached_creature_name)) = lower(trim(spirit_animal));

CREATE OR REPLACE FUNCTION public.create_companion_if_not_exists(
  p_user_id uuid,
  p_favorite_color text,
  p_spirit_animal text,
  p_core_element text,
  p_story_tone text,
  p_current_image_url text,
  p_initial_image_url text,
  p_eye_color text,
  p_fur_color text
)
RETURNS TABLE(
  id uuid,
  user_id uuid,
  favorite_color text,
  spirit_animal text,
  core_element text,
  story_tone text,
  current_stage integer,
  current_xp integer,
  current_image_url text,
  initial_image_url text,
  eye_color text,
  fur_color text,
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
  v_companion user_companion%ROWTYPE;
  v_is_new boolean := false;
BEGIN
  IF p_user_id != auth.uid() THEN
    RAISE EXCEPTION 'Cannot create companion for another user';
  END IF;

  SELECT *
  INTO v_companion
  FROM public.user_companion
  WHERE user_companion.user_id = p_user_id
  ORDER BY user_companion.created_at DESC NULLS LAST, user_companion.id DESC
  LIMIT 1;

  IF NOT FOUND THEN
    INSERT INTO public.user_companion (
      user_id,
      favorite_color,
      spirit_animal,
      core_element,
      story_tone,
      current_image_url,
      initial_image_url,
      eye_color,
      fur_color
    ) VALUES (
      p_user_id,
      p_favorite_color,
      p_spirit_animal,
      p_core_element,
      p_story_tone,
      p_current_image_url,
      p_initial_image_url,
      p_eye_color,
      p_fur_color
    )
    RETURNING * INTO v_companion;

    v_is_new := true;
  END IF;

  RETURN QUERY SELECT
    v_companion.id,
    v_companion.user_id,
    v_companion.favorite_color,
    v_companion.spirit_animal,
    v_companion.core_element,
    v_companion.story_tone,
    v_companion.current_stage,
    v_companion.current_xp,
    v_companion.current_image_url,
    v_companion.initial_image_url,
    v_companion.eye_color,
    v_companion.fur_color,
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
