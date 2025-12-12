-- Drop the incorrect unique constraint
ALTER TABLE habit_completions DROP CONSTRAINT IF EXISTS habit_completions_habit_id_date_key;

-- Add the correct unique constraint that includes user_id
ALTER TABLE habit_completions ADD CONSTRAINT habit_completions_user_habit_date_key UNIQUE (user_id, habit_id, date);