-- Add column to track start-time notifications (separate from early reminders)
ALTER TABLE public.daily_tasks 
ADD COLUMN IF NOT EXISTS start_notification_sent boolean DEFAULT false;