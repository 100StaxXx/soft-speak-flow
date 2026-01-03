-- Drop the existing constraint
ALTER TABLE daily_tasks DROP CONSTRAINT IF EXISTS daily_tasks_source_check;

-- Recreate with "onboarding" added
ALTER TABLE daily_tasks ADD CONSTRAINT daily_tasks_source_check 
  CHECK (source = ANY (ARRAY['manual'::text, 'voice'::text, 'nlp'::text, 'inbox'::text, 'recurring'::text, 'onboarding'::text]));