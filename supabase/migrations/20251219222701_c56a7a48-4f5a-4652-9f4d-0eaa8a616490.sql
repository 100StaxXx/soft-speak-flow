-- Fix RLS policies for guild_shouts to support community_id
DROP POLICY IF EXISTS "Users can view shouts in their epics" ON public.guild_shouts;
CREATE POLICY "Users can view shouts in their epics or communities" ON public.guild_shouts
  FOR SELECT USING (
    -- Epic-based access (existing)
    (epic_id IN (SELECT epic_id FROM epic_members WHERE user_id = auth.uid()))
    OR (epic_id IN (SELECT id FROM epics WHERE user_id = auth.uid()))
    -- Community-based access (new)
    OR (community_id IN (SELECT community_id FROM community_members WHERE user_id = auth.uid()))
  );

-- Fix RLS policies for guild_rivalries to support community_id
DROP POLICY IF EXISTS "Users can view rivalries in their epics" ON public.guild_rivalries;
CREATE POLICY "Users can view rivalries in their epics or communities" ON public.guild_rivalries
  FOR SELECT USING (
    -- Epic-based access (existing)
    (epic_id IN (SELECT epic_id FROM epic_members WHERE user_id = auth.uid()))
    OR (epic_id IN (SELECT id FROM epics WHERE user_id = auth.uid()))
    -- Community-based access (new)
    OR (community_id IN (SELECT community_id FROM community_members WHERE user_id = auth.uid()))
  );

-- Fix RLS policies for guild_stories to support community_id
DROP POLICY IF EXISTS "Users can view guild stories for their epics" ON public.guild_stories;
CREATE POLICY "Users can view guild stories for their epics or communities" ON public.guild_stories
  FOR SELECT USING (
    -- Epic-based access (existing)
    (epic_id IN (SELECT epic_id FROM epic_members WHERE user_id = auth.uid()))
    OR (epic_id IN (SELECT id FROM epics WHERE user_id = auth.uid()))
    -- Community-based access (new)
    OR (community_id IN (SELECT community_id FROM community_members WHERE user_id = auth.uid()))
  );

-- Make invite_code NOT NULL with a default (it was nullable but the interface expects it)
ALTER TABLE public.communities 
  ALTER COLUMN invite_code SET NOT NULL;