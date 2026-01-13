-- Fix delete_user_account: remove views (user_achievement_stats is a VIEW, not a table)
CREATE OR REPLACE FUNCTION public.delete_user_account(p_user_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  caller_id UUID;
  is_service BOOLEAN;
BEGIN
  -- Validate input
  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'User id is required';
  END IF;

  -- Get the calling user's ID
  caller_id := auth.uid();
  
  -- Check if this is a service role call (from edge function with service key)
  is_service := (auth.jwt() ->> 'role') = 'service_role';
  
  -- Authorization check: Only allow:
  -- 1. Service role (for admin operations via edge functions)
  -- 2. User deleting their own account
  IF NOT is_service AND (caller_id IS NULL OR caller_id != p_user_id) THEN
    RAISE EXCEPTION 'Unauthorized: You can only delete your own account';
  END IF;

  -- Delete user data from all related tables (order matters for foreign keys)
  -- First delete tables with foreign key dependencies
  DELETE FROM public.adversary_essences WHERE user_id = p_user_id;
  DELETE FROM public.astral_encounters WHERE user_id = p_user_id;
  DELETE FROM public.companion_evolution_cards WHERE user_id = p_user_id;
  DELETE FROM public.companion_memories WHERE user_id = p_user_id;
  DELETE FROM public.companion_pending_consequences WHERE user_id = p_user_id;
  DELETE FROM public.companion_postcards WHERE user_id = p_user_id;
  DELETE FROM public.companion_stories WHERE user_id = p_user_id;
  DELETE FROM public.cosmic_codex_entries WHERE user_id = p_user_id;
  DELETE FROM public.user_companion_skins WHERE user_id = p_user_id;
  DELETE FROM public.user_companion WHERE user_id = p_user_id;
  
  -- Epic related
  DELETE FROM public.epic_activity_feed WHERE user_id = p_user_id;
  DELETE FROM public.epic_journey_paths WHERE user_id = p_user_id;
  DELETE FROM public.epic_members WHERE user_id = p_user_id;
  DELETE FROM public.epic_progress_log WHERE user_id = p_user_id;
  DELETE FROM public.user_epic_rewards WHERE user_id = p_user_id;
  DELETE FROM public.epics WHERE user_id = p_user_id;
  DELETE FROM public.epic_habits WHERE habit_id IN (SELECT id FROM public.habits WHERE user_id = p_user_id);
  
  -- Habits and tasks
  DELETE FROM public.habit_completions WHERE user_id = p_user_id;
  DELETE FROM public.subtasks WHERE task_id IN (SELECT id FROM public.daily_tasks WHERE user_id = p_user_id);
  DELETE FROM public.task_dependencies WHERE task_id IN (SELECT id FROM public.daily_tasks WHERE user_id = p_user_id);
  DELETE FROM public.task_dependencies WHERE depends_on_task_id IN (SELECT id FROM public.daily_tasks WHERE user_id = p_user_id);
  DELETE FROM public.daily_tasks WHERE user_id = p_user_id;
  DELETE FROM public.habits WHERE user_id = p_user_id;
  DELETE FROM public.daily_missions WHERE user_id = p_user_id;
  
  -- Check-ins and reflections
  DELETE FROM public.daily_check_ins WHERE user_id = p_user_id;
  DELETE FROM public.check_ins WHERE user_id = p_user_id;
  DELETE FROM public.user_reflections WHERE user_id = p_user_id;
  DELETE FROM public.evening_reflections WHERE user_id = p_user_id;
  DELETE FROM public.mood_logs WHERE user_id = p_user_id;
  
  -- Contacts and interactions
  DELETE FROM public.contact_interactions WHERE user_id = p_user_id;
  DELETE FROM public.contact_reminders WHERE user_id = p_user_id;
  DELETE FROM public.contacts WHERE user_id = p_user_id;
  
  -- Challenges
  DELETE FROM public.challenge_progress WHERE user_id = p_user_id;
  DELETE FROM public.user_challenges WHERE user_id = p_user_id;
  
  -- AI and learning
  DELETE FROM public.ai_interactions WHERE user_id = p_user_id;
  DELETE FROM public.ai_output_validation_log WHERE user_id = p_user_id;
  DELETE FROM public.user_ai_learning WHERE user_id = p_user_id;
  DELETE FROM public.user_ai_preferences WHERE user_id = p_user_id;
  
  -- Battles
  DELETE FROM public.battle_participants WHERE user_id = p_user_id;
  DELETE FROM public.battle_history WHERE user_id = p_user_id;
  DELETE FROM public.battle_rankings WHERE user_id = p_user_id;
  
  -- Guild/Community - using correct column names
  DELETE FROM public.guild_artifact_unlocks WHERE unlocked_by = p_user_id;
  DELETE FROM public.guild_blessing_charges WHERE user_id = p_user_id;
  DELETE FROM public.guild_boss_damage_log WHERE user_id = p_user_id;
  DELETE FROM public.guild_member_titles WHERE user_id = p_user_id;
  DELETE FROM public.guild_ritual_attendance WHERE user_id = p_user_id;
  DELETE FROM public.guild_shouts WHERE sender_id = p_user_id OR recipient_id = p_user_id;
  DELETE FROM public.guild_story_reads WHERE user_id = p_user_id;
  DELETE FROM public.muted_guild_users WHERE user_id = p_user_id OR muted_user_id = p_user_id;
  DELETE FROM public.shout_push_log WHERE sender_id = p_user_id OR recipient_id = p_user_id;
  DELETE FROM public.community_members WHERE user_id = p_user_id;
  DELETE FROM public.communities WHERE owner_id = p_user_id;
  
  -- Notifications and push
  DELETE FROM public.adaptive_push_queue WHERE user_id = p_user_id;
  DELETE FROM public.adaptive_push_settings WHERE user_id = p_user_id;
  DELETE FROM public.push_device_tokens WHERE user_id = p_user_id;
  DELETE FROM public.push_notification_queue WHERE user_id = p_user_id;
  DELETE FROM public.push_subscriptions WHERE user_id = p_user_id;
  DELETE FROM public.user_daily_pushes WHERE user_id = p_user_id;
  DELETE FROM public.user_daily_quote_pushes WHERE user_id = p_user_id;
  DELETE FROM public.reminders WHERE user_id = p_user_id;
  DELETE FROM public.task_reminders_log WHERE user_id = p_user_id;
  
  -- Content and preferences
  DELETE FROM public.favorites WHERE user_id = p_user_id;
  DELETE FROM public.downloads WHERE user_id = p_user_id;
  DELETE FROM public.lesson_progress WHERE user_id = p_user_id;
  DELETE FROM public.mentor_chat_feedback WHERE user_id = p_user_id;
  DELETE FROM public.mentor_chats WHERE user_id = p_user_id;
  DELETE FROM public.mentor_nudges WHERE user_id = p_user_id;
  DELETE FROM public.rhythm_track_ratings WHERE user_id = p_user_id;
  DELETE FROM public.questionnaire_responses WHERE user_id = p_user_id;
  
  -- Stats and achievements (user_achievement_stats is a VIEW, skip it)
  DELETE FROM public.achievements WHERE user_id = p_user_id;
  DELETE FROM public.activity_feed WHERE user_id = p_user_id;
  DELETE FROM public.xp_events WHERE user_id = p_user_id;
  DELETE FROM public.focus_sessions WHERE user_id = p_user_id;
  DELETE FROM public.productivity_stats WHERE user_id = p_user_id;
  DELETE FROM public.weekly_recaps WHERE user_id = p_user_id;
  DELETE FROM public.companion_behavior_log WHERE user_id = p_user_id;
  DELETE FROM public.companion_memorials WHERE user_id = p_user_id;
  
  -- Calendar and planning
  DELETE FROM public.external_calendar_events WHERE user_id = p_user_id;
  DELETE FROM public.user_calendar_connections WHERE user_id = p_user_id;
  DELETE FROM public.daily_plan_sessions WHERE user_id = p_user_id;
  DELETE FROM public.daily_planning_preferences WHERE user_id = p_user_id;
  DELETE FROM public.task_contexts WHERE user_id = p_user_id;
  
  -- Horoscope and cosmic
  DELETE FROM public.cosmic_deep_dive_feedback WHERE user_id = p_user_id;
  DELETE FROM public.user_cosmic_deep_dives WHERE user_id = p_user_id;
  DELETE FROM public.user_daily_horoscopes WHERE user_id = p_user_id;
  
  -- Misc user data
  DELETE FROM public.user_roles WHERE user_id = p_user_id;
  DELETE FROM public.user_welcome_images WHERE user_id = p_user_id;
  DELETE FROM public.morning_briefings WHERE user_id = p_user_id;
  DELETE FROM public.subscriptions WHERE user_id = p_user_id;
  DELETE FROM public.payment_history WHERE user_id = p_user_id;
  
  -- Finally delete the profile (this must be last as other tables reference it)
  DELETE FROM public.profiles WHERE id = p_user_id;
  
  -- Note: The actual auth.users deletion is handled by the edge function
  -- using supabase.auth.admin.deleteUser() after this function completes
END;
$$;