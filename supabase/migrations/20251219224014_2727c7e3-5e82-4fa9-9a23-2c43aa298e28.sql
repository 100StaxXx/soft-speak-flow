-- Drop the problematic policies that cause infinite recursion
DROP POLICY IF EXISTS "Members can view community members" ON public.community_members;
DROP POLICY IF EXISTS "Admins can update community members" ON public.community_members;
DROP POLICY IF EXISTS "Users can leave or be removed from communities" ON public.community_members;
DROP POLICY IF EXISTS "Users can join communities" ON public.community_members;

-- Create a security definer function to check membership without triggering RLS
CREATE OR REPLACE FUNCTION public.is_community_member(p_community_id uuid, p_user_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM community_members
    WHERE community_id = p_community_id 
    AND user_id = p_user_id
  );
$$;

-- Create a security definer function to check admin/owner status
CREATE OR REPLACE FUNCTION public.is_community_admin(p_community_id uuid, p_user_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM community_members
    WHERE community_id = p_community_id 
    AND user_id = p_user_id
    AND role IN ('owner', 'admin')
  );
$$;

-- Recreate policies using the security definer functions (no self-reference)
CREATE POLICY "Members can view community members"
ON public.community_members
FOR SELECT
USING (
  public.is_community_member(community_id, auth.uid())
  OR EXISTS (
    SELECT 1 FROM communities c
    WHERE c.id = community_id AND c.is_public = true
  )
);

CREATE POLICY "Users can join communities"
ON public.community_members
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can update community members"
ON public.community_members
FOR UPDATE
USING (public.is_community_admin(community_id, auth.uid()));

CREATE POLICY "Users can leave or admins can remove members"
ON public.community_members
FOR DELETE
USING (
  auth.uid() = user_id
  OR public.is_community_admin(community_id, auth.uid())
);