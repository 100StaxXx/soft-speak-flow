-- Helper functions for enforcing daily task limits and safe main quest updates
CREATE OR REPLACE FUNCTION public.add_daily_task(
  p_user_id uuid,
  p_task_text text,
  p_task_difficulty text,
  p_xp_reward integer,
  p_task_date date DEFAULT NULL,
  p_is_main_quest boolean DEFAULT false,
  p_scheduled_time time without time zone DEFAULT NULL,
  p_estimated_duration integer DEFAULT NULL,
  p_recurrence_pattern text DEFAULT NULL,
  p_recurrence_days integer[] DEFAULT NULL,
  p_is_recurring boolean DEFAULT false,
  p_reminder_enabled boolean DEFAULT false,
  p_reminder_minutes_before integer DEFAULT 15,
  p_category text DEFAULT NULL
) RETURNS daily_tasks
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  target_date date := coalesce(p_task_date, current_date);
  new_task daily_tasks%rowtype;
  existing_count integer;
BEGIN
  SELECT count(*) INTO existing_count
  FROM daily_tasks
  WHERE user_id = p_user_id
    AND task_date = target_date;

  -- Allow up to 5 tasks (4 base + 1 bonus slot)
  -- The bonus slot logic is enforced in the application layer
  IF existing_count >= 5 THEN
    RAISE EXCEPTION 'MAX_TASKS_REACHED';
  END IF;

  INSERT INTO daily_tasks (
    user_id,
    task_text,
    task_date,
    difficulty,
    xp_reward,
    is_main_quest,
    scheduled_time,
    estimated_duration,
    recurrence_pattern,
    recurrence_days,
    is_recurring,
    reminder_enabled,
    reminder_minutes_before,
    category
  )
  VALUES (
    p_user_id,
    p_task_text,
    target_date,
    p_task_difficulty,
    coalesce(p_xp_reward, 0),
    coalesce(p_is_main_quest, false),
    p_scheduled_time,
    p_estimated_duration,
    p_recurrence_pattern,
    p_recurrence_days,
    coalesce(p_is_recurring, false),
    coalesce(p_reminder_enabled, false),
    coalesce(p_reminder_minutes_before, 15),
    p_category
  )
  RETURNING * INTO new_task;

  RETURN new_task;
END;
$$;

GRANT EXECUTE ON FUNCTION public.add_daily_task(
  uuid, text, text, integer, date, boolean, time without time zone,
  integer, text, integer[], boolean, boolean, integer, text
) TO authenticated;

CREATE OR REPLACE FUNCTION public.set_main_quest_for_day(
  p_user_id uuid,
  p_task_id uuid,
  p_task_date date DEFAULT NULL
) RETURNS daily_tasks
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  updated_task daily_tasks%rowtype;
  target_date date := coalesce(p_task_date, current_date);
BEGIN
  UPDATE daily_tasks
    SET is_main_quest = false
    WHERE user_id = p_user_id
      AND task_date = target_date;

  UPDATE daily_tasks
    SET is_main_quest = true
    WHERE id = p_task_id
      AND user_id = p_user_id
    RETURNING * INTO updated_task;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'TASK_NOT_FOUND';
  END IF;

  RETURN updated_task;
END;
$$;

GRANT EXECUTE ON FUNCTION public.set_main_quest_for_day(uuid, uuid, date) TO authenticated;
