-- Smoke test campaign creation in SQL and clean up test rows.
-- Validates habits (including monthly cadence), epic creation, and epic_habits linking.
DO $$
DECLARE
  v_user_id uuid := gen_random_uuid();
  v_epic_id uuid;
  v_habit_ids uuid[];
  v_habit_count integer;
  v_link_count integer;
  v_monthly_days integer[];
BEGIN
  WITH inserted AS (
    INSERT INTO public.habits (
      user_id,
      title,
      difficulty,
      frequency,
      custom_days,
      custom_month_days,
      is_active
    )
    VALUES
      (v_user_id, 'Smoke Daily', 'easy', 'daily', NULL, NULL, true),
      (v_user_id, 'Smoke 5x', 'medium', '5x_week', ARRAY[0,1,2,3,4], NULL, true),
      (v_user_id, 'Smoke 3x', 'medium', '3x_week', ARRAY[0,2,4], NULL, true),
      (v_user_id, 'Smoke Custom', 'hard', 'custom', ARRAY[1,3], NULL, true),
      (v_user_id, 'Smoke Monthly', 'medium', 'monthly', NULL, ARRAY[1,15], true)
    RETURNING id, frequency, custom_month_days
  )
  SELECT
    array_agg(id),
    count(*),
    max(custom_month_days) FILTER (WHERE frequency = 'monthly')
  INTO v_habit_ids, v_habit_count, v_monthly_days
  FROM inserted;

  IF v_habit_count <> 5 THEN
    RAISE EXCEPTION 'Smoke test failed: expected 5 inserted habits, got %', v_habit_count;
  END IF;

  IF v_monthly_days IS NULL OR array_length(v_monthly_days, 1) IS NULL OR array_length(v_monthly_days, 1) = 0 THEN
    RAISE EXCEPTION 'Smoke test failed: monthly habit missing custom_month_days';
  END IF;

  INSERT INTO public.epics (
    user_id,
    title,
    description,
    target_days,
    is_public,
    xp_reward,
    invite_code,
    theme_color
  )
  VALUES (
    v_user_id,
    'Smoke Campaign',
    'Temporary migration smoke test',
    30,
    true,
    300,
    'SMOKE-' || substr(replace(v_epic_id::text, '-', ''), 1, 8),
    'heroic'
  )
  RETURNING id INTO v_epic_id;

  INSERT INTO public.epic_habits (epic_id, habit_id)
  SELECT v_epic_id, unnest(v_habit_ids);

  SELECT count(*) INTO v_link_count
  FROM public.epic_habits
  WHERE epic_id = v_epic_id;

  IF v_link_count <> v_habit_count THEN
    RAISE EXCEPTION 'Smoke test failed: expected % epic_habits links, got %', v_habit_count, v_link_count;
  END IF;

  DELETE FROM public.epic_habits WHERE epic_id = v_epic_id;
  DELETE FROM public.epics WHERE id = v_epic_id;
  DELETE FROM public.habits WHERE id = ANY (v_habit_ids);
END;
$$;
