-- Remove accounts whose latest companion would have entered the retired
-- companion re-selection migration flow. Those users now restart from a
-- fresh account and complete standard onboarding again.
DO $$
DECLARE
  legacy_user RECORD;
BEGIN
  FOR legacy_user IN
    SELECT latest_companion.user_id
    FROM (
      SELECT DISTINCT ON (uc.user_id)
        uc.user_id,
        uc.preset_id,
        uc.current_stage
      FROM public.user_companion AS uc
      ORDER BY uc.user_id, uc.created_at DESC NULLS LAST, uc.id DESC
    ) AS latest_companion
    WHERE latest_companion.preset_id IS NULL
      AND COALESCE(latest_companion.current_stage, -1) <> 0
  LOOP
    PERFORM public.delete_user_account(legacy_user.user_id);
    DELETE FROM auth.users WHERE id = legacy_user.user_id;
  END LOOP;
END
$$;
