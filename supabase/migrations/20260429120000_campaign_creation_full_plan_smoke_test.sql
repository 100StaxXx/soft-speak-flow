-- Smoke test full Pathfinder campaign creation shape and clean up test rows.
-- Validates rituals, epic links, journey phases, and integer milestone percents.
DO $$
DECLARE
  v_user_id uuid := gen_random_uuid();
  v_epic_id uuid;
  v_invite_code text := 'SMOKE-' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 8);
  v_habit_ids uuid[];
  v_habit_count integer;
  v_phase_count integer;
  v_milestone_count integer;
  v_distinct_milestone_count integer;
BEGIN
  WITH inserted AS (
    INSERT INTO public.habits (
      user_id,
      title,
      difficulty,
      frequency,
      custom_days,
      custom_month_days,
      estimated_minutes,
      is_active
    )
    VALUES
      (v_user_id, 'Smoke Easy Run', 'easy', 'daily', NULL, NULL, 30, true),
      (v_user_id, 'Smoke Long Run', 'hard', 'custom', ARRAY[5], NULL, 90, true),
      (v_user_id, 'Smoke Strength', 'medium', '3x_week', ARRAY[0,2,4], NULL, 45, true),
      (v_user_id, 'Smoke Journal', 'easy', 'daily', NULL, NULL, 15, true)
    RETURNING id
  )
  SELECT array_agg(id), count(*)
  INTO v_habit_ids, v_habit_count
  FROM inserted;

  IF v_habit_count <> 4 THEN
    RAISE EXCEPTION 'Full campaign smoke test failed: expected 4 habits, got %', v_habit_count;
  END IF;

  INSERT INTO public.epics (
    user_id,
    title,
    description,
    target_days,
    start_date,
    end_date,
    is_public,
    xp_reward,
    invite_code,
    theme_color
  )
  VALUES (
    v_user_id,
    'Smoke Marathon Campaign',
    'Temporary full Pathfinder smoke test',
    90,
    DATE '2026-04-28',
    DATE '2026-07-27',
    true,
    900,
    v_invite_code,
    'heroic'
  )
  RETURNING id INTO v_epic_id;

  INSERT INTO public.epic_habits (epic_id, habit_id)
  SELECT v_epic_id, unnest(v_habit_ids);

  INSERT INTO public.journey_phases (
    epic_id,
    user_id,
    name,
    description,
    start_date,
    end_date,
    phase_order
  )
  VALUES
    (v_epic_id, v_user_id, 'Base', 'Build base miles.', DATE '2026-04-28', DATE '2026-05-27', 1),
    (v_epic_id, v_user_id, 'Build', 'Increase weekly volume.', DATE '2026-05-28', DATE '2026-06-26', 2),
    (v_epic_id, v_user_id, 'Peak', 'Peak and taper.', DATE '2026-06-27', DATE '2026-07-27', 3);

  INSERT INTO public.epic_milestones (
    epic_id,
    user_id,
    milestone_percent,
    title,
    description,
    target_date,
    phase_name,
    phase_order,
    is_postcard_milestone
  )
  VALUES
    (v_epic_id, v_user_id, 33, 'First third', 'Base complete.', DATE '2026-05-27', 'Base', 1, true),
    (v_epic_id, v_user_id, 67, 'Second third', 'Build complete.', DATE '2026-06-26', 'Build', 2, true),
    (v_epic_id, v_user_id, 100, 'Finish line', 'Campaign complete.', DATE '2026-07-27', 'Peak', 3, true);

  SELECT count(*)
  INTO v_phase_count
  FROM public.journey_phases
  WHERE epic_id = v_epic_id;

  SELECT count(*), count(DISTINCT milestone_percent)
  INTO v_milestone_count, v_distinct_milestone_count
  FROM public.epic_milestones
  WHERE epic_id = v_epic_id;

  IF v_phase_count <> 3 THEN
    RAISE EXCEPTION 'Full campaign smoke test failed: expected 3 phases, got %', v_phase_count;
  END IF;

  IF v_milestone_count <> 3 OR v_distinct_milestone_count <> 3 THEN
    RAISE EXCEPTION 'Full campaign smoke test failed: expected 3 unique milestones, got % total / % distinct',
      v_milestone_count,
      v_distinct_milestone_count;
  END IF;

  DELETE FROM public.epic_milestones WHERE epic_id = v_epic_id;
  DELETE FROM public.journey_phases WHERE epic_id = v_epic_id;
  DELETE FROM public.epic_habits WHERE epic_id = v_epic_id;
  DELETE FROM public.epics WHERE id = v_epic_id;
  DELETE FROM public.habits WHERE id = ANY (v_habit_ids);
END;
$$;
