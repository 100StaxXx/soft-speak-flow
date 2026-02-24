-- Remove legacy habit cap trigger.
-- Campaign creation now supports more than two rituals, and this trigger
-- causes inserts to fail for valid plans (e.g. 3+ ritual campaigns).

DROP TRIGGER IF EXISTS enforce_active_habit_limit ON public.habits;
DROP FUNCTION IF EXISTS public.check_active_habit_limit();
