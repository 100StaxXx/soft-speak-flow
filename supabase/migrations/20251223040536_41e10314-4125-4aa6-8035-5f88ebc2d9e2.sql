-- Create a SECURITY DEFINER function to get public display information for users
-- This function exposes ONLY safe display fields (nickname from onboarding_data, NOT email)
-- and can be called by any authenticated user to get display info for other users

CREATE OR REPLACE FUNCTION public.get_user_display_info(p_user_ids uuid[])
RETURNS TABLE (
  user_id uuid,
  display_name text,
  faction text
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only allow authenticated users
  IF auth.uid() IS NULL THEN
    RETURN;
  END IF;
  
  RETURN QUERY
  SELECT 
    p.id AS user_id,
    COALESCE(
      -- Try to get nickname from onboarding_data
      (p.onboarding_data->>'nickname'),
      -- Fallback to "Adventurer" - DO NOT expose email
      'Adventurer'
    ) AS display_name,
    p.faction
  FROM profiles p
  WHERE p.id = ANY(p_user_ids);
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.get_user_display_info(uuid[]) TO authenticated;