-- Update add_daily_task helper to support Bonus Quest slot rules
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
  total_tasks integer := 0;
  completed_tasks integer := 0;
  streak_days integer := 0;
  max_slots integer := 4;
  has_streak_bonus boolean := false;
  has_completion_bonus boolean := false;
BEGIN
  SELECT 
    count(*) AS total,
    count(*) FILTER (WHERE completed = true) AS completed
  INTO total_tasks, completed_tasks
  FROM daily_tasks
  WHERE user_id = p_user_id
    AND task_date = target_date;

  SELECT coalesce(current_habit_streak, 0)
  INTO streak_days
  FROM profiles
  WHERE id = p_user_id;

  has_completion_bonus := completed_tasks >= 4;
  has_streak_bonus := streak_days >= 7;

  IF has_completion_bonus OR has_streak_bonus THEN
    max_slots := 5;
  END IF;

  IF total_tasks >= max_slots THEN
    RAISE EXCEPTION 'MAX_TASKS_REACHED'
      USING HINT = 'Base limit 4 quests. Finish all 4 or keep a 7+ day streak to unlock the Bonus Quest slot.';
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
