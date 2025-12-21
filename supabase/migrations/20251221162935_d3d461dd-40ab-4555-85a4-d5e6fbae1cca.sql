-- Create helper function to check community membership (bypasses RLS)
CREATE OR REPLACE FUNCTION public.is_community_member_safe(p_community_id UUID, p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.community_members
    WHERE community_id = p_community_id 
    AND user_id = p_user_id
  );
$$;

-- Create helper function to check if community is public (bypasses RLS)
CREATE OR REPLACE FUNCTION public.is_community_public(p_community_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT is_public FROM public.communities WHERE id = p_community_id),
    false
  );
$$;

-- Drop existing problematic policies on communities
DROP POLICY IF EXISTS "Members can view their communities" ON public.communities;
DROP POLICY IF EXISTS "Anyone can view public communities" ON public.communities;

-- Recreate communities SELECT policy using safe function
CREATE POLICY "Users can view communities they belong to or public ones"
ON public.communities FOR SELECT
USING (
  is_public = true 
  OR owner_id = auth.uid() 
  OR is_community_member_safe(id, auth.uid())
);

-- Drop existing problematic policy on community_members
DROP POLICY IF EXISTS "Members can view community members" ON public.community_members;

-- Recreate community_members SELECT policy using safe functions
CREATE POLICY "Members can view community members"
ON public.community_members FOR SELECT
USING (
  is_community_member_safe(community_id, auth.uid())
  OR is_community_public(community_id)
);