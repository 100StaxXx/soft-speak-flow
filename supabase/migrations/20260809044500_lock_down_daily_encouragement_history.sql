DROP POLICY IF EXISTS "Users can insert their own daily encouragement history"
ON public.daily_encouragement_history;

CREATE POLICY "Users can insert their own daily encouragement history"
ON public.daily_encouragement_history
FOR INSERT
TO authenticated
WITH CHECK ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can update their own daily encouragement history"
ON public.daily_encouragement_history;

CREATE POLICY "Users can update their own daily encouragement history"
ON public.daily_encouragement_history
FOR UPDATE
TO authenticated
USING ((SELECT auth.uid()) = user_id)
WITH CHECK ((SELECT auth.uid()) = user_id);

ALTER FUNCTION public.record_daily_encouragement_progress(UUID, TEXT, REAL)
SECURITY INVOKER;

REVOKE ALL ON FUNCTION public.record_daily_encouragement_progress(UUID, TEXT, REAL) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.record_daily_encouragement_progress(UUID, TEXT, REAL) FROM anon;
GRANT EXECUTE ON FUNCTION public.record_daily_encouragement_progress(UUID, TEXT, REAL) TO authenticated;
GRANT EXECUTE ON FUNCTION public.record_daily_encouragement_progress(UUID, TEXT, REAL) TO service_role;
