-- Add global reminder toggles to profiles
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS habit_reminders_enabled BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS task_reminders_enabled BOOLEAN DEFAULT true;