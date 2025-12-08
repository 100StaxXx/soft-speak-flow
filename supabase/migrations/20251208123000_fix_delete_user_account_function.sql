-- Ensure referral audit logs cascade when a user is removed so the
-- delete_user_account helper can succeed without manual cleanup.
ALTER TABLE public.referral_audit_log
  DROP CONSTRAINT IF EXISTS referral_audit_log_referrer_id_fkey;

ALTER TABLE public.referral_audit_log
  DROP CONSTRAINT IF EXISTS referral_audit_log_referee_id_fkey;

ALTER TABLE public.referral_audit_log
  ADD CONSTRAINT referral_audit_log_referrer_id_fkey
    FOREIGN KEY (referrer_id)
    REFERENCES public.profiles(id)
    ON DELETE CASCADE,
  ADD CONSTRAINT referral_audit_log_referee_id_fkey
    FOREIGN KEY (referee_id)
    REFERENCES public.profiles(id)
    ON DELETE CASCADE;

-- Keep lookups fast when cleaning up referral audit rows.
CREATE INDEX IF NOT EXISTS idx_referral_audit_log_referrer
  ON public.referral_audit_log(referrer_id);

CREATE INDEX IF NOT EXISTS idx_referral_audit_log_referee
  ON public.referral_audit_log(referee_id);

-- Harden the delete_user_account helper so it proactively clears any
-- tables with foreign keys that would otherwise block profile deletion.
CREATE OR REPLACE FUNCTION public.delete_user_account(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  table_record record;
  fk_record record;
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

  -- Proactively clear foreign keys referencing profiles that do not cascade.
  FOR fk_record IN
    SELECT
      kcu.table_schema,
      kcu.table_name,
      kcu.column_name,
      rc.delete_rule,
      cols.is_nullable
    FROM information_schema.table_constraints tc
    JOIN information_schema.referential_constraints rc
      ON tc.constraint_name = rc.constraint_name AND tc.constraint_schema = rc.constraint_schema
    JOIN information_schema.key_column_usage kcu
      ON tc.constraint_name = kcu.constraint_name AND tc.constraint_schema = kcu.constraint_schema
    JOIN information_schema.constraint_column_usage ccu
      ON tc.constraint_name = ccu.constraint_name AND tc.constraint_schema = ccu.constraint_schema
    JOIN information_schema.columns cols
      ON cols.table_schema = kcu.table_schema
     AND cols.table_name = kcu.table_name
     AND cols.column_name = kcu.column_name
    WHERE tc.constraint_type = 'FOREIGN KEY'
      AND ccu.table_schema = 'public'
      AND ccu.table_name = 'profiles'
      AND ccu.column_name = 'id'
      AND rc.delete_rule IN ('NO ACTION', 'RESTRICT')
      AND kcu.column_name <> 'user_id'
  LOOP
    IF fk_record.is_nullable = 'YES' THEN
      EXECUTE format('UPDATE %I.%I SET %I = NULL WHERE %I = $1',
        fk_record.table_schema,
        fk_record.table_name,
        fk_record.column_name,
        fk_record.column_name)
      USING p_user_id;
    ELSE
      EXECUTE format('DELETE FROM %I.%I WHERE %I = $1',
        fk_record.table_schema,
        fk_record.table_name,
        fk_record.column_name)
      USING p_user_id;
    END IF;
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
