
-- Allow tasks without a date (inbox tasks)
ALTER TABLE daily_tasks ALTER COLUMN task_date DROP NOT NULL;

-- Index for fast inbox queries
CREATE INDEX idx_daily_tasks_inbox ON daily_tasks(user_id) WHERE task_date IS NULL AND completed = false;
