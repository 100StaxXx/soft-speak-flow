-- Add bonus quest slot logic to daily task system
-- Allows 5th quest if user completes all 4 quests OR has 7+ day streak

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
  v_can_add_bonus boolean := false;
  v_user_streak integer;
  v_completed_today integer;
BEGIN
  -- Count existing tasks for the day
  SELECT count(*) INTO existing_count
  FROM daily_tasks
  WHERE user_id = p_user_id
    AND task_date = target_date;

  -- If 4 or more tasks exist, check for bonus quest slot eligibility
  IF existing_count >= 4 THEN
    -- Get user's current habit streak
    SELECT coalesce(current_habit_streak, 0) INTO v_user_streak
    FROM profiles
    WHERE id = p_user_id;
    
    -- Count completed quests today
    SELECT count(*) INTO v_completed_today
    FROM daily_tasks
    WHERE user_id = p_user_id
      AND task_date = target_date
      AND completed = true;
    
    -- Check bonus conditions: all 4 completed OR 7+ day streak
    v_can_add_bonus := (v_completed_today >= 4) OR (v_user_streak >= 7);
    
    -- Enforce limits
    IF existing_count >= 5 THEN
      -- Absolute max of 5 quests
      RAISE EXCEPTION 'MAX_TASKS_REACHED: Maximum 5 quests per day';
    ELSIF NOT v_can_add_bonus THEN
      -- 5th quest requires bonus slot
      RAISE EXCEPTION 'BONUS_SLOT_LOCKED: Complete all 4 quests or reach 7-day streak to unlock';
    END IF;
  END IF;

  -- Insert the task
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

-- Grant execute permission
GRANT EXECUTE ON FUNCTION public.add_daily_task(
  uuid, text, text, integer, date, boolean, time without time zone,
  integer, text, integer[], boolean, boolean, integer, text
) TO authenticated;

-- Add comment explaining the bonus quest slot
COMMENT ON FUNCTION public.add_daily_task IS 
  'Adds a daily task with bonus quest slot logic. Base limit: 4 quests. ' ||
  'Unlock 5th "Bonus Quest" slot by completing all 4 quests OR having a 7+ day streak.';
