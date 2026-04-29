-- Preserve quest metadata when committing a Plan-my-day draft.
-- The original apply_day_plan implementation only saved timing/link fields.
-- Replacing the RPC keeps existing applied migrations intact while ensuring
-- future commits carry the same quest details as the planner proposal.

CREATE OR REPLACE FUNCTION public.apply_day_plan(p_plan_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_id uuid := auth.uid();
  v_plan public.daily_plans%ROWTYPE;
  v_block jsonb;
  v_block_index int := 0;
  v_new_task_id uuid;
  v_updated_blocks jsonb := '[]'::jsonb;
  v_inserted_ids uuid[] := ARRAY[]::uuid[];
  v_title text;
  v_start_time time;
  v_task_date date;
  v_duration int;
  v_energy_type text;
  v_difficulty text;
  v_category text;
  v_notes text;
  v_reminder_enabled boolean;
  v_reminder_minutes_before int;
  v_epic_id uuid;
  v_epic_id_text text;
  v_habit_source_id uuid;
  v_habit_source_id_text text;
  v_uuid_pattern text := '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';
  v_quest_position int;
  v_base_xp int;
  v_xp_reward int;
BEGIN
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'apply_day_plan requires an authenticated caller'
      USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_plan
  FROM public.daily_plans
  WHERE id = p_plan_id AND user_id = v_caller_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'plan not found'
      USING ERRCODE = 'P0002';
  END IF;

  IF v_plan.status = 'committed' THEN
    RAISE EXCEPTION 'plan already committed'
      USING ERRCODE = '22023';
  END IF;

  FOR v_block IN SELECT * FROM jsonb_array_elements(v_plan.blocks)
  LOOP
    v_title := COALESCE(NULLIF(v_block ->> 'title', ''), 'Untitled');
    v_start_time := CASE
      WHEN v_block ->> 'startTime' ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
        THEN (v_block ->> 'startTime')::time
      ELSE NULL
    END;
    v_task_date := CASE WHEN v_start_time IS NULL THEN NULL ELSE v_plan.plan_date END;
    v_duration := CASE
      WHEN v_block ->> 'durationMinutes' ~ '^[0-9]+$'
        THEN GREATEST((v_block ->> 'durationMinutes')::int, 5)
      ELSE 30
    END;
    v_energy_type := CASE
      WHEN v_block ->> 'energyType' IN ('deep', 'admin', 'physical', 'errand', 'social', 'creative', 'recovery')
        THEN v_block ->> 'energyType'
      ELSE NULL
    END;
    v_difficulty := CASE
      WHEN v_block ->> 'difficulty' IN ('easy', 'medium', 'hard')
        THEN v_block ->> 'difficulty'
      ELSE 'medium'
    END;
    v_category := CASE
      WHEN v_block ->> 'category' IN ('mind', 'body', 'soul')
        THEN v_block ->> 'category'
      ELSE NULL
    END;
    v_notes := NULLIF(v_block ->> 'notes', '');
    v_reminder_enabled := CASE
      WHEN lower(COALESCE(v_block ->> 'reminderEnabled', '')) = 'true' THEN true
      WHEN lower(COALESCE(v_block ->> 'reminderEnabled', '')) = 'false' THEN false
      ELSE false
    END;
    v_reminder_minutes_before := CASE
      WHEN v_block ->> 'reminderMinutesBefore' ~ '^[0-9]+$'
        THEN GREATEST((v_block ->> 'reminderMinutesBefore')::int, 0)
      ELSE 15
    END;
    v_epic_id_text := NULLIF(v_block ->> 'epicId', '');
    v_epic_id := CASE
      WHEN v_epic_id_text IS NULL THEN NULL
      WHEN v_epic_id_text ~* v_uuid_pattern THEN v_epic_id_text::uuid
      ELSE NULL
    END;
    v_habit_source_id_text := NULLIF(v_block ->> 'habitSourceId', '');
    v_habit_source_id := CASE
      WHEN v_habit_source_id_text IS NULL THEN NULL
      WHEN v_habit_source_id_text ~* v_uuid_pattern
        THEN v_habit_source_id_text::uuid
      ELSE NULL
    END;

    IF v_task_date IS NULL THEN
      v_quest_position := 1;
    ELSE
      SELECT COUNT(*) + 1 INTO v_quest_position
      FROM public.daily_tasks
      WHERE user_id = v_caller_id
        AND task_date = v_task_date;
    END IF;

    v_base_xp := CASE v_difficulty
      WHEN 'easy' THEN 12
      WHEN 'hard' THEN 22
      ELSE 16
    END;
    v_xp_reward := ROUND(v_base_xp * CASE
      WHEN v_quest_position <= 4 THEN 1.0
      WHEN v_quest_position = 5 THEN 0.75
      WHEN v_quest_position = 6 THEN 0.5
      WHEN v_quest_position <= 8 THEN 0.25
      ELSE 0.1
    END)::int;

    INSERT INTO public.daily_tasks (
      user_id,
      task_text,
      difficulty,
      xp_reward,
      task_date,
      scheduled_time,
      estimated_duration,
      energy_type,
      reminder_enabled,
      reminder_minutes_before,
      category,
      notes,
      source,
      epic_id,
      habit_source_id
    )
    VALUES (
      v_caller_id,
      v_title,
      v_difficulty,
      v_xp_reward,
      v_task_date,
      v_start_time,
      v_duration,
      v_energy_type,
      v_reminder_enabled,
      v_reminder_minutes_before,
      v_category,
      v_notes,
      'plan_my_day',
      v_epic_id,
      v_habit_source_id
    )
    RETURNING id INTO v_new_task_id;

    v_inserted_ids := array_append(v_inserted_ids, v_new_task_id);
    v_updated_blocks := v_updated_blocks ||
      jsonb_build_object(
        'index', v_block_index,
        'questId', v_new_task_id,
        'block', v_block || jsonb_build_object('questId', v_new_task_id::text)
      );
    v_block_index := v_block_index + 1;
  END LOOP;

  UPDATE public.daily_plans
  SET
    status = 'committed',
    committed_at = now(),
    blocks = (
      SELECT COALESCE(jsonb_agg(elem -> 'block'), '[]'::jsonb)
      FROM jsonb_array_elements(v_updated_blocks) AS elem
    )
  WHERE id = p_plan_id;

  RETURN jsonb_build_object(
    'planId', p_plan_id,
    'committedTaskIds', to_jsonb(v_inserted_ids)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.apply_day_plan(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.apply_day_plan(uuid) TO authenticated;

NOTIFY pgrst, 'reload schema';
