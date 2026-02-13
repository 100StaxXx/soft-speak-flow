-- Remove remaining legacy tutorial pseudo-quests from existing timelines.
-- Pass A: remove all onboarding-source pseudo-quests.
DELETE FROM public.daily_tasks
WHERE source = 'onboarding';

-- Pass B: remove legacy tutorial-title pseudo-quests that may not be tagged with source='onboarding'.
DELETE FROM public.daily_tasks AS dt
USING public.profiles AS p
WHERE dt.user_id = p.id
  AND (
    p.onboarding_completed = TRUE
    OR (p.onboarding_data ->> 'walkthrough_completed') = 'true'
  )
  AND dt.task_text IN (
    'Create Your First Quest 🎯',
    'Create Your First Quest',
    'Complete Your First Quest ✅',
    'Complete Your First Quest',
    'Meet Your Companion ✨',
    'Meet Your Companion',
    'Morning Check-in 🌅',
    'Morning Check-in',
    'Create Your First Campaign 🚀',
    'Create Your First Campaign',
    'Listen to Your Mentor 🎧',
    'Listen to Your Mentor'
  )
  AND dt.difficulty = 'easy'
  AND dt.is_main_quest = FALSE
  AND dt.xp_reward IN (2, 3, 4);
