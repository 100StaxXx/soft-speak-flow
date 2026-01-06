-- Add contact linking to daily_tasks
ALTER TABLE public.daily_tasks
ADD COLUMN contact_id uuid REFERENCES public.contacts(id) ON DELETE SET NULL,
ADD COLUMN auto_log_interaction boolean DEFAULT true;

-- Create index for faster lookups
CREATE INDEX idx_daily_tasks_contact_id ON public.daily_tasks(contact_id) WHERE contact_id IS NOT NULL;

-- Add relationship tracking preferences
ALTER TABLE public.daily_planning_preferences
ADD COLUMN include_relationship_tasks boolean DEFAULT true,
ADD COLUMN cold_contact_threshold_days integer DEFAULT 14,
ADD COLUMN relationship_tasks_count integer DEFAULT 2;