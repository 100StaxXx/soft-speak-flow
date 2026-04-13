DROP FUNCTION IF EXISTS public.get_daily_mission_pulse(date);

CREATE OR REPLACE FUNCTION public.get_daily_mission_pulse(p_mission_date date)
RETURNS TABLE(
  mission_date date,
  caller_faction text,
  faction_completion_percentage integer,
  network_average_completion_percentage integer,
  faction_vs_network_average_pp integer
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
  faction_completion AS (
    SELECT
      mission_scope.faction,
      CASE
        WHEN COUNT(*) = 0 THEN 0
        ELSE ROUND((COUNT(*) FILTER (WHERE mission_scope.completed)::numeric / COUNT(*)::numeric) * 100)::integer
      END AS completion_percentage
    FROM mission_scope
    WHERE mission_scope.faction IS NOT NULL
    GROUP BY mission_scope.faction
  ),
  caller_stats AS (
    SELECT COALESCE((
      SELECT faction_completion.completion_percentage
      FROM faction_completion
      WHERE faction_completion.faction = v_faction
      LIMIT 1
    ), 0) AS completion_percentage
  ),
  network_stats AS (
    SELECT CASE
      WHEN v_faction IS NULL THEN COALESCE((
        SELECT ROUND(AVG(faction_completion.completion_percentage))::integer
        FROM faction_completion
      ), 0)
      WHEN EXISTS (
        SELECT 1
        FROM faction_completion
        WHERE faction_completion.faction <> v_faction
      ) THEN COALESCE((
        SELECT ROUND(AVG(other_faction.completion_percentage))::integer
        FROM faction_completion AS other_faction
        WHERE other_faction.faction <> v_faction
      ), 0)
      ELSE (SELECT caller_stats.completion_percentage FROM caller_stats)
    END AS completion_percentage
  )
  SELECT
    p_mission_date,
    v_faction,
    caller_stats.completion_percentage,
    network_stats.completion_percentage,
    CASE
      WHEN v_faction IS NULL THEN 0
      ELSE caller_stats.completion_percentage - network_stats.completion_percentage
    END AS faction_vs_network_average_pp
  FROM caller_stats
  CROSS JOIN network_stats;
END;
$function$;

REVOKE ALL ON FUNCTION public.get_daily_mission_pulse(date) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_daily_mission_pulse(date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_daily_mission_pulse(date) TO service_role;
