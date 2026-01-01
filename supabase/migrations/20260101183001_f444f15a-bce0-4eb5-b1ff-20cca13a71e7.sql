-- Fix: Replace delete_user_account function with explicit table allowlist instead of dynamic information_schema enumeration
CREATE OR REPLACE FUNCTION public.delete_user_account(p_user_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  companion_ids uuid[];
  caller_id uuid;
  is_service boolean;
  -- Explicit allowlist of tables with user_id column to delete from
  user_tables text[] := ARRAY[
    'achievements', 'activity_feed', 'adaptive_push_queue', 'adaptive_push_settings',
    'adversary_essences', 'ai_interactions', 'ai_output_validation_log', 'astral_encounters',
    'battle_history', 'battle_participants', 'battle_rankings', 'challenge_progress',
    'check_ins', 'community_members', 'companion_evolution_cards', 'companion_postcards',
    'companion_stories', 'cosmic_codex_entries', 'cosmic_deep_dive_feedback', 'daily_check_ins',
    'daily_missions', 'daily_tasks', 'downloads', 'epic_activity_feed', 'epic_members',
    'epic_milestones', 'epic_progress_log', 'epics', 'evening_reflections', 'external_calendar_events',
    'favorites', 'focus_sessions', 'guild_artifact_unlocks', 'guild_blessing_charges',
    'guild_blessings', 'habit_completions', 'habits', 'journey_phases', 'listening_history',
    'meditation_sessions', 'morning_intentions', 'notification_preferences', 'pep_talk_plays',
    'playlist_items', 'playlists', 'productivity_stats', 'push_tokens', 'quote_shares',
    'ritual_history', 'ritual_reorder_history', 'ritual_skips', 'ritual_templates',
    'ritual_versions', 'rituals', 'saved_quotes', 'security_audit_log', 'story_progress',
    'subscription_events', 'subscriptions', 'task_contexts', 'time_blocks', 'user_ai_preferences',
    'user_calendar_connections', 'user_challenges', 'user_companion', 'user_companion_skins',
    'user_devices', 'user_epic_rewards', 'user_feature_flags', 'user_integrations',
    'user_mentor_voices', 'user_mentors', 'user_onboarding_state', 'user_preferences',
    'user_reflections', 'user_roles', 'user_settings', 'user_streaks', 'user_timezone',
    'weekly_reviews', 'xp_events'
  ];
  tbl text;
BEGIN
  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'User id is required';
  END IF;

  -- Get caller identity
  caller_id := auth.uid();
  is_service := (auth.jwt() ->> 'role') = 'service_role';

  -- Verify caller can only delete their own account (unless service_role)
  IF NOT is_service AND (caller_id IS NULL OR caller_id != p_user_id) THEN
    RAISE EXCEPTION 'Unauthorized: Users can only delete their own account';
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
  WHERE referrer_id = p_user_id OR referee_id = p_user_id;

  DELETE FROM public.referral_codes
  WHERE owner_type = 'user' AND owner_user_id = p_user_id;

  -- Delete from all user tables using explicit allowlist (no dynamic SQL from system catalogs)
  FOREACH tbl IN ARRAY user_tables
  LOOP
    BEGIN
      EXECUTE format('DELETE FROM public.%I WHERE user_id = $1', tbl) USING p_user_id;
    EXCEPTION WHEN undefined_table OR undefined_column THEN
      -- Table or column doesn't exist, skip silently
      NULL;
    END;
  END LOOP;

  -- Null out references in shared tables that should be preserved for analytics/audit history
  UPDATE public.battle_matches
  SET winner_user_id = NULL
  WHERE winner_user_id = p_user_id;

  -- Finally delete the profile row (cascades clean up many dependent records)
  DELETE FROM public.profiles WHERE id = p_user_id;
END;
$function$;