CREATE OR REPLACE FUNCTION public.get_daily_mission_pulse(p_mission_date date)
RETURNS TABLE(
  mission_date date,
  caller_faction text,
  faction_participants integer,
  faction_completed_users integer,
  faction_completion_percentage integer,
  faction_missions_total integer,
  faction_missions_completed integer,
  global_participants integer,
  global_completed_users integer,
  global_completion_percentage integer,
  global_missions_total integer,
  global_missions_completed integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_user_id uuid := auth.uid();
  v_faction text;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'authentication required';
  END IF;

  SELECT profiles.faction
  INTO v_faction
  FROM public.profiles
  WHERE profiles.id = v_user_id;

  RETURN QUERY
  WITH mission_scope AS (
    SELECT
      daily_missions.user_id,
      COALESCE(daily_missions.completed, false) AS completed,
      profiles.faction
    FROM public.daily_missions
    LEFT JOIN public.profiles
      ON profiles.id = daily_missions.user_id
    WHERE daily_missions.mission_date = p_mission_date
  ),
  faction_stats AS (
    SELECT
      COUNT(DISTINCT mission_scope.user_id)::integer AS participants,
      COUNT(DISTINCT mission_scope.user_id) FILTER (WHERE mission_scope.completed)::integer AS completed_users,
      COUNT(*)::integer AS missions_total,
      COUNT(*) FILTER (WHERE mission_scope.completed)::integer AS missions_completed
    FROM mission_scope
    WHERE v_faction IS NOT NULL
      AND mission_scope.faction = v_faction
  ),
  global_stats AS (
    SELECT
      COUNT(DISTINCT mission_scope.user_id)::integer AS participants,
      COUNT(DISTINCT mission_scope.user_id) FILTER (WHERE mission_scope.completed)::integer AS completed_users,
      COUNT(*)::integer AS missions_total,
      COUNT(*) FILTER (WHERE mission_scope.completed)::integer AS missions_completed
    FROM mission_scope
  )
  SELECT
    p_mission_date,
    v_faction,
    COALESCE(faction_stats.participants, 0),
    COALESCE(faction_stats.completed_users, 0),
    CASE
      WHEN COALESCE(faction_stats.participants, 0) = 0 THEN 0
      ELSE ROUND((faction_stats.completed_users::numeric / faction_stats.participants::numeric) * 100)::integer
    END AS faction_completion_percentage,
    COALESCE(faction_stats.missions_total, 0),
    COALESCE(faction_stats.missions_completed, 0),
    COALESCE(global_stats.participants, 0),
    COALESCE(global_stats.completed_users, 0),
    CASE
      WHEN COALESCE(global_stats.participants, 0) = 0 THEN 0
      ELSE ROUND((global_stats.completed_users::numeric / global_stats.participants::numeric) * 100)::integer
    END AS global_completion_percentage,
    COALESCE(global_stats.missions_total, 0),
    COALESCE(global_stats.missions_completed, 0)
  FROM faction_stats
  CROSS JOIN global_stats;
END;
$function$;

REVOKE ALL ON FUNCTION public.get_daily_mission_pulse(date) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_daily_mission_pulse(date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_daily_mission_pulse(date) TO service_role;
