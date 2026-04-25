CREATE OR REPLACE FUNCTION public.prepare_companion_onboarding_journey(
  p_companion_id uuid,
  p_story_tone text,
  p_memory_context jsonb,
  p_complete_onboarding boolean DEFAULT false
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_user_id uuid := auth.uid();
  v_existing_data jsonb;
  v_companion_exists boolean;
  v_memory_context jsonb := COALESCE(p_memory_context, '{}'::jsonb);
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM public.user_companion
    WHERE id = p_companion_id
      AND user_id = v_user_id
  )
  INTO v_companion_exists;

  IF NOT v_companion_exists THEN
    RAISE EXCEPTION 'Companion not found';
  END IF;

  SELECT COALESCE(onboarding_data, '{}'::jsonb)
  INTO v_existing_data
  FROM public.profiles
  WHERE id = v_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Profile not found';
  END IF;

  INSERT INTO public.companion_memories (
    user_id,
    companion_id,
    memory_type,
    memory_date,
    memory_context,
    referenced_count
  )
  SELECT
    v_user_id,
    p_companion_id,
    'first_meeting',
    CURRENT_DATE,
    v_memory_context,
    0
  WHERE NOT EXISTS (
    SELECT 1
    FROM public.companion_memories
    WHERE user_id = v_user_id
      AND companion_id = p_companion_id
      AND memory_type = 'first_meeting'
  );

  IF p_complete_onboarding THEN
    UPDATE public.profiles
    SET
      onboarding_completed = true,
      onboarding_step = 'complete',
      onboarding_data = v_existing_data
        || jsonb_build_object(
          'walkthrough_completed', true,
          'story_tone', p_story_tone,
          'progression_reset_required', false
        )
    WHERE id = v_user_id;
  ELSE
    UPDATE public.profiles
    SET
      onboarding_step = 'journey-begins',
      onboarding_data = (v_existing_data - 'walkthrough_completed' - 'guided_tutorial')
        || jsonb_build_object(
          'story_tone', p_story_tone,
          'progression_reset_required', false
        )
    WHERE id = v_user_id;
  END IF;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.prepare_companion_onboarding_journey(uuid, text, jsonb, boolean)
FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.prepare_companion_onboarding_journey(uuid, text, jsonb, boolean)
TO authenticated;

COMMENT ON FUNCTION public.prepare_companion_onboarding_journey(uuid, text, jsonb, boolean)
IS 'Atomically records the first companion meeting and advances onboarding to journey-begins or complete.';
