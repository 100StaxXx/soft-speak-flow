-- Add columns to daily_tasks for epic/habit linking
ALTER TABLE public.daily_tasks
ADD COLUMN IF NOT EXISTS epic_id UUID REFERENCES public.epics(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS habit_source_id UUID REFERENCES public.habits(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS is_milestone BOOLEAN DEFAULT false;

-- Create indexes for the new columns
CREATE INDEX IF NOT EXISTS idx_daily_tasks_epic_id ON public.daily_tasks(epic_id);
CREATE INDEX IF NOT EXISTS idx_daily_tasks_habit_source_id ON public.daily_tasks(habit_source_id);
CREATE INDEX IF NOT EXISTS idx_daily_tasks_is_milestone ON public.daily_tasks(is_milestone) WHERE is_milestone = true;

-- Create epic_milestones table
CREATE TABLE public.epic_milestones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  epic_id UUID NOT NULL REFERENCES public.epics(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  milestone_percent INTEGER NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  chapter_number INTEGER,
  is_surfaced BOOLEAN DEFAULT false,
  surfaced_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  task_id UUID REFERENCES public.daily_tasks(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(epic_id, milestone_percent)
);

-- Create indexes for epic_milestones
CREATE INDEX idx_epic_milestones_epic_id ON public.epic_milestones(epic_id);
CREATE INDEX idx_epic_milestones_user_id ON public.epic_milestones(user_id);
CREATE INDEX idx_epic_milestones_surfaced ON public.epic_milestones(is_surfaced) WHERE is_surfaced = false;

-- Enable RLS
ALTER TABLE public.epic_milestones ENABLE ROW LEVEL SECURITY;

-- RLS policies for epic_milestones
CREATE POLICY "Users can view their own milestones"
ON public.epic_milestones FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own milestones"
ON public.epic_milestones FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own milestones"
ON public.epic_milestones FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own milestones"
ON public.epic_milestones FOR DELETE
USING (auth.uid() = user_id);

-- Add trigger for updated_at
CREATE TRIGGER update_epic_milestones_updated_at
BEFORE UPDATE ON public.epic_milestones
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();