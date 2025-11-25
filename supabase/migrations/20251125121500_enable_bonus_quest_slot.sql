-- Ensure the daily quest helper honors the Bonus Quest slot rules
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
  existing_count integer := 0;
  completed_count integer := 0;
  current_streak integer := 0;
  base_limit integer := 4;
  bonus_limit integer := 5;
  streak_threshold integer := 7;
  max_slots integer := base_limit;
BEGIN
  SELECT count(*) INTO existing_count
  FROM daily_tasks
  WHERE user_id = p_user_id
    AND task_date = target_date;

  SELECT count(*) INTO completed_count
  FROM daily_tasks
  WHERE user_id = p_user_id
    AND task_date = target_date
    AND coalesce(completed, false) = true;

  SELECT coalesce(current_habit_streak, 0)
    INTO current_streak
  FROM profiles
  WHERE id = p_user_id;

  IF current_streak IS NULL THEN
    current_streak := 0;
  END IF;

  IF current_streak >= streak_threshold OR completed_count >= base_limit THEN
    max_slots := bonus_limit;
  END IF;

  IF existing_count >= max_slots THEN
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
