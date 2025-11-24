-- Add reminder fields to daily_tasks table
ALTER TABLE daily_tasks 
ADD COLUMN reminder_enabled boolean DEFAULT false,
ADD COLUMN reminder_minutes_before integer DEFAULT 15,
ADD COLUMN reminder_sent boolean DEFAULT false;

-- Add index for efficient reminder queries
CREATE INDEX idx_daily_tasks_reminders 
ON daily_tasks(user_id, task_date, scheduled_time, reminder_enabled) 
WHERE reminder_enabled = true AND reminder_sent = false AND completed = false;