-- Create contact_interactions table
CREATE TABLE public.contact_interactions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  contact_id UUID NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  interaction_type TEXT NOT NULL CHECK (interaction_type IN ('call', 'email', 'meeting', 'message', 'note')),
  summary TEXT NOT NULL,
  notes TEXT,
  occurred_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.contact_interactions ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view their own interactions"
ON public.contact_interactions
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own interactions"
ON public.contact_interactions
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own interactions"
ON public.contact_interactions
FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own interactions"
ON public.contact_interactions
FOR DELETE
USING (auth.uid() = user_id);

-- Index for faster lookups
CREATE INDEX idx_contact_interactions_contact_id ON public.contact_interactions(contact_id);
CREATE INDEX idx_contact_interactions_user_id ON public.contact_interactions(user_id);
CREATE INDEX idx_contact_interactions_occurred_at ON public.contact_interactions(occurred_at DESC);