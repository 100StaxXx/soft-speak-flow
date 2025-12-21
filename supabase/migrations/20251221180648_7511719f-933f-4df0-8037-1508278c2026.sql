-- Create a security definer function to find communities by invite code
-- This bypasses RLS to allow users to find private communities they have the invite code for
CREATE OR REPLACE FUNCTION public.find_community_by_invite_code(p_invite_code text)
RETURNS TABLE (
  id uuid,
  name text,
  description text,
  theme_color text,
  is_public boolean,
  avatar_url text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    c.id,
    c.name,
    c.description,
    c.theme_color,
    c.is_public,
    c.avatar_url
  FROM communities c
  WHERE c.invite_code = UPPER(p_invite_code)
  LIMIT 1;
END;
$$;