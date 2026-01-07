-- Fix: Add authorization check to delete_user_account function
-- This prevents any authenticated user from deleting another user's account

CREATE OR REPLACE FUNCTION public.delete_user_account(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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
  DELETE FROM public.user_rewards WHERE user_id = p_user_id;
  DELETE FROM public.user_skins WHERE user_id = p_user_id;
  DELETE FROM public.user_challenges WHERE user_id = p_user_id;
  DELETE FROM public.user_preferences WHERE user_id = p_user_id;
  DELETE FROM public.user_reflections WHERE user_id = p_user_id;
  DELETE FROM public.user_roles WHERE user_id = p_user_id;
  DELETE FROM public.user_streaks WHERE user_id = p_user_id;
  DELETE FROM public.user_subscription WHERE user_id = p_user_id;
  DELETE FROM public.user_voice_preferences WHERE user_id = p_user_id;
  DELETE FROM public.user_xp WHERE user_id = p_user_id;
  DELETE FROM public.user_companion WHERE user_id = p_user_id;
  DELETE FROM public.daily_tasks WHERE user_id = p_user_id;
  DELETE FROM public.daily_missions WHERE user_id = p_user_id;
  DELETE FROM public.daily_check_ins WHERE user_id = p_user_id;
  DELETE FROM public.check_ins WHERE user_id = p_user_id;
  DELETE FROM public.habits WHERE user_id = p_user_id;
  DELETE FROM public.epics WHERE user_id = p_user_id;
  DELETE FROM public.achievements WHERE user_id = p_user_id;
  DELETE FROM public.activity_feed WHERE user_id = p_user_id;
  DELETE FROM public.contacts WHERE user_id = p_user_id;
  DELETE FROM public.downloads WHERE user_id = p_user_id;
  DELETE FROM public.favorites WHERE user_id = p_user_id;
  DELETE FROM public.listening_history WHERE user_id = p_user_id;
  DELETE FROM public.mentor_conversations WHERE user_id = p_user_id;
  DELETE FROM public.push_tokens WHERE user_id = p_user_id;
  DELETE FROM public.profiles WHERE id = p_user_id;
  
  -- Note: The actual auth.users deletion is handled by the edge function
  -- using supabase.auth.admin.deleteUser() after this function completes
END;
$$;