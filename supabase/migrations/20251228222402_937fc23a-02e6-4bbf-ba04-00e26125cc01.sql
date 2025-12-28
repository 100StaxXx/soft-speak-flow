-- Add new columns to epic_milestones for deadline tracking
ALTER TABLE public.epic_milestones 
ADD COLUMN IF NOT EXISTS target_date DATE,
ADD COLUMN IF NOT EXISTS phase_name TEXT,
ADD COLUMN IF NOT EXISTS phase_order INTEGER DEFAULT 1,
ADD COLUMN IF NOT EXISTS is_postcard_milestone BOOLEAN DEFAULT false;

-- Create journey_phases table for structured phase planning
CREATE TABLE IF NOT EXISTS public.journey_phases (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  epic_id UUID NOT NULL REFERENCES public.epics(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  phase_order INTEGER NOT NULL DEFAULT 1,
  is_active BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS on journey_phases
ALTER TABLE public.journey_phases ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for journey_phases
CREATE POLICY "Users can view their own journey phases"
ON public.journey_phases
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own journey phases"
ON public.journey_phases
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own journey phases"
ON public.journey_phases
FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own journey phases"
ON public.journey_phases
FOR DELETE
USING (auth.uid() = user_id);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_journey_phases_epic_id ON public.journey_phases(epic_id);
CREATE INDEX IF NOT EXISTS idx_journey_phases_user_id ON public.journey_phases(user_id);
CREATE INDEX IF NOT EXISTS idx_epic_milestones_target_date ON public.epic_milestones(target_date);

-- Add trigger for updated_at
CREATE TRIGGER update_journey_phases_updated_at
BEFORE UPDATE ON public.journey_phases
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();