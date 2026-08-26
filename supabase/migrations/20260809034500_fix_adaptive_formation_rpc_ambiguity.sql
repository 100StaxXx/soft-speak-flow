-- PostgreSQL exposes RETURNS TABLE column names as PL/pgSQL variables. Name
-- the constraints explicitly so ON CONFLICT cannot confuse output variables
-- with table columns in either formation RPC.

DO $migration$
DECLARE
  v_definition text;
BEGIN
  SELECT pg_get_functiondef(
    'public.prepare_daily_formation_practice(date,text,text,text,text,text,integer,text)'::regprocedure
  ) INTO v_definition;
  EXECUTE replace(
    v_definition,
    'ON CONFLICT (user_id, practice_date) DO NOTHING',
    'ON CONFLICT ON CONSTRAINT daily_formation_assignments_user_date_key DO NOTHING'
  );

  SELECT pg_get_functiondef(
    'public.complete_daily_formation_practice(uuid)'::regprocedure
  ) INTO v_definition;
  EXECUTE replace(
    v_definition,
    'ON CONFLICT (assignment_id) DO NOTHING',
    'ON CONFLICT ON CONSTRAINT formation_xp_events_assignment_key DO NOTHING'
  );
END;
$migration$;
