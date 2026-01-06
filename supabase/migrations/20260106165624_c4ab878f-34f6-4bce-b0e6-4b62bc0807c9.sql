-- Create contact_reminders table for follow-up reminders
CREATE TABLE public.contact_reminders (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  contact_id UUID NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  reminder_at TIMESTAMPTZ NOT NULL,
  reason TEXT,
  sent BOOLEAN NOT NULL DEFAULT false,
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.contact_reminders ENABLE ROW LEVEL SECURITY;

-- RLS policies for user-only access
CREATE POLICY "Users can view their own reminders"
  ON public.contact_reminders FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own reminders"
  ON public.contact_reminders FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own reminders"
  ON public.contact_reminders FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own reminders"
  ON public.contact_reminders FOR DELETE
  USING (auth.uid() = user_id);

-- Index for efficient cron queries
CREATE INDEX idx_contact_reminders_pending ON public.contact_reminders(reminder_at) 
  WHERE sent = false;