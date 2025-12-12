-- Create Epics table (gamified long-term goals)
CREATE TABLE IF NOT EXISTS public.epics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  target_days INTEGER NOT NULL DEFAULT 30,
  start_date DATE NOT NULL DEFAULT CURRENT_DATE,
  end_date DATE, -- Calculated from start_date + target_days
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'abandoned')),
  xp_reward INTEGER NOT NULL DEFAULT 100, -- Bonus XP for completing the epic
  progress_percentage INTEGER DEFAULT 0 CHECK (progress_percentage >= 0 AND progress_percentage <= 100),
  completed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create junction table linking habits to epics (many-to-many)
CREATE TABLE IF NOT EXISTS public.epic_habits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  epic_id UUID NOT NULL REFERENCES public.epics(id) ON DELETE CASCADE,
  habit_id UUID NOT NULL REFERENCES public.habits(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(epic_id, habit_id) -- Prevent duplicate links
);

-- Create epic_progress_log to track daily epic progress
CREATE TABLE IF NOT EXISTS public.epic_progress_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  epic_id UUID NOT NULL REFERENCES public.epics(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  habits_completed INTEGER DEFAULT 0,
  habits_total INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(epic_id, date) -- One entry per epic per day
);

-- Enable RLS
ALTER TABLE public.epics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.epic_habits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.epic_progress_log ENABLE ROW LEVEL SECURITY;

-- RLS Policies for epics
CREATE POLICY "Users can view own epics"
  ON public.epics FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own epics"
  ON public.epics FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own epics"
  ON public.epics FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own epics"
  ON public.epics FOR DELETE
  USING (auth.uid() = user_id);

-- RLS Policies for epic_habits
CREATE POLICY "Users can view own epic habits"
  ON public.epic_habits FOR SELECT
  USING (epic_id IN (SELECT id FROM public.epics WHERE user_id = auth.uid()));

CREATE POLICY "Users can insert own epic habits"
  ON public.epic_habits FOR INSERT
  WITH CHECK (epic_id IN (SELECT id FROM public.epics WHERE user_id = auth.uid()));

CREATE POLICY "Users can delete own epic habits"
  ON public.epic_habits FOR DELETE
  USING (epic_id IN (SELECT id FROM public.epics WHERE user_id = auth.uid()));

-- RLS Policies for epic_progress_log
CREATE POLICY "Users can view own epic progress"
  ON public.epic_progress_log FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own epic progress"
  ON public.epic_progress_log FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own epic progress"
  ON public.epic_progress_log FOR UPDATE
  USING (auth.uid() = user_id);

-- Function to calculate end_date from start_date + target_days
CREATE OR REPLACE FUNCTION public.calculate_epic_end_date()
RETURNS TRIGGER AS $$
BEGIN
  NEW.end_date := NEW.start_date + (NEW.target_days || ' days')::INTERVAL;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public';

-- Trigger to auto-calculate end_date
CREATE TRIGGER set_epic_end_date
  BEFORE INSERT OR UPDATE ON public.epics
  FOR EACH ROW
  EXECUTE FUNCTION public.calculate_epic_end_date();

-- Function to update epic progress when habits are completed
CREATE OR REPLACE FUNCTION public.update_epic_progress()
RETURNS TRIGGER AS $$
DECLARE
  epic_record RECORD;
  total_habits INTEGER;
  completed_today INTEGER;
  days_completed INTEGER;
  new_progress INTEGER;
BEGIN
  -- Only process on habit completion
  IF NEW.completed = true AND (OLD IS NULL OR OLD.completed = false) THEN
    -- Find all epics this habit belongs to
    FOR epic_record IN 
      SELECT e.id, e.user_id, e.target_days, e.start_date, e.end_date
      FROM public.epics e
      INNER JOIN public.epic_habits eh ON eh.epic_id = e.id
      WHERE eh.habit_id = NEW.habit_id
        AND e.status = 'active'
        AND e.user_id = NEW.user_id
    LOOP
      -- Count total habits linked to this epic
      SELECT COUNT(*) INTO total_habits
      FROM public.epic_habits
      WHERE epic_id = epic_record.id;
      
      -- Count completed habits for this epic today
      SELECT COUNT(DISTINCT hc.habit_id) INTO completed_today
      FROM public.habit_completions hc
      INNER JOIN public.epic_habits eh ON eh.habit_id = hc.habit_id
      WHERE eh.epic_id = epic_record.id
        AND hc.date = CURRENT_DATE
        AND hc.user_id = epic_record.user_id;
      
      -- Upsert daily progress log
      INSERT INTO public.epic_progress_log (epic_id, user_id, date, habits_completed, habits_total)
      VALUES (epic_record.id, epic_record.user_id, CURRENT_DATE, completed_today, total_habits)
      ON CONFLICT (epic_id, date)
      DO UPDATE SET
        habits_completed = completed_today,
        habits_total = total_habits;
      
      -- Calculate overall epic progress (days with at least 1 habit completed / target days)
      SELECT COUNT(DISTINCT date) INTO days_completed
      FROM public.epic_progress_log
      WHERE epic_id = epic_record.id
        AND habits_completed > 0
        AND date >= epic_record.start_date
        AND date <= epic_record.end_date;
      
      new_progress := LEAST(100, (days_completed * 100) / epic_record.target_days);
      
      -- Update epic progress
      UPDATE public.epics
      SET 
        progress_percentage = new_progress,
        status = CASE 
          WHEN new_progress >= 100 THEN 'completed'
          ELSE 'active'
        END,
        completed_at = CASE 
          WHEN new_progress >= 100 AND completed_at IS NULL THEN now()
          ELSE completed_at
        END,
        updated_at = now()
      WHERE id = epic_record.id;
    END LOOP;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public';

-- Trigger on habit_completions to update epic progress
CREATE TRIGGER update_epic_progress_on_habit_completion
  AFTER INSERT OR UPDATE ON public.habit_completions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_epic_progress();

-- Trigger to update updated_at timestamp
CREATE TRIGGER update_epics_updated_at
  BEFORE UPDATE ON public.epics
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();