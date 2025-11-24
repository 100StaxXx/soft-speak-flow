-- Add advanced scheduling fields to daily_tasks
ALTER TABLE daily_tasks
ADD COLUMN IF NOT EXISTS scheduled_time time without time zone,
ADD COLUMN IF NOT EXISTS estimated_duration integer,
ADD COLUMN IF NOT EXISTS recurrence_pattern text,
ADD COLUMN IF NOT EXISTS recurrence_days integer[],
ADD COLUMN IF NOT EXISTS is_recurring boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS parent_template_id uuid REFERENCES daily_tasks(id) ON DELETE SET NULL;

-- Add index for querying by scheduled time
CREATE INDEX IF NOT EXISTS idx_daily_tasks_scheduled_time ON daily_tasks(scheduled_time) WHERE scheduled_time IS NOT NULL;

-- Add index for recurring quests
CREATE INDEX IF NOT EXISTS idx_daily_tasks_recurring ON daily_tasks(is_recurring) WHERE is_recurring = true;

COMMENT ON COLUMN daily_tasks.scheduled_time IS 'Specific time the quest is scheduled for (time blocking)';
COMMENT ON COLUMN daily_tasks.estimated_duration IS 'Estimated duration in minutes';
COMMENT ON COLUMN daily_tasks.recurrence_pattern IS 'Recurrence pattern: daily, weekly, custom, or null for one-time';
COMMENT ON COLUMN daily_tasks.recurrence_days IS 'Array of day indices (0=Mon, 6=Sun) for custom recurrence';
COMMENT ON COLUMN daily_tasks.is_recurring IS 'Whether this is a recurring quest template';
COMMENT ON COLUMN daily_tasks.parent_template_id IS 'References the template quest if this is a recurring instance';