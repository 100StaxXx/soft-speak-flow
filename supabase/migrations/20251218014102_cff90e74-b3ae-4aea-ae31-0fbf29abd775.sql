-- Add time-based reminder fields to habits table
ALTER TABLE public.habits
ADD COLUMN IF NOT EXISTS preferred_time TIME,
ADD COLUMN IF NOT EXISTS reminder_enabled BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS reminder_minutes_before INTEGER DEFAULT 15,
ADD COLUMN IF NOT EXISTS reminder_sent_today BOOLEAN DEFAULT false;