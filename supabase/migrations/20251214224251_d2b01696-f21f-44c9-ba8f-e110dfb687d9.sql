-- Fix: Remove user_achievement_stats (it's a VIEW, not a table)
CREATE OR REPLACE FUNCTION public.delete_user_account(p_user_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- 1. Delete companion evolution cards
  DELETE FROM public.companion_evolution_cards WHERE user_id = p_user_id;
  
  -- 2. Delete companion evolutions
  DELETE FROM public.companion_evolutions WHERE companion_id IN (
    SELECT id FROM public.user_companion WHERE user_id = p_user_id
  );
  
  -- 3. Delete companion postcards
  DELETE FROM public.companion_postcards WHERE user_id = p_user_id;
  
  -- 4. Delete companion stories
  DELETE FROM public.companion_stories WHERE user_id = p_user_id;
  
  -- 5. Delete adversary essences
  DELETE FROM public.adversary_essences WHERE user_id = p_user_id;
  
  -- 6. Delete astral encounters
  DELETE FROM public.astral_encounters WHERE user_id = p_user_id;
  
  -- 7. Delete xp events
  DELETE FROM public.xp_events WHERE user_id = p_user_id;
  
  -- 8. Delete user companion
  DELETE FROM public.user_companion WHERE user_id = p_user_id;
  
  -- 9. Delete challenge progress
  DELETE FROM public.challenge_progress WHERE user_id = p_user_id;
  
  -- 10. Delete user challenges
  DELETE FROM public.user_challenges WHERE user_id = p_user_id;
  
  -- 11. Delete habit completions
  DELETE FROM public.habit_completions WHERE user_id = p_user_id;
  
  -- 12. Delete epic habits
  DELETE FROM public.epic_habits WHERE habit_id IN (
    SELECT id FROM public.habits WHERE user_id = p_user_id
  );
  
  -- 13. Delete habits
  DELETE FROM public.habits WHERE user_id = p_user_id;
  
  -- 14. Delete epic progress log
  DELETE FROM public.epic_progress_log WHERE user_id = p_user_id;
  
  -- 15. Delete epic members
  DELETE FROM public.epic_members WHERE user_id = p_user_id;
  
  -- 16. Delete guild shouts
  DELETE FROM public.guild_shouts WHERE sender_id = p_user_id OR recipient_id = p_user_id;
  
  -- 17. Delete guild rivalries
  DELETE FROM public.guild_rivalries WHERE user_id = p_user_id OR rival_id = p_user_id;
  
  -- 18. Delete guild story reads
  DELETE FROM public.guild_story_reads WHERE user_id = p_user_id;
  
  -- 19. Delete muted guild users
  DELETE FROM public.muted_guild_users WHERE user_id = p_user_id OR muted_user_id = p_user_id;
  
  -- 20. Delete epic activity feed
  DELETE FROM public.epic_activity_feed WHERE user_id = p_user_id;
  
  -- 21. Delete epics owned by user
  DELETE FROM public.epics WHERE user_id = p_user_id;
  
  -- 22. Delete task reminders log
  DELETE FROM public.task_reminders_log WHERE user_id = p_user_id;
  
  -- 23. Delete daily tasks
  DELETE FROM public.daily_tasks WHERE user_id = p_user_id;
  
  -- 24. Delete daily missions
  DELETE FROM public.daily_missions WHERE user_id = p_user_id;
  
  -- 25. Delete daily check-ins
  DELETE FROM public.daily_check_ins WHERE user_id = p_user_id;
  
  -- 26. Delete check-ins
  DELETE FROM public.check_ins WHERE user_id = p_user_id;
  
  -- 27. Delete activity feed
  DELETE FROM public.activity_feed WHERE user_id = p_user_id;
  
  -- 28. Delete achievements
  DELETE FROM public.achievements WHERE user_id = p_user_id;
  
  -- NOTE: user_achievement_stats is a VIEW, not a table - skip it
  
  -- 29. Delete favorites
  DELETE FROM public.favorites WHERE user_id = p_user_id;
  
  -- 30. Delete downloads
  DELETE FROM public.downloads WHERE user_id = p_user_id;
  
  -- 31. Delete adaptive push settings
  DELETE FROM public.adaptive_push_settings WHERE user_id = p_user_id;
  
  -- 32. Delete adaptive push queue
  DELETE FROM public.adaptive_push_queue WHERE user_id = p_user_id;
  
  -- 33. Delete cosmic deep dive feedback
  DELETE FROM public.cosmic_deep_dive_feedback WHERE user_id = p_user_id;
  
  -- 34. Delete user cosmic deep dives
  DELETE FROM public.user_cosmic_deep_dives WHERE user_id = p_user_id;
  
  -- 35. Delete user daily horoscopes
  DELETE FROM public.user_daily_horoscopes WHERE user_id = p_user_id;
  
  -- 36. Delete cosmic codex entries
  DELETE FROM public.cosmic_codex_entries WHERE user_id = p_user_id;
  
  -- 37. Delete ai output validation logs
  DELETE FROM public.ai_output_validation_log WHERE user_id = p_user_id;
  
  -- 38. Delete user companion skins
  DELETE FROM public.user_companion_skins WHERE user_id = p_user_id;
  
  -- 39. Delete user roles
  DELETE FROM public.user_roles WHERE user_id = p_user_id;
  
  -- 40. Delete battle participants
  DELETE FROM public.battle_participants WHERE user_id = p_user_id;
  
  -- 41. Delete battle rankings
  DELETE FROM public.battle_rankings WHERE user_id = p_user_id;
  
  -- 42. Null out battle match winners
  UPDATE public.battle_matches SET winner_user_id = NULL WHERE winner_user_id = p_user_id;
  
  -- 43. Delete referral payouts
  DELETE FROM public.referral_payouts WHERE referrer_id = p_user_id OR referee_id = p_user_id;
  
  -- 44. Delete referral codes owned by user
  DELETE FROM public.referral_codes WHERE owner_type = 'user' AND owner_user_id = p_user_id;
  
  -- 45. Delete push subscriptions
  DELETE FROM public.push_subscriptions WHERE user_id = p_user_id;
  
  -- 46. Delete push device tokens
  DELETE FROM public.push_device_tokens WHERE user_id = p_user_id;
  
  -- 47. Delete push notification queue
  DELETE FROM public.push_notification_queue WHERE user_id = p_user_id;
  
  -- 48. Delete user daily pushes
  DELETE FROM public.user_daily_pushes WHERE user_id = p_user_id;
  
  -- 49. Delete user daily quote pushes
  DELETE FROM public.user_daily_quote_pushes WHERE user_id = p_user_id;
  
  -- 50. Delete payment history
  DELETE FROM public.payment_history WHERE user_id = p_user_id;
  
  -- 51. Delete subscriptions
  DELETE FROM public.subscriptions WHERE user_id = p_user_id;
  
  -- 52. Delete lesson progress
  DELETE FROM public.lesson_progress WHERE user_id = p_user_id;
  
  -- 53. Delete user ai preferences
  DELETE FROM public.user_ai_preferences WHERE user_id = p_user_id;
  
  -- 54. Delete mentor chats
  DELETE FROM public.mentor_chats WHERE user_id = p_user_id;
  
  -- 55. Delete mentor nudges
  DELETE FROM public.mentor_nudges WHERE user_id = p_user_id;
  
  -- 56. Delete mood logs
  DELETE FROM public.mood_logs WHERE user_id = p_user_id;
  
  -- 57. Delete user reflections
  DELETE FROM public.user_reflections WHERE user_id = p_user_id;
  
  -- 58. Delete reminders
  DELETE FROM public.reminders WHERE user_id = p_user_id;
  
  -- 59. Delete questionnaire responses
  DELETE FROM public.questionnaire_responses WHERE user_id = p_user_id;
  
  -- 60. Finally delete the profile
  DELETE FROM public.profiles WHERE id = p_user_id;
END;
$function$;