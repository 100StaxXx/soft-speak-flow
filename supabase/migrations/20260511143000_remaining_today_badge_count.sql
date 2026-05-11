CREATE OR REPLACE FUNCTION public.get_remaining_today_badge_count(
  p_user_id uuid DEFAULT auth.uid(),
  p_now timestamptz DEFAULT now()
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_request_role text := COALESCE(auth.jwt() ->> 'role', current_setting('request.jwt.claim.role', true), '');
  v_timezone text := 'UTC';
  v_local_time timestamp without time zone;
  v_effective_date date;
  v_weekday integer;
  v_day_of_month integer;
  v_last_day_of_month integer;
  v_task_count integer := 0;
  v_due_habit_count integer := 0;
  v_due_recurring_count integer := 0;
BEGIN
  IF p_user_id IS NULL THEN
    RETURN 0;
  END IF;

  IF v_request_role <> 'service_role' AND auth.uid() IS DISTINCT FROM p_user_id THEN
    RAISE EXCEPTION 'Unauthorized: cannot inspect another user badge count';
  END IF;

  SELECT COALESCE(profiles.timezone, 'UTC')
  INTO v_timezone
  FROM public.profiles
  WHERE profiles.id = p_user_id;

  v_timezone := COALESCE(v_timezone, 'UTC');

  BEGIN
    v_local_time := p_now AT TIME ZONE v_timezone;
  EXCEPTION WHEN invalid_parameter_value THEN
    v_timezone := 'UTC';
    v_local_time := p_now AT TIME ZONE v_timezone;
  END;

  v_effective_date := v_local_time::date;
  IF EXTRACT(hour FROM v_local_time)::integer < 2 THEN
    v_effective_date := v_effective_date - 1;
  END IF;

  v_weekday := CASE
    WHEN EXTRACT(dow FROM v_effective_date)::integer = 0 THEN 6
    ELSE EXTRACT(dow FROM v_effective_date)::integer - 1
  END;
  v_day_of_month := EXTRACT(day FROM v_effective_date)::integer;
  v_last_day_of_month := EXTRACT(day FROM (date_trunc('month', v_effective_date)::date + INTERVAL '1 month - 1 day'))::integer;

  SELECT COUNT(*)::integer
  INTO v_task_count
  FROM public.daily_tasks AS task
  WHERE task.user_id = p_user_id
    AND task.task_date = v_effective_date
    AND task.excluded_from_planner_at IS NULL
    AND task.completed IS DISTINCT FROM true;

  SELECT COUNT(*)::integer
  INTO v_due_habit_count
  FROM public.habits AS habit
  WHERE habit.user_id = p_user_id
    AND habit.is_active IS DISTINCT FROM false
    AND NOT EXISTS (
      SELECT 1
      FROM public.habit_completions AS completion
      WHERE completion.user_id = p_user_id
        AND completion.habit_id = habit.id
        AND completion.date = v_effective_date
    )
    AND NOT EXISTS (
      SELECT 1
      FROM public.daily_tasks AS surfaced_task
      WHERE surfaced_task.user_id = p_user_id
        AND surfaced_task.task_date = v_effective_date
        AND surfaced_task.habit_source_id = habit.id
    )
    AND CASE LOWER(COALESCE(habit.frequency, 'daily'))
      WHEN 'daily' THEN true
      WHEN 'weekdays' THEN v_weekday BETWEEN 0 AND 4
      WHEN '5x_week' THEN v_weekday BETWEEN 0 AND 4
      WHEN 'weekends' THEN v_weekday IN (5, 6)
      WHEN '3x_week' THEN CASE
        WHEN COALESCE(cardinality(habit.custom_days), 0) > 0 THEN v_weekday = ANY(habit.custom_days)
        ELSE v_weekday = ANY(ARRAY[0, 2, 4])
      END
      WHEN 'weekly' THEN COALESCE(habit.custom_days[1], 0) = v_weekday
      WHEN 'monthly' THEN CASE
        WHEN COALESCE(cardinality(habit.custom_month_days), 0) > 0 THEN EXISTS (
          SELECT 1
          FROM unnest(habit.custom_month_days) AS configured_day(day_value)
          WHERE LEAST(GREATEST(configured_day.day_value, 1), v_last_day_of_month) = v_day_of_month
        )
        ELSE v_day_of_month = 1
      END
      WHEN 'custom' THEN CASE
        WHEN COALESCE(cardinality(habit.custom_month_days), 0) > 0 THEN EXISTS (
          SELECT 1
          FROM unnest(habit.custom_month_days) AS configured_day(day_value)
          WHERE LEAST(GREATEST(configured_day.day_value, 1), v_last_day_of_month) = v_day_of_month
        )
        ELSE v_weekday = ANY(COALESCE(habit.custom_days, '{}'::integer[]))
      END
      ELSE true
    END;

  WITH recurring_templates AS (
    SELECT
      template.*,
      COALESCE(template.task_date, (template.created_at AT TIME ZONE v_timezone)::date) AS anchor_date
    FROM public.daily_tasks AS template
    WHERE template.user_id = p_user_id
      AND template.is_recurring IS true
      AND template.recurrence_pattern IS NOT NULL
      AND template.scheduled_time IS NOT NULL
      AND template.excluded_from_planner_at IS NULL
  )
  SELECT COUNT(*)::integer
  INTO v_due_recurring_count
  FROM recurring_templates AS template
  WHERE true
    AND (
      template.recurrence_end_date IS NULL
      OR v_effective_date <= template.recurrence_end_date
    )
    AND NOT EXISTS (
      SELECT 1
      FROM public.daily_tasks AS spawned_task
      WHERE spawned_task.user_id = p_user_id
        AND spawned_task.task_date = v_effective_date
        AND spawned_task.parent_template_id = template.id
    )
    AND NOT EXISTS (
      SELECT 1
      FROM public.daily_tasks AS same_title_task
      WHERE same_title_task.user_id = p_user_id
        AND same_title_task.task_date = v_effective_date
        AND LOWER(same_title_task.task_text) = LOWER(template.task_text)
    )
    AND CASE LOWER(template.recurrence_pattern)
      WHEN 'daily' THEN true
      WHEN 'weekly' THEN CASE
        WHEN COALESCE(cardinality(template.recurrence_days), 0) > 0 THEN v_weekday = ANY(template.recurrence_days)
        WHEN template.anchor_date IS NOT NULL THEN (
          CASE WHEN EXTRACT(dow FROM template.anchor_date)::integer = 0 THEN 6 ELSE EXTRACT(dow FROM template.anchor_date)::integer - 1 END
        ) = v_weekday
        ELSE true
      END
      WHEN 'weekdays' THEN v_weekday BETWEEN 0 AND 4
      WHEN 'weekends' THEN v_weekday IN (5, 6)
      WHEN 'biweekly' THEN CASE
        WHEN COALESCE(
          template.recurrence_days[1],
          CASE
            WHEN template.anchor_date IS NOT NULL AND EXTRACT(dow FROM template.anchor_date)::integer = 0 THEN 6
            WHEN template.anchor_date IS NOT NULL THEN EXTRACT(dow FROM template.anchor_date)::integer - 1
            ELSE v_weekday
          END
        ) <> v_weekday THEN false
        WHEN template.anchor_date IS NULL THEN false
        ELSE (v_effective_date - template.anchor_date) >= 0 AND ((v_effective_date - template.anchor_date) % 14) = 0
      END
      WHEN 'monthly' THEN CASE
        WHEN COALESCE(cardinality(template.recurrence_month_days), 0) > 0 THEN EXISTS (
          SELECT 1
          FROM unnest(template.recurrence_month_days) AS configured_day(day_value)
          WHERE LEAST(GREATEST(configured_day.day_value, 1), v_last_day_of_month) = v_day_of_month
        )
        WHEN template.anchor_date IS NOT NULL THEN LEAST(EXTRACT(day FROM template.anchor_date)::integer, v_last_day_of_month) = v_day_of_month
        ELSE false
      END
      WHEN 'custom' THEN CASE
        WHEN template.recurrence_custom_period = 'month' THEN CASE
          WHEN COALESCE(cardinality(template.recurrence_month_days), 0) > 0 THEN EXISTS (
            SELECT 1
            FROM unnest(template.recurrence_month_days) AS configured_day(day_value)
            WHERE LEAST(GREATEST(configured_day.day_value, 1), v_last_day_of_month) = v_day_of_month
          )
          WHEN template.anchor_date IS NOT NULL THEN LEAST(EXTRACT(day FROM template.anchor_date)::integer, v_last_day_of_month) = v_day_of_month
          ELSE false
        END
        WHEN COALESCE(cardinality(template.recurrence_days), 0) > 0 THEN v_weekday = ANY(template.recurrence_days)
        ELSE false
      END
      ELSE LOWER(template.recurrence_pattern) LIKE '%daily%'
        OR LOWER(template.recurrence_pattern) LIKE '%day%'
    END;

  RETURN GREATEST(0, COALESCE(v_task_count, 0) + COALESCE(v_due_habit_count, 0) + COALESCE(v_due_recurring_count, 0));
END;
$$;

REVOKE ALL ON FUNCTION public.get_remaining_today_badge_count(uuid, timestamptz) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_remaining_today_badge_count(uuid, timestamptz) TO authenticated, service_role;
