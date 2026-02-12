-- Remove legacy onboarding pseudo-quests from user timelines.
DELETE FROM public.daily_tasks
WHERE source = 'onboarding';

