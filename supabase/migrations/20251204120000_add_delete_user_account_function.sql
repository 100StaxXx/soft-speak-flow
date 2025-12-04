-- Helper to remove all user-owned data in one transaction
DROP FUNCTION IF EXISTS public.delete_user_account(uuid);

CREATE FUNCTION public.delete_user_account(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  table_record record;
  companion_ids uuid[];
BEGIN
  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'User id is required';
  END IF;

  -- Capture companion ids up front so we can remove dependent rows before the user_companion deletion
  SELECT array_agg(id) INTO companion_ids
  FROM public.user_companion
  WHERE user_id = p_user_id;

  IF companion_ids IS NOT NULL THEN
    DELETE FROM public.companion_evolutions WHERE companion_id = ANY(companion_ids);
    DELETE FROM public.companion_evolution_cards WHERE companion_id = ANY(companion_ids);
    DELETE FROM public.companion_postcards WHERE companion_id = ANY(companion_ids);
    DELETE FROM public.companion_stories WHERE companion_id = ANY(companion_ids);
    DELETE FROM public.xp_events WHERE companion_id = ANY(companion_ids);
  END IF;

  -- Remove challenge progress rows before user_challenges are purged
  DELETE FROM public.challenge_progress
  WHERE user_challenge_id IN (
    SELECT id FROM public.user_challenges WHERE user_id = p_user_id
  );

  -- Clean referral artifacts tied to this user
  DELETE FROM public.referral_payouts
  WHERE referrer_id = p_user_id OR recipient_user_id = p_user_id;

  DELETE FROM public.referral_codes
  WHERE owner_type = 'user' AND owner_user_id = p_user_id;

  -- Remove all rows from tables that store a user_id foreign key
  FOR table_record IN
    SELECT c.table_schema, c.table_name
    FROM information_schema.columns c
    JOIN information_schema.tables t ON t.table_name = c.table_name AND t.table_schema = c.table_schema
    WHERE c.table_schema = 'public'
      AND c.column_name = 'user_id'
      AND t.table_type = 'BASE TABLE'
      AND c.table_name <> 'profiles'
  LOOP
    EXECUTE format('DELETE FROM %I.%I WHERE user_id = $1', table_record.table_schema, table_record.table_name)
    USING p_user_id;
  END LOOP;

  -- Null out references in shared tables that should be preserved for analytics/audit history
  UPDATE public.battle_matches
  SET winner_user_id = NULL
  WHERE winner_user_id = p_user_id;

  -- Finally delete the profile row (cascades clean up many dependent records)
  DELETE FROM public.profiles WHERE id = p_user_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.delete_user_account(uuid) TO service_role;
