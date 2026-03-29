-- Harden community privilege-bearing updates so owner/member transitions happen
-- only through server-owned RPCs.

DROP POLICY IF EXISTS "Owners and admins can update communities" ON public.communities;
CREATE POLICY "Owners and admins can update communities"
ON public.communities
FOR UPDATE
USING (public.is_community_admin(id, auth.uid()))
WITH CHECK (
  public.is_community_admin(id, auth.uid())
  AND owner_id IS NOT DISTINCT FROM (
    SELECT c.owner_id
    FROM public.communities c
    WHERE c.id = communities.id
  )
  AND invite_code IS NOT DISTINCT FROM (
    SELECT c.invite_code
    FROM public.communities c
    WHERE c.id = communities.id
  )
);

DROP POLICY IF EXISTS "Admins can update community members" ON public.community_members;
CREATE POLICY "Admins can update community members"
ON public.community_members
FOR UPDATE
USING (public.is_community_admin(community_id, auth.uid()))
WITH CHECK (
  public.is_community_admin(community_id, auth.uid())
  AND id IS NOT DISTINCT FROM (
    SELECT cm.id
    FROM public.community_members cm
    WHERE cm.id = community_members.id
  )
  AND community_id IS NOT DISTINCT FROM (
    SELECT cm.community_id
    FROM public.community_members cm
    WHERE cm.id = community_members.id
  )
  AND user_id IS NOT DISTINCT FROM (
    SELECT cm.user_id
    FROM public.community_members cm
    WHERE cm.id = community_members.id
  )
  AND role IS NOT DISTINCT FROM (
    SELECT cm.role
    FROM public.community_members cm
    WHERE cm.id = community_members.id
  )
  AND joined_at IS NOT DISTINCT FROM (
    SELECT cm.joined_at
    FROM public.community_members cm
    WHERE cm.id = community_members.id
  )
);

CREATE OR REPLACE FUNCTION public.assert_community_owner_membership(p_community_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_owner_id UUID;
  v_matching_owner_memberships INTEGER;
  v_owner_memberships INTEGER;
BEGIN
  IF p_community_id IS NULL THEN
    RETURN;
  END IF;

  SELECT owner_id
  INTO v_owner_id
  FROM public.communities
  WHERE id = p_community_id;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  SELECT COUNT(*)
  INTO v_matching_owner_memberships
  FROM public.community_members
  WHERE community_id = p_community_id
    AND user_id = v_owner_id
    AND role = 'owner';

  SELECT COUNT(*)
  INTO v_owner_memberships
  FROM public.community_members
  WHERE community_id = p_community_id
    AND role = 'owner';

  IF v_matching_owner_memberships <> 1 OR v_owner_memberships <> 1 THEN
    RAISE EXCEPTION 'Community owner membership must match communities.owner_id'
      USING ERRCODE = '23514';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.enforce_community_owner_membership()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  PERFORM public.assert_community_owner_membership(
    CASE
      WHEN TG_TABLE_NAME = 'communities' THEN NEW.id
      ELSE COALESCE(NEW.community_id, OLD.community_id)
    END
  );

  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS enforce_community_owner_membership_on_communities ON public.communities;
CREATE CONSTRAINT TRIGGER enforce_community_owner_membership_on_communities
AFTER INSERT OR UPDATE OF owner_id ON public.communities
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW
EXECUTE FUNCTION public.enforce_community_owner_membership();

DROP TRIGGER IF EXISTS enforce_community_owner_membership_on_members ON public.community_members;
CREATE CONSTRAINT TRIGGER enforce_community_owner_membership_on_members
AFTER INSERT OR UPDATE OF role, user_id, community_id OR DELETE ON public.community_members
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW
EXECUTE FUNCTION public.enforce_community_owner_membership();

CREATE OR REPLACE FUNCTION public.update_community_member_role(
  p_member_id UUID,
  p_new_role TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor_id UUID := auth.uid();
  v_actor_role TEXT;
  v_target_member public.community_members%ROWTYPE;
BEGIN
  IF v_actor_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required'
      USING ERRCODE = '42501';
  END IF;

  IF p_new_role NOT IN ('admin', 'member') THEN
    RAISE EXCEPTION 'Invalid community role transition'
      USING ERRCODE = '22023';
  END IF;

  SELECT *
  INTO v_target_member
  FROM public.community_members
  WHERE id = p_member_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Community member not found'
      USING ERRCODE = 'P0002';
  END IF;

  SELECT role
  INTO v_actor_role
  FROM public.community_members
  WHERE community_id = v_target_member.community_id
    AND user_id = v_actor_id;

  IF v_actor_role IS NULL THEN
    RAISE EXCEPTION 'Not a member of this guild'
      USING ERRCODE = '42501';
  END IF;

  IF v_actor_role <> 'owner' THEN
    RAISE EXCEPTION 'Only community owners can change member roles'
      USING ERRCODE = '42501';
  END IF;

  IF v_target_member.role = 'owner' THEN
    RAISE EXCEPTION 'Use transfer_community_ownership to change the owner'
      USING ERRCODE = '42501';
  END IF;

  IF v_target_member.user_id = v_actor_id THEN
    RAISE EXCEPTION 'Owners cannot change their own role'
      USING ERRCODE = '42501';
  END IF;

  UPDATE public.community_members
  SET role = p_new_role
  WHERE id = p_member_id;

  RETURN jsonb_build_object(
    'success', true,
    'community_id', v_target_member.community_id,
    'member_id', p_member_id,
    'role', p_new_role
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.transfer_community_ownership(
  p_community_id UUID,
  p_new_owner_user_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor_id UUID := auth.uid();
  v_existing_owner_id UUID;
  v_membership_exists BOOLEAN;
BEGIN
  IF v_actor_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required'
      USING ERRCODE = '42501';
  END IF;

  SELECT owner_id
  INTO v_existing_owner_id
  FROM public.communities
  WHERE id = p_community_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Community not found'
      USING ERRCODE = 'P0002';
  END IF;

  IF v_existing_owner_id <> v_actor_id THEN
    RAISE EXCEPTION 'Only the current owner can transfer community ownership'
      USING ERRCODE = '42501';
  END IF;

  IF p_new_owner_user_id = v_actor_id THEN
    RAISE EXCEPTION 'New owner must be different from the current owner'
      USING ERRCODE = '22023';
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM public.community_members
    WHERE community_id = p_community_id
      AND user_id = p_new_owner_user_id
  )
  INTO v_membership_exists;

  IF NOT v_membership_exists THEN
    RAISE EXCEPTION 'New owner must already be a community member'
      USING ERRCODE = '42501';
  END IF;

  UPDATE public.communities
  SET owner_id = p_new_owner_user_id
  WHERE id = p_community_id;

  UPDATE public.community_members
  SET role = 'admin'
  WHERE community_id = p_community_id
    AND user_id = v_actor_id;

  UPDATE public.community_members
  SET role = 'owner'
  WHERE community_id = p_community_id
    AND user_id = p_new_owner_user_id;

  RETURN jsonb_build_object(
    'success', true,
    'community_id', p_community_id,
    'new_owner_user_id', p_new_owner_user_id
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.update_community_member_role(UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.update_community_member_role(UUID, TEXT) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.transfer_community_ownership(UUID, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.transfer_community_ownership(UUID, UUID) TO authenticated;
