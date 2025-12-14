CREATE OR REPLACE FUNCTION public.delete_user_account(p_user_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- 1. Delete companion evolution cards (depends on companion_evolutions and user_companion)
  DELETE FROM public.companion_evolution_cards WHERE user_id = p_user_id;
  
  -- 2. Delete companion evolutions (depends on user_companion)
  DELETE FROM public.companion_evolutions WHERE companion_id IN (
    SELECT id FROM public.user_companion WHERE user_id = p_user_id
  );
  
  -- 3. Delete companion postcards
  DELETE FROM public.companion_postcards WHERE user_id = p_user_id;
  
  -- 4. Delete companion stories
  DELETE FROM public.companion_stories WHERE user_id = p_user_id;
  
  -- 5. Delete user companion
  DELETE FROM public.user_companion WHERE user_id = p_user_id;
  
  -- 6. Delete challenge progress (depends on user_challenges)
  DELETE FROM public.challenge_progress WHERE user_id = p_user_id;
  
  -- 7. Delete user challenges
  DELETE FROM public.user_challenges WHERE user_id = p_user_id;
  
  -- 8. Delete habit completions (depends on habits)
  DELETE FROM public.habit_completions WHERE user_id = p_user_id;
  
  -- 9. Delete epic habits (depends on habits and epics)
  DELETE FROM public.epic_habits WHERE habit_id IN (
    SELECT id FROM public.habits WHERE user_id = p_user_id
  );
  
  -- 10. Delete habits
  DELETE FROM public.habits WHERE user_id = p_user_id;
  
  -- 11. Delete epic progress log
  DELETE FROM public.epic_progress_log WHERE user_id = p_user_id;
  
  -- 12. Delete epic members
  DELETE FROM public.epic_members WHERE user_id = p_user_id;
  
  -- 13. Delete guild shouts (sender or recipient)
  DELETE FROM public.guild_shouts WHERE sender_id = p_user_id OR recipient_id = p_user_id;
  
  -- 14. Delete guild rivalries
  DELETE FROM public.guild_rivalries WHERE user_id = p_user_id OR rival_id = p_user_id;
  
  -- 15. Delete guild story reads
  DELETE FROM public.guild_story_reads WHERE user_id = p_user_id;
  
  -- 16. Delete epic activity feed
  DELETE FROM public.epic_activity_feed WHERE user_id = p_user_id;
  
  -- 17. Delete epics owned by user
  DELETE FROM public.epics WHERE user_id = p_user_id;
  
  -- 18. Delete daily tasks
  DELETE FROM public.daily_tasks WHERE user_id = p_user_id;
  
  -- 19. Delete daily missions
  DELETE FROM public.daily_missions WHERE user_id = p_user_id;
  
  -- 20. Delete daily check-ins
  DELETE FROM public.daily_check_ins WHERE user_id = p_user_id;
  
  -- 21. Delete check-ins
  DELETE FROM public.check_ins WHERE user_id = p_user_id;
  
  -- 22. Delete activity feed
  DELETE FROM public.activity_feed WHERE user_id = p_user_id;
  
  -- 23. Delete achievements
  DELETE FROM public.achievements WHERE user_id = p_user_id;
  
  -- 24. Delete favorites
  DELETE FROM public.favorites WHERE user_id = p_user_id;
  
  -- 25. Delete downloads
  DELETE FROM public.downloads WHERE user_id = p_user_id;
  
  -- 26. Delete adaptive push settings
  DELETE FROM public.adaptive_push_settings WHERE user_id = p_user_id;
  
  -- 27. Delete adaptive push queue
  DELETE FROM public.adaptive_push_queue WHERE user_id = p_user_id;
  
  -- 28. Delete cosmic deep dive feedback
  DELETE FROM public.cosmic_deep_dive_feedback WHERE user_id = p_user_id;
  
  -- 29. Delete user cosmic deep dives
  DELETE FROM public.user_cosmic_deep_dives WHERE user_id = p_user_id;
  
  -- 30. Delete user daily horoscopes
  DELETE FROM public.user_daily_horoscopes WHERE user_id = p_user_id;
  
  -- 31. Delete AI output validation logs
  DELETE FROM public.ai_output_validation_log WHERE user_id = p_user_id;
  
  -- 32. Delete user companion skins
  DELETE FROM public.user_companion_skins WHERE user_id = p_user_id;
  
  -- 33. Delete user roles
  DELETE FROM public.user_roles WHERE user_id = p_user_id;
  
  -- 34. Delete battle participants
  DELETE FROM public.battle_participants WHERE user_id = p_user_id;
  
  -- 35. Delete battle rankings
  DELETE FROM public.battle_rankings WHERE user_id = p_user_id;
  
  -- 36. Null out battle match winners (don't delete the match, just remove winner reference)
  UPDATE public.battle_matches SET winner_user_id = NULL WHERE winner_user_id = p_user_id;
  
  -- 37. Delete referral payouts where user is referrer or referee (FIXED: was recipient_user_id)
  DELETE FROM public.referral_payouts WHERE referrer_id = p_user_id OR referee_id = p_user_id;
  
  -- 38. Delete referral codes owned by user
  DELETE FROM public.referral_codes WHERE owner_type = 'user' AND owner_user_id = p_user_id;
  
  -- 39. Delete push subscriptions
  DELETE FROM public.push_subscriptions WHERE user_id = p_user_id;
  
  -- 40. Delete subscriptions
  DELETE FROM public.subscriptions WHERE user_id = p_user_id;
  
  -- 41. Delete lesson progress
  DELETE FROM public.lesson_progress WHERE user_id = p_user_id;
  
  -- 42. Delete user ai preferences
  DELETE FROM public.user_ai_preferences WHERE user_id = p_user_id;
  
  -- 43. Delete mentor chat history
  DELETE FROM public.mentor_chat_history WHERE user_id = p_user_id;
  
  -- 44. Delete pep talk listens
  DELETE FROM public.pep_talk_listens WHERE user_id = p_user_id;
  
  -- 45. Delete quote interactions
  DELETE FROM public.quote_interactions WHERE user_id = p_user_id;
  
  -- 46. Delete user weekly insights
  DELETE FROM public.user_weekly_insights WHERE user_id = p_user_id;
  
  -- 47. Delete weekly challenge progress
  DELETE FROM public.weekly_challenge_progress WHERE user_id = p_user_id;
  
  -- 48. Delete user weekly challenges
  DELETE FROM public.user_weekly_challenges WHERE user_id = p_user_id;
  
  -- 49. Finally delete the profile (this should cascade to remaining FKs)
  DELETE FROM public.profiles WHERE id = p_user_id;
END;
$function$;