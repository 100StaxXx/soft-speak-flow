-- Fix: get_user_display_info RPC function - add authorization checks
-- Only allow fetching display info for users in same community/epic as the caller
-- Remove email prefix fallback to prevent PII leakage

CREATE OR REPLACE FUNCTION public.get_user_display_info(p_user_ids uuid[])
 RETURNS TABLE(user_id uuid, display_name text, faction text)
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT 
    p.id AS user_id,
    COALESCE(
      (p.onboarding_data->>'userName'),
      'Adventurer'
    ) AS display_name,
    (p.onboarding_data->>'faction') AS faction
  FROM profiles p
  WHERE p.id = ANY(p_user_ids)
    -- Authorization: Only return info for users that the caller has a relationship with
    AND (
      -- User is requesting their own info
      p.id = auth.uid()
      -- OR they share a community
      OR EXISTS (
        SELECT 1 FROM community_members cm1
        JOIN community_members cm2 ON cm1.community_id = cm2.community_id
        WHERE cm1.user_id = auth.uid() AND cm2.user_id = p.id
      )
      -- OR they share an epic (as member or owner)
      OR EXISTS (
        SELECT 1 FROM epic_members em1
        JOIN epic_members em2 ON em1.epic_id = em2.epic_id
        WHERE em1.user_id = auth.uid() AND em2.user_id = p.id
      )
      -- OR caller owns an epic that the user is a member of
      OR EXISTS (
        SELECT 1 FROM epics e
        JOIN epic_members em ON em.epic_id = e.id
        WHERE e.user_id = auth.uid() AND em.user_id = p.id
      )
      -- OR user owns an epic that the caller is a member of
      OR EXISTS (
        SELECT 1 FROM epics e
        JOIN epic_members em ON em.epic_id = e.id
        WHERE e.user_id = p.id AND em.user_id = auth.uid()
      )
    );
$function$;