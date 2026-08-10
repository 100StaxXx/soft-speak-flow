-- Cosmiq conversational planner actions. These RPCs give the companion an
-- atomic, confirmation-gated path for creating campaigns and applying a day.

CREATE OR REPLACE FUNCTION public.create_cosmiq_agent_campaign(
  p_user_id uuid,
  p_payload jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_id uuid := auth.uid();
  v_campaign_id uuid;
  v_habit_id uuid;
  v_habit_ids uuid[] := '{}';
  v_ritual jsonb;
  v_title text := left(trim(COALESCE(p_payload ->> 'title', '')), 200);
  v_target_days integer := LEAST(365, GREATEST(1, COALESCE((p_payload ->> 'target_days')::integer, 30)));
  v_start_date date := COALESCE(NULLIF(p_payload ->> 'start_date', '')::date, CURRENT_DATE);
  v_rituals jsonb := COALESCE(p_payload -> 'rituals', '[]'::jsonb);
BEGIN
  IF p_user_id IS NULL OR NOT (
    v_caller_id = p_user_id OR public.is_service_role()
  ) THEN
    RAISE EXCEPTION 'Not authorized to create this campaign'
      USING ERRCODE = '42501';
  END IF;

  IF v_title = '' THEN
    RAISE EXCEPTION 'Campaign title is required' USING ERRCODE = '22023';
  END IF;

  IF jsonb_typeof(v_rituals) <> 'array' OR jsonb_array_length(v_rituals) NOT BETWEEN 1 AND 3 THEN
    RAISE EXCEPTION 'A campaign needs between 1 and 3 rituals'
      USING ERRCODE = '22023';
  END IF;

  IF public.count_user_epics(p_user_id) >= 5 THEN
    RAISE EXCEPTION 'You can only have 5 active campaigns at a time'
      USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.epics (
    user_id,
    title,
    description,
    start_date,
    target_days,
    status,
    progress_percentage,
    xp_reward
  )
  VALUES (
    p_user_id,
    v_title,
    NULLIF(left(p_payload ->> 'description', 2000), ''),
    v_start_date,
    v_target_days,
    'active',
    0,
    v_target_days * 10
  )
  RETURNING id INTO v_campaign_id;

  FOR v_ritual IN SELECT value FROM jsonb_array_elements(v_rituals)
  LOOP
    IF trim(COALESCE(v_ritual ->> 'title', '')) = '' THEN
      RAISE EXCEPTION 'Ritual title is required' USING ERRCODE = '22023';
    END IF;

    INSERT INTO public.habits (
      user_id,
      title,
      frequency,
      custom_days,
      preferred_time,
      estimated_minutes,
      description,
      category,
      difficulty,
      reminder_enabled,
      reminder_minutes_before,
      is_active
    )
    VALUES (
      p_user_id,
      left(trim(v_ritual ->> 'title'), 200),
      CASE
        WHEN v_ritual ->> 'frequency' IN ('daily', '5x_week', '3x_week', 'custom', 'monthly')
          THEN v_ritual ->> 'frequency'
        ELSE 'daily'
      END,
      CASE
        WHEN jsonb_typeof(v_ritual -> 'custom_days') = 'array'
          THEN ARRAY(SELECT jsonb_array_elements_text(v_ritual -> 'custom_days')::integer)
        ELSE NULL
      END,
      NULLIF(v_ritual ->> 'preferred_time', '')::time,
      LEAST(1440, GREATEST(1, COALESCE((v_ritual ->> 'estimated_minutes')::integer, 15))),
      NULLIF(left(v_ritual ->> 'description', 2000), ''),
      CASE
        WHEN v_ritual ->> 'category' IN ('mind', 'body', 'soul')
          THEN v_ritual ->> 'category'
        ELSE NULL
      END,
      CASE
        WHEN v_ritual ->> 'difficulty' IN ('easy', 'medium', 'hard')
          THEN v_ritual ->> 'difficulty'
        ELSE 'easy'
      END,
      COALESCE((v_ritual ->> 'reminder_enabled')::boolean, false),
      CASE
        WHEN NULLIF(v_ritual ->> 'reminder_minutes_before', '') IS NULL
          THEN NULL
        ELSE LEAST(1440, GREATEST(
          0,
          (v_ritual ->> 'reminder_minutes_before')::integer
        ))
      END,
      true
    )
    RETURNING id INTO v_habit_id;

    INSERT INTO public.epic_habits (epic_id, habit_id)
    VALUES (v_campaign_id, v_habit_id);

    v_habit_ids := array_append(v_habit_ids, v_habit_id);
  END LOOP;

  RETURN jsonb_build_object(
    'campaignId', v_campaign_id,
    'habitIds', to_jsonb(v_habit_ids),
    'title', v_title,
    'targetDays', v_target_days
  );
END;
$$;

REVOKE ALL ON FUNCTION public.create_cosmiq_agent_campaign(uuid, jsonb)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_cosmiq_agent_campaign(uuid, jsonb) TO service_role;

CREATE OR REPLACE FUNCTION public.apply_cosmiq_agent_day_plan(
  p_user_id uuid,
  p_plan_date date,
  p_blocks jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_id uuid := auth.uid();
  v_block jsonb;
  v_task_id uuid;
  v_epic_id uuid;
  v_habit_source_id uuid;
  v_plan_id uuid;
  v_title text;
  v_start_time time;
  v_duration integer;
  v_difficulty text;
  v_energy_type text;
  v_xp_reward integer;
  v_created_ids uuid[] := '{}';
  v_updated_ids uuid[] := '{}';
  v_committed_ids uuid[] := '{}';
  v_saved_blocks jsonb := '[]'::jsonb;
BEGIN
  IF p_user_id IS NULL OR NOT (
    v_caller_id = p_user_id OR public.is_service_role()
  ) THEN
    RAISE EXCEPTION 'Not authorized to apply this day plan'
      USING ERRCODE = '42501';
  END IF;

  IF p_plan_date IS NULL OR jsonb_typeof(p_blocks) <> 'array' OR jsonb_array_length(p_blocks) NOT BETWEEN 1 AND 8 THEN
    RAISE EXCEPTION 'A day plan needs a date and between 1 and 8 blocks'
      USING ERRCODE = '22023';
  END IF;

  FOR v_block IN SELECT value FROM jsonb_array_elements(p_blocks)
  LOOP
    v_title := left(trim(COALESCE(v_block ->> 'title', '')), 200);
    v_start_time := NULLIF(COALESCE(v_block ->> 'start_time', v_block ->> 'startTime'), '')::time;
    v_duration := LEAST(480, GREATEST(5, COALESCE(
      NULLIF(COALESCE(v_block ->> 'duration_minutes', v_block ->> 'durationMinutes'), '')::integer,
      30
    )));
    v_difficulty := CASE
      WHEN v_block ->> 'difficulty' IN ('easy', 'medium', 'hard')
        THEN v_block ->> 'difficulty'
      ELSE 'medium'
    END;
    v_energy_type := CASE
      WHEN COALESCE(v_block ->> 'energy_type', v_block ->> 'energyType') IN
        ('deep', 'admin', 'physical', 'errand', 'social', 'creative', 'recovery')
        THEN COALESCE(v_block ->> 'energy_type', v_block ->> 'energyType')
      ELSE NULL
    END;
    v_xp_reward := CASE v_difficulty WHEN 'easy' THEN 12 WHEN 'hard' THEN 22 ELSE 16 END;

    IF v_title = '' OR v_start_time IS NULL THEN
      RAISE EXCEPTION 'Every day-plan block needs a title and start time'
        USING ERRCODE = '22023';
    END IF;

    v_task_id := NULL;
    IF COALESCE(v_block ->> 'task_id', v_block ->> 'taskId') ~*
      '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
    THEN
      v_task_id := COALESCE(v_block ->> 'task_id', v_block ->> 'taskId')::uuid;
    END IF;

    v_epic_id := NULL;
    IF NULLIF(v_block ->> 'epic_id', '') IS NOT NULL THEN
      IF NOT (v_block ->> 'epic_id') ~*
        '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
      THEN
        RAISE EXCEPTION 'Invalid campaign id in day plan'
          USING ERRCODE = '22023';
      END IF;
      v_epic_id := (v_block ->> 'epic_id')::uuid;
      IF NOT EXISTS (
        SELECT 1 FROM public.epics
        WHERE id = v_epic_id AND user_id = p_user_id
      ) THEN
        RAISE EXCEPTION 'Campaign % was not found for this user', v_epic_id
          USING ERRCODE = '22023';
      END IF;
    END IF;

    v_habit_source_id := NULL;
    IF NULLIF(v_block ->> 'habit_source_id', '') IS NOT NULL THEN
      IF NOT (v_block ->> 'habit_source_id') ~*
        '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
      THEN
        RAISE EXCEPTION 'Invalid ritual id in day plan'
          USING ERRCODE = '22023';
      END IF;
      v_habit_source_id := (v_block ->> 'habit_source_id')::uuid;
      IF NOT EXISTS (
        SELECT 1 FROM public.habits
        WHERE id = v_habit_source_id AND user_id = p_user_id
      ) THEN
        RAISE EXCEPTION 'Ritual % was not found for this user', v_habit_source_id
          USING ERRCODE = '22023';
      END IF;
    END IF;

    IF v_task_id IS NOT NULL THEN
      UPDATE public.daily_tasks
      SET
        task_text = v_title,
        task_date = p_plan_date,
        scheduled_time = v_start_time,
        estimated_duration = v_duration,
        difficulty = v_difficulty,
        energy_type = v_energy_type,
        notes = COALESCE(NULLIF(v_block ->> 'notes', ''), notes),
        category = COALESCE(
          CASE
            WHEN v_block ->> 'category' IN ('mind', 'body', 'soul')
              THEN v_block ->> 'category'
            ELSE NULL
          END,
          category
        ),
        reminder_enabled = COALESCE((v_block ->> 'reminder_enabled')::boolean, reminder_enabled),
        reminder_minutes_before = COALESCE(
          CASE
            WHEN NULLIF(v_block ->> 'reminder_minutes_before', '') IS NULL
              THEN NULL
            ELSE LEAST(1440, GREATEST(
              0,
              (v_block ->> 'reminder_minutes_before')::integer
            ))
          END,
          reminder_minutes_before
        )
      WHERE id = v_task_id AND user_id = p_user_id;

      IF NOT FOUND THEN
        RAISE EXCEPTION 'Task % was not found for this user', v_task_id
          USING ERRCODE = '22023';
      END IF;
      v_updated_ids := array_append(v_updated_ids, v_task_id);
    ELSE
      INSERT INTO public.daily_tasks (
        user_id,
        task_text,
        task_date,
        scheduled_time,
        estimated_duration,
        difficulty,
        energy_type,
        notes,
        category,
        reminder_enabled,
        reminder_minutes_before,
        source,
        ai_generated,
        epic_id,
        habit_source_id,
        xp_reward
      )
      VALUES (
        p_user_id,
        v_title,
        p_plan_date,
        v_start_time,
        v_duration,
        v_difficulty,
        v_energy_type,
        NULLIF(left(v_block ->> 'notes', 2000), ''),
        CASE
          WHEN v_block ->> 'category' IN ('mind', 'body', 'soul')
            THEN v_block ->> 'category'
          ELSE NULL
        END,
        COALESCE((v_block ->> 'reminder_enabled')::boolean, false),
        CASE
          WHEN NULLIF(v_block ->> 'reminder_minutes_before', '') IS NULL
            THEN NULL
          ELSE LEAST(1440, GREATEST(
            0,
            (v_block ->> 'reminder_minutes_before')::integer
          ))
        END,
        'plan_my_day',
        true,
        v_epic_id,
        v_habit_source_id,
        v_xp_reward
      )
      RETURNING id INTO v_task_id;
      v_created_ids := array_append(v_created_ids, v_task_id);
    END IF;

    v_committed_ids := array_append(v_committed_ids, v_task_id);
    v_saved_blocks := v_saved_blocks || jsonb_build_array(
      (v_block - 'task_id' - 'taskId' - 'start_time' - 'duration_minutes' - 'energy_type') ||
      jsonb_build_object(
        'questId', v_task_id::text,
        'title', v_title,
        'startTime', to_char(v_start_time, 'HH24:MI'),
        'durationMinutes', v_duration,
        'energyType', v_energy_type
      )
    );
  END LOOP;

  INSERT INTO public.daily_plans (
    user_id,
    plan_date,
    status,
    blocks,
    source,
    committed_at
  )
  VALUES (
    p_user_id,
    p_plan_date,
    'committed',
    v_saved_blocks,
    'companion-agent',
    now()
  )
  ON CONFLICT (user_id, plan_date)
  DO UPDATE SET
    status = 'committed',
    blocks = EXCLUDED.blocks,
    source = EXCLUDED.source,
    committed_at = now()
  RETURNING id INTO v_plan_id;

  RETURN jsonb_build_object(
    'planId', v_plan_id,
    'committedTaskIds', to_jsonb(v_committed_ids),
    'createdTaskIds', to_jsonb(v_created_ids),
    'updatedTaskIds', to_jsonb(v_updated_ids)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.apply_cosmiq_agent_day_plan(uuid, date, jsonb)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.apply_cosmiq_agent_day_plan(uuid, date, jsonb) TO service_role;

NOTIFY pgrst, 'reload schema';
