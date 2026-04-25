CREATE OR REPLACE FUNCTION public.mark_profile_tab_intro_dismissed(
  p_tab_name TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF p_tab_name IS NULL OR p_tab_name !~ '^[A-Za-z0-9_-]{1,64}$' THEN
    RAISE EXCEPTION 'Invalid tab intro name';
  END IF;

  UPDATE public.profiles
  SET onboarding_data = jsonb_set(
    jsonb_set(
      COALESCE(onboarding_data, '{}'::jsonb),
      '{tab_intros}',
      COALESCE(onboarding_data -> 'tab_intros', '{}'::jsonb),
      true
    ),
    ARRAY['tab_intros', p_tab_name],
    'true'::jsonb,
    true
  )
  WHERE id = v_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Profile not found';
  END IF;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.mark_profile_tab_intro_dismissed(TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mark_profile_tab_intro_dismissed(TEXT) TO authenticated;
