
CREATE OR REPLACE FUNCTION public.get_user_display_info(p_user_ids uuid[])
RETURNS TABLE(user_id uuid, display_name text, faction text)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Only allow authenticated users
  IF auth.uid() IS NULL THEN
    RETURN;
  END IF;
  
  RETURN QUERY
  SELECT 
    p.id AS user_id,
    COALESCE(
      -- Try to get userName from onboarding_data (correct field name)
      (p.onboarding_data->>'userName'),
      -- Fallback to "Adventurer" - DO NOT expose email
      'Adventurer'
    ) AS display_name,
    p.faction
  FROM profiles p
  WHERE p.id = ANY(p_user_ids);
END;
$function$;
