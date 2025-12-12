-- Add reminder fields to daily_tasks table
ALTER TABLE daily_tasks 
ADD COLUMN IF NOT EXISTS reminder_enabled boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS reminder_minutes_before integer DEFAULT 15,
ADD COLUMN IF NOT EXISTS reminder_sent boolean DEFAULT false;

-- Create index for efficient reminder queries
CREATE INDEX IF NOT EXISTS idx_daily_tasks_reminders 
ON daily_tasks(reminder_enabled, reminder_sent, scheduled_time) 
WHERE reminder_enabled = true AND reminder_sent = false AND completed = false;

-- Create task_reminders_log table to track sent reminders
CREATE TABLE IF NOT EXISTS task_reminders_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL REFERENCES daily_tasks(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  reminder_sent_at timestamptz NOT NULL DEFAULT now(),
  notification_status text,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE task_reminders_log ENABLE ROW LEVEL SECURITY;

-- RLS policies for task_reminders_log
CREATE POLICY "Users can view their own reminder logs"
ON task_reminders_log FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "System can insert reminder logs"
ON task_reminders_log FOR INSERT
WITH CHECK (true);