-- Update get_user_display_info to use email prefix as fallback before "Adventurer"
CREATE OR REPLACE FUNCTION public.get_user_display_info(p_user_ids uuid[])
RETURNS TABLE (
  user_id uuid,
  display_name text,
  faction text
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    p.id AS user_id,
    COALESCE(
      (p.onboarding_data->>'userName'),
      SPLIT_PART(p.email, '@', 1),
      'Adventurer'
    ) AS display_name,
    (p.onboarding_data->>'faction') AS faction
  FROM profiles p
  WHERE p.id = ANY(p_user_ids);
$$;