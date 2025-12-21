-- Create a security definer function to join a community by ID
-- This bypasses RLS to handle the foreign key validation against private communities
CREATE OR REPLACE FUNCTION public.join_community_by_id(p_community_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_user_id uuid;
  v_community_exists boolean;
  v_already_member boolean;
BEGIN
  -- Get the current user
  v_user_id := auth.uid();
  
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authenticated');
  END IF;
  
  -- Check if community exists
  SELECT EXISTS(SELECT 1 FROM communities WHERE id = p_community_id) INTO v_community_exists;
  
  IF NOT v_community_exists THEN
    RETURN jsonb_build_object('success', false, 'error', 'Community not found');
  END IF;
  
  -- Check if already a member
  SELECT EXISTS(
    SELECT 1 FROM community_members 
    WHERE community_id = p_community_id AND user_id = v_user_id
  ) INTO v_already_member;
  
  IF v_already_member THEN
    RETURN jsonb_build_object('success', false, 'error', 'Already a member of this guild');
  END IF;
  
  -- Insert the new member
  INSERT INTO community_members (community_id, user_id, role)
  VALUES (p_community_id, v_user_id, 'member');
  
  RETURN jsonb_build_object('success', true);
END;
$$;