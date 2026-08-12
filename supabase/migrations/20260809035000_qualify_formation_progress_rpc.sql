-- RETURNS TABLE exposes total_xp and practices_completed as variables. Qualify
-- the matching table reads so the atomic completion RPC is unambiguous.

DO $migration$
DECLARE
  v_definition text;
BEGIN
  SELECT pg_get_functiondef(
    'public.complete_daily_formation_practice(uuid)'::regprocedure
  ) INTO v_definition;

  v_definition := replace(
    v_definition,
    'UPDATE public.formation_progress
      SET',
    'UPDATE public.formation_progress AS progress
      SET'
  );
  v_definition := replace(
    v_definition,
    'total_xp = total_xp + v_assignment.xp_reward',
    'total_xp = progress.total_xp + v_assignment.xp_reward'
  );
  v_definition := replace(
    v_definition,
    'practices_completed = practices_completed + 1',
    'practices_completed = progress.practices_completed + 1'
  );
  v_definition := replace(
    v_definition,
    'WHERE user_id = v_user_id;
      v_awarded := v_assignment.xp_reward;',
    'WHERE progress.user_id = v_user_id;
      v_awarded := v_assignment.xp_reward;'
  );

  EXECUTE v_definition;
END;
$migration$;
