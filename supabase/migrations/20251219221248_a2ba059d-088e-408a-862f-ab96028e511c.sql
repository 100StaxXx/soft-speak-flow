-- =============================================
-- PHASE 1: Community System Database Schema
-- =============================================

-- 1. Create communities table
CREATE TABLE public.communities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  invite_code TEXT UNIQUE DEFAULT upper(substring(md5(random()::text) from 1 for 8)),
  is_public BOOLEAN DEFAULT false,
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  theme_color TEXT DEFAULT '#8B5CF6',
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Create community_members table
CREATE TABLE public.community_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  community_id UUID NOT NULL REFERENCES public.communities(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'member')),
  total_contribution INTEGER DEFAULT 0,
  joined_at TIMESTAMPTZ DEFAULT now(),
  last_activity_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(community_id, user_id)
);

-- 3. Add community_id to existing guild tables (nullable for backward compat)
ALTER TABLE public.guild_shouts ADD COLUMN community_id UUID REFERENCES public.communities(id) ON DELETE CASCADE;
ALTER TABLE public.guild_stories ADD COLUMN community_id UUID REFERENCES public.communities(id) ON DELETE CASCADE;
ALTER TABLE public.guild_rivalries ADD COLUMN community_id UUID REFERENCES public.communities(id) ON DELETE CASCADE;

-- 4. Add community_id to epics table (optional link)
ALTER TABLE public.epics ADD COLUMN community_id UUID REFERENCES public.communities(id) ON DELETE SET NULL;

-- 5. Create indexes for performance
CREATE INDEX idx_communities_owner ON public.communities(owner_id);
CREATE INDEX idx_communities_invite_code ON public.communities(invite_code);
CREATE INDEX idx_community_members_community ON public.community_members(community_id);
CREATE INDEX idx_community_members_user ON public.community_members(user_id);
CREATE INDEX idx_guild_shouts_community ON public.guild_shouts(community_id);
CREATE INDEX idx_guild_stories_community ON public.guild_stories(community_id);
CREATE INDEX idx_guild_rivalries_community ON public.guild_rivalries(community_id);
CREATE INDEX idx_epics_community ON public.epics(community_id);

-- 6. Enable RLS on new tables
ALTER TABLE public.communities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.community_members ENABLE ROW LEVEL SECURITY;

-- 7. RLS Policies for communities table

-- Anyone can view public communities
CREATE POLICY "Public communities are viewable by everyone"
ON public.communities FOR SELECT
USING (is_public = true);

-- Members can view their communities (including private ones)
CREATE POLICY "Members can view their communities"
ON public.communities FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.community_members
    WHERE community_members.community_id = communities.id
    AND community_members.user_id = auth.uid()
  )
);

-- Authenticated users can create communities
CREATE POLICY "Authenticated users can create communities"
ON public.communities FOR INSERT
WITH CHECK (auth.uid() = owner_id);

-- Owners and admins can update their communities
CREATE POLICY "Owners and admins can update communities"
ON public.communities FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.community_members
    WHERE community_members.community_id = communities.id
    AND community_members.user_id = auth.uid()
    AND community_members.role IN ('owner', 'admin')
  )
);

-- Only owners can delete communities
CREATE POLICY "Owners can delete communities"
ON public.communities FOR DELETE
USING (owner_id = auth.uid());

-- 8. RLS Policies for community_members table

-- Members can view other members in their communities
CREATE POLICY "Members can view community members"
ON public.community_members FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.community_members cm
    WHERE cm.community_id = community_members.community_id
    AND cm.user_id = auth.uid()
  )
  OR
  EXISTS (
    SELECT 1 FROM public.communities c
    WHERE c.id = community_members.community_id
    AND c.is_public = true
  )
);

-- Users can join communities (insert themselves)
CREATE POLICY "Users can join communities"
ON public.community_members FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Users can leave communities (delete themselves) or owners/admins can remove members
CREATE POLICY "Users can leave or be removed from communities"
ON public.community_members FOR DELETE
USING (
  auth.uid() = user_id
  OR
  EXISTS (
    SELECT 1 FROM public.community_members cm
    WHERE cm.community_id = community_members.community_id
    AND cm.user_id = auth.uid()
    AND cm.role IN ('owner', 'admin')
  )
);

-- Owners and admins can update member roles/contribution
CREATE POLICY "Admins can update community members"
ON public.community_members FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.community_members cm
    WHERE cm.community_id = community_members.community_id
    AND cm.user_id = auth.uid()
    AND cm.role IN ('owner', 'admin')
  )
);

-- 9. Trigger to auto-add owner as member when community is created
CREATE OR REPLACE FUNCTION public.add_community_owner_as_member()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.community_members (community_id, user_id, role)
  VALUES (NEW.id, NEW.owner_id, 'owner')
  ON CONFLICT (community_id, user_id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER on_community_created
  AFTER INSERT ON public.communities
  FOR EACH ROW
  EXECUTE FUNCTION public.add_community_owner_as_member();

-- 10. Trigger to update updated_at on communities
CREATE TRIGGER update_communities_updated_at
  BEFORE UPDATE ON public.communities
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();