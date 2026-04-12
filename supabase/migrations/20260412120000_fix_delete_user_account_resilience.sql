-- Fix account deletion failures caused by incomplete FK cleanup.
--
-- The previous version ran the FK-cleanup loop once.  If any single cleanup
-- step failed (e.g. because an intermediary table still had blocking child
-- rows), the failure was silently logged but the referencing rows survived.
-- The subsequent DELETE FROM profiles then hit the same FK and raised an
-- unhandled exception, surfacing as ACCOUNT_DELETION_BACKEND_UNAVAILABLE.
--
-- This revision:
--   1. Runs the FK-cleanup loop twice so cascading inter-table dependencies
--      that were not resolvable on the first pass get a second chance.
--   2. Wraps the final profile deletion in an exception handler that
--      returns a clear diagnostic instead of an opaque 500.

CREATE OR REPLACE FUNCTION public.delete_user_account(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  caller_id uuid;
  request_role text;
  is_service boolean;
  table_record record;
  fk_record record;
  pass integer;
BEGIN
  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'User id is required';
  END IF;

  caller_id := auth.uid();
  request_role := COALESCE(auth.jwt() ->> 'role', current_setting('request.jwt.claim.role', true), '');
  is_service := request_role = 'service_role';

  IF NOT is_service AND (caller_id IS NULL OR caller_id <> p_user_id) THEN
    RAISE EXCEPTION 'Unauthorized: You can only delete your own account';
  END IF;

  -- Delete dependent rows that can block user-owned parent-table cleanup.
  IF to_regclass('public.daily_tasks') IS NOT NULL THEN
    IF to_regclass('public.subtasks') IS NOT NULL THEN
      BEGIN
        EXECUTE
          'DELETE FROM public.subtasks
           WHERE task_id IN (
             SELECT id FROM public.daily_tasks WHERE user_id = $1
           )'
        USING p_user_id;
      EXCEPTION WHEN undefined_column OR undefined_table THEN
        NULL;
      END;
    END IF;

    IF to_regclass('public.task_dependencies') IS NOT NULL THEN
      BEGIN
        EXECUTE
          'DELETE FROM public.task_dependencies
           WHERE task_id IN (
             SELECT id FROM public.daily_tasks WHERE user_id = $1
           )'
        USING p_user_id;
      EXCEPTION WHEN undefined_column OR undefined_table THEN
        NULL;
      END;

      BEGIN
        EXECUTE
          'DELETE FROM public.task_dependencies
           WHERE depends_on_task_id IN (
             SELECT id FROM public.daily_tasks WHERE user_id = $1
           )'
        USING p_user_id;
      EXCEPTION WHEN undefined_column OR undefined_table THEN
        NULL;
      END;
    END IF;
  END IF;

  IF to_regclass('public.habits') IS NOT NULL AND to_regclass('public.epic_habits') IS NOT NULL THEN
    BEGIN
      EXECUTE
        'DELETE FROM public.epic_habits
         WHERE habit_id IN (
           SELECT id FROM public.habits WHERE user_id = $1
         )'
      USING p_user_id;
    EXCEPTION WHEN undefined_column OR undefined_table THEN
      NULL;
    END;
  END IF;

  IF to_regclass('public.user_challenges') IS NOT NULL AND to_regclass('public.challenge_progress') IS NOT NULL THEN
    BEGIN
      EXECUTE
        'DELETE FROM public.challenge_progress
         WHERE user_challenge_id IN (
           SELECT id FROM public.user_challenges WHERE user_id = $1
         )'
      USING p_user_id;
    EXCEPTION WHEN undefined_column OR undefined_table THEN
      NULL;
    END;
  END IF;

  IF to_regclass('public.playlists') IS NOT NULL AND to_regclass('public.playlist_items') IS NOT NULL THEN
    BEGIN
      EXECUTE
        'DELETE FROM public.playlist_items
         WHERE playlist_id IN (
           SELECT id FROM public.playlists WHERE user_id = $1
         )'
      USING p_user_id;
    EXCEPTION WHEN undefined_column OR undefined_table THEN
      NULL;
    END;
  END IF;

  -- Companion-dependent tables: delete child rows before user_companion rows.
  IF to_regclass('public.user_companion') IS NOT NULL THEN
    DECLARE
      companion_ids uuid[];
    BEGIN
      SELECT array_agg(id) INTO companion_ids
      FROM public.user_companion
      WHERE user_id = p_user_id;

      IF companion_ids IS NOT NULL THEN
        IF to_regclass('public.companion_evolutions') IS NOT NULL THEN
          BEGIN
            EXECUTE 'DELETE FROM public.companion_evolutions WHERE companion_id = ANY($1)' USING companion_ids;
          EXCEPTION WHEN OTHERS THEN NULL;
          END;
        END IF;
        IF to_regclass('public.companion_evolution_cards') IS NOT NULL THEN
          BEGIN
            EXECUTE 'DELETE FROM public.companion_evolution_cards WHERE companion_id = ANY($1)' USING companion_ids;
          EXCEPTION WHEN OTHERS THEN NULL;
          END;
        END IF;
        IF to_regclass('public.companion_evolution_jobs') IS NOT NULL THEN
          BEGIN
            EXECUTE 'DELETE FROM public.companion_evolution_jobs WHERE companion_id = ANY($1)' USING companion_ids;
          EXCEPTION WHEN OTHERS THEN NULL;
          END;
        END IF;
        IF to_regclass('public.companion_postcards') IS NOT NULL THEN
          BEGIN
            EXECUTE 'DELETE FROM public.companion_postcards WHERE companion_id = ANY($1)' USING companion_ids;
          EXCEPTION WHEN OTHERS THEN NULL;
          END;
        END IF;
        IF to_regclass('public.companion_stories') IS NOT NULL THEN
          BEGIN
            EXECUTE 'DELETE FROM public.companion_stories WHERE companion_id = ANY($1)' USING companion_ids;
          EXCEPTION WHEN OTHERS THEN NULL;
          END;
        END IF;
        IF to_regclass('public.companion_memories') IS NOT NULL THEN
          BEGIN
            EXECUTE 'DELETE FROM public.companion_memories WHERE companion_id = ANY($1)' USING companion_ids;
          EXCEPTION WHEN OTHERS THEN NULL;
          END;
        END IF;
        IF to_regclass('public.companion_attribute_events') IS NOT NULL THEN
          BEGIN
            EXECUTE 'DELETE FROM public.companion_attribute_events WHERE companion_id = ANY($1)' USING companion_ids;
          EXCEPTION WHEN OTHERS THEN NULL;
          END;
        END IF;
        IF to_regclass('public.xp_events') IS NOT NULL THEN
          BEGIN
            EXECUTE 'DELETE FROM public.xp_events WHERE companion_id = ANY($1)' USING companion_ids;
          EXCEPTION WHEN OTHERS THEN NULL;
          END;
        END IF;
      END IF;
    END;
  END IF;

  -- Referral cleanup has changed column names over time; handle both shapes.
  IF to_regclass('public.referral_payouts') IS NOT NULL THEN
    BEGIN
      EXECUTE
        'DELETE FROM public.referral_payouts
         WHERE referrer_id = $1 OR referee_id = $1'
      USING p_user_id;
    EXCEPTION WHEN undefined_column THEN
      BEGIN
        EXECUTE
          'DELETE FROM public.referral_payouts
           WHERE referrer_id = $1 OR recipient_user_id = $1'
        USING p_user_id;
      EXCEPTION WHEN undefined_column THEN
        BEGIN
          EXECUTE
            'DELETE FROM public.referral_payouts
             WHERE referrer_id = $1'
          USING p_user_id;
        EXCEPTION WHEN undefined_column OR undefined_table THEN
          NULL;
        END;
      WHEN undefined_table THEN
        NULL;
      END;
    WHEN undefined_table THEN
      NULL;
    END;
  END IF;

  IF to_regclass('public.referral_codes') IS NOT NULL THEN
    BEGIN
      EXECUTE
        'DELETE FROM public.referral_codes
         WHERE owner_type = ''user'' AND owner_user_id = $1'
      USING p_user_id;
    EXCEPTION WHEN undefined_column THEN
      BEGIN
        EXECUTE
          'DELETE FROM public.referral_codes
           WHERE owner_user_id = $1'
        USING p_user_id;
      EXCEPTION WHEN undefined_column OR undefined_table THEN
        NULL;
      END;
    WHEN undefined_table THEN
      NULL;
    END;
  END IF;

  -- Delete from every base table that has a user_id column.
  FOR table_record IN
    SELECT DISTINCT c.table_name
    FROM information_schema.columns c
    JOIN information_schema.tables t
      ON t.table_schema = c.table_schema
     AND t.table_name = c.table_name
    WHERE c.table_schema = 'public'
      AND t.table_type = 'BASE TABLE'
      AND c.column_name = 'user_id'
      AND c.table_name <> 'profiles'
    ORDER BY c.table_name
  LOOP
    BEGIN
      EXECUTE format('DELETE FROM public.%I WHERE user_id = $1', table_record.table_name)
      USING p_user_id;
    EXCEPTION WHEN OTHERS THEN
      RAISE LOG 'delete_user_account: skipping public.% due to %', table_record.table_name, SQLERRM;
    END;
  END LOOP;

  -- Delete rows in tables that store owner_user_id.
  FOR table_record IN
    SELECT DISTINCT c.table_name
    FROM information_schema.columns c
    JOIN information_schema.tables t
      ON t.table_schema = c.table_schema
     AND t.table_name = c.table_name
    WHERE c.table_schema = 'public'
      AND t.table_type = 'BASE TABLE'
      AND c.column_name = 'owner_user_id'
    ORDER BY c.table_name
  LOOP
    BEGIN
      EXECUTE format('DELETE FROM public.%I WHERE owner_user_id = $1', table_record.table_name)
      USING p_user_id;
    EXCEPTION WHEN OTHERS THEN
      RAISE LOG 'delete_user_account: skipping owner_user_id cleanup for public.% due to %', table_record.table_name, SQLERRM;
    END;
  END LOOP;

  -- Run FK cleanup twice: some non-cascading FKs reference profiles or
  -- auth.users via intermediary tables.  The first pass may fail for rows
  -- that still have their own blocking children; the second pass catches
  -- those once the first pass has removed enough rows.
  FOR pass IN 1..2 LOOP
    FOR fk_record IN
      SELECT
        kcu.table_schema,
        kcu.table_name,
        kcu.column_name,
        rc.delete_rule,
        cols.is_nullable
      FROM information_schema.table_constraints tc
      JOIN information_schema.referential_constraints rc
        ON tc.constraint_schema = rc.constraint_schema
       AND tc.constraint_name = rc.constraint_name
      JOIN information_schema.key_column_usage kcu
        ON tc.constraint_schema = kcu.constraint_schema
       AND tc.constraint_name = kcu.constraint_name
      JOIN information_schema.constraint_column_usage ccu
        ON tc.constraint_schema = ccu.constraint_schema
       AND tc.constraint_name = ccu.constraint_name
      JOIN information_schema.columns cols
        ON cols.table_schema = kcu.table_schema
       AND cols.table_name = kcu.table_name
       AND cols.column_name = kcu.column_name
      WHERE tc.constraint_type = 'FOREIGN KEY'
        AND kcu.table_schema = 'public'
        AND rc.delete_rule IN ('NO ACTION', 'RESTRICT')
        AND (
          (ccu.table_schema = 'public' AND ccu.table_name = 'profiles' AND ccu.column_name = 'id')
          OR
          (ccu.table_schema = 'auth' AND ccu.table_name = 'users' AND ccu.column_name = 'id')
        )
    LOOP
      BEGIN
        IF fk_record.is_nullable = 'YES' THEN
          EXECUTE format(
            'UPDATE %I.%I SET %I = NULL WHERE %I = $1',
            fk_record.table_schema,
            fk_record.table_name,
            fk_record.column_name,
            fk_record.column_name
          )
          USING p_user_id;
        ELSE
          EXECUTE format(
            'DELETE FROM %I.%I WHERE %I = $1',
            fk_record.table_schema,
            fk_record.table_name,
            fk_record.column_name
          )
          USING p_user_id;
        END IF;
      EXCEPTION WHEN OTHERS THEN
        IF pass = 2 THEN
          RAISE LOG 'delete_user_account: FK cleanup failed on pass 2 for %.%(%): %',
            fk_record.table_schema,
            fk_record.table_name,
            fk_record.column_name,
            SQLERRM;
        END IF;
      END;
    END LOOP;
  END LOOP;

  -- Final profile deletion.  If this still fails a blocking FK survived
  -- both cleanup passes — surface the real constraint name so the edge
  -- function can log it instead of returning a generic 500.
  BEGIN
    DELETE FROM public.profiles WHERE id = p_user_id;
  EXCEPTION WHEN foreign_key_violation THEN
    RAISE EXCEPTION 'Profile deletion blocked by constraint: %', SQLERRM;
  END;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.delete_user_account(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.delete_user_account(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.delete_user_account(uuid) TO service_role;
