-- Create companion_postcards table for storing cosmic journey snapshots
CREATE TABLE public.companion_postcards (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  companion_id UUID NOT NULL REFERENCES public.user_companion(id) ON DELETE CASCADE,
  epic_id UUID REFERENCES public.epics(id) ON DELETE SET NULL,
  milestone_percent INTEGER NOT NULL CHECK (milestone_percent IN (25, 50, 75, 100)),
  location_name TEXT NOT NULL,
  location_description TEXT NOT NULL,
  image_url TEXT NOT NULL,
  caption TEXT,
  generated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.companion_postcards ENABLE ROW LEVEL SECURITY;

-- Users can view their own postcards
CREATE POLICY "Users can view own postcards"
ON public.companion_postcards
FOR SELECT
USING (auth.uid() = user_id);

-- Users can insert their own postcards
CREATE POLICY "Users can insert own postcards"
ON public.companion_postcards
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Create index for efficient queries
CREATE INDEX idx_companion_postcards_user_id ON public.companion_postcards(user_id);
CREATE INDEX idx_companion_postcards_epic_id ON public.companion_postcards(epic_id);

-- Create unique constraint to prevent duplicate postcards per epic milestone
CREATE UNIQUE INDEX idx_unique_postcard_per_milestone 
ON public.companion_postcards(user_id, epic_id, milestone_percent);