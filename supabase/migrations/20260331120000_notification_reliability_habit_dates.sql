-- Track habit reminder delivery by the habit's local due date instead of a sticky boolean.
ALTER TABLE public.habits
ADD COLUMN IF NOT EXISTS reminder_last_sent_for_date date;

-- Migrate existing "sent today" rows into the new date marker so users do not receive
-- an immediate duplicate reminder on deploy. Future reads/writes use the date field.
UPDATE public.habits
SET reminder_last_sent_for_date = CURRENT_DATE
WHERE reminder_last_sent_for_date IS NULL
  AND reminder_sent_today = true;

CREATE INDEX IF NOT EXISTS idx_habits_user_reminder_last_sent_for_date
  ON public.habits (user_id, reminder_last_sent_for_date);
