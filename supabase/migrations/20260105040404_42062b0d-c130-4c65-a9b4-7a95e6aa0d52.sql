-- Drop the existing constraint
ALTER TABLE daily_tasks DROP CONSTRAINT IF EXISTS daily_tasks_source_check;

-- Add new constraint with 'plan_my_day' included
ALTER TABLE daily_tasks ADD CONSTRAINT daily_tasks_source_check 
  CHECK (source = ANY (ARRAY['manual', 'voice', 'nlp', 'inbox', 'recurring', 'onboarding', 'plan_my_day']));