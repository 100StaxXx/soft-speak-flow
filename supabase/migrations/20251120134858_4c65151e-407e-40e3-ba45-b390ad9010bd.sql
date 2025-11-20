-- Add is_main_quest field to daily_tasks table
ALTER TABLE daily_tasks ADD COLUMN is_main_quest boolean DEFAULT false;

-- Add a comment explaining the field
COMMENT ON COLUMN daily_tasks.is_main_quest IS 'Marks if this task is the users Main Quest for the day (only one can be true at a time)';

-- Create index for faster queries filtering by main quest
CREATE INDEX idx_daily_tasks_main_quest ON daily_tasks(user_id, task_date, is_main_quest) WHERE is_main_quest = true;