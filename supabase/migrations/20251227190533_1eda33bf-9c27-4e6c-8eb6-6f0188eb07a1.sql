-- =============================================
-- PHASE 1: Ultimate Task Manager Database Schema
-- =============================================

-- 1. Create task_contexts table (needed first for foreign key)
CREATE TABLE public.task_contexts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  icon TEXT DEFAULT '📍',
  color TEXT DEFAULT 'blue',
  is_default BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.task_contexts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own contexts" ON public.task_contexts FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create their own contexts" ON public.task_contexts FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own contexts" ON public.task_contexts FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own contexts" ON public.task_contexts FOR DELETE USING (auth.uid() = user_id);

-- 2. Alter daily_tasks with new columns
ALTER TABLE public.daily_tasks 
  ADD COLUMN IF NOT EXISTS priority TEXT CHECK (priority IN ('urgent-important', 'not-urgent-important', 'urgent-not-important', 'not-urgent-not-important')),
  ADD COLUMN IF NOT EXISTS energy_level TEXT DEFAULT 'medium' CHECK (energy_level IN ('low', 'medium', 'high')),
  ADD COLUMN IF NOT EXISTS is_top_three BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS actual_time_spent INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS ai_generated BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'manual' CHECK (source IN ('manual', 'voice', 'nlp', 'inbox', 'recurring')),
  ADD COLUMN IF NOT EXISTS context_id UUID REFERENCES public.task_contexts(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_daily_tasks_priority ON public.daily_tasks(priority);
CREATE INDEX IF NOT EXISTS idx_daily_tasks_energy_level ON public.daily_tasks(energy_level);
CREATE INDEX IF NOT EXISTS idx_daily_tasks_is_top_three ON public.daily_tasks(is_top_three) WHERE is_top_three = true;
CREATE INDEX IF NOT EXISTS idx_daily_tasks_context ON public.daily_tasks(context_id);

-- 3. Create subtasks table
CREATE TABLE public.subtasks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  task_id UUID NOT NULL REFERENCES public.daily_tasks(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  title TEXT NOT NULL,
  completed BOOLEAN DEFAULT false,
  completed_at TIMESTAMP WITH TIME ZONE,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.subtasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own subtasks" ON public.subtasks FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create their own subtasks" ON public.subtasks FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own subtasks" ON public.subtasks FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own subtasks" ON public.subtasks FOR DELETE USING (auth.uid() = user_id);

CREATE INDEX idx_subtasks_task ON public.subtasks(task_id);
CREATE INDEX idx_subtasks_user ON public.subtasks(user_id);

-- 4. Create task_dependencies table
CREATE TABLE public.task_dependencies (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  task_id UUID NOT NULL REFERENCES public.daily_tasks(id) ON DELETE CASCADE,
  depends_on_task_id UUID NOT NULL REFERENCES public.daily_tasks(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(task_id, depends_on_task_id),
  CHECK (task_id != depends_on_task_id)
);

ALTER TABLE public.task_dependencies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own dependencies" ON public.task_dependencies FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create their own dependencies" ON public.task_dependencies FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete their own dependencies" ON public.task_dependencies FOR DELETE USING (auth.uid() = user_id);

CREATE INDEX idx_task_dependencies_task ON public.task_dependencies(task_id);
CREATE INDEX idx_task_dependencies_depends_on ON public.task_dependencies(depends_on_task_id);

-- 5. Create task_inbox table
CREATE TABLE public.task_inbox (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  raw_text TEXT NOT NULL,
  parsed_data JSONB,
  source TEXT DEFAULT 'manual' CHECK (source IN ('manual', 'voice', 'share', 'widget')),
  processed BOOLEAN DEFAULT false,
  processed_at TIMESTAMP WITH TIME ZONE,
  created_task_id UUID REFERENCES public.daily_tasks(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.task_inbox ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own inbox" ON public.task_inbox FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create inbox items" ON public.task_inbox FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own inbox" ON public.task_inbox FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own inbox" ON public.task_inbox FOR DELETE USING (auth.uid() = user_id);

CREATE INDEX idx_task_inbox_user ON public.task_inbox(user_id);
CREATE INDEX idx_task_inbox_processed ON public.task_inbox(processed) WHERE processed = false;

-- 6. Create focus_sessions table
CREATE TABLE public.focus_sessions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  task_id UUID REFERENCES public.daily_tasks(id) ON DELETE SET NULL,
  duration_type TEXT NOT NULL CHECK (duration_type IN ('quick', 'standard', 'deep')),
  planned_duration INTEGER NOT NULL,
  actual_duration INTEGER DEFAULT 0,
  started_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  completed_at TIMESTAMP WITH TIME ZONE,
  paused_at TIMESTAMP WITH TIME ZONE,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'paused', 'completed', 'abandoned')),
  xp_earned INTEGER DEFAULT 0,
  distractions_count INTEGER DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.focus_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own focus sessions" ON public.focus_sessions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create their own focus sessions" ON public.focus_sessions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own focus sessions" ON public.focus_sessions FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own focus sessions" ON public.focus_sessions FOR DELETE USING (auth.uid() = user_id);

CREATE INDEX idx_focus_sessions_user ON public.focus_sessions(user_id);
CREATE INDEX idx_focus_sessions_task ON public.focus_sessions(task_id);
CREATE INDEX idx_focus_sessions_status ON public.focus_sessions(status);
CREATE INDEX idx_focus_sessions_date ON public.focus_sessions(started_at);

-- 7. Create productivity_stats table (daily aggregated stats)
CREATE TABLE public.productivity_stats (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  stat_date DATE NOT NULL DEFAULT CURRENT_DATE,
  tasks_completed INTEGER DEFAULT 0,
  tasks_created INTEGER DEFAULT 0,
  subtasks_completed INTEGER DEFAULT 0,
  focus_sessions_completed INTEGER DEFAULT 0,
  total_focus_minutes INTEGER DEFAULT 0,
  top_three_completed INTEGER DEFAULT 0,
  streak_maintained BOOLEAN DEFAULT false,
  productivity_score INTEGER DEFAULT 0,
  peak_hour INTEGER,
  most_productive_context UUID REFERENCES public.task_contexts(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, stat_date)
);

ALTER TABLE public.productivity_stats ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own stats" ON public.productivity_stats FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create their own stats" ON public.productivity_stats FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own stats" ON public.productivity_stats FOR UPDATE USING (auth.uid() = user_id);

CREATE INDEX idx_productivity_stats_user ON public.productivity_stats(user_id);
CREATE INDEX idx_productivity_stats_date ON public.productivity_stats(stat_date);

-- 8. Create trigger to update productivity_stats.updated_at
CREATE OR REPLACE FUNCTION public.update_productivity_stats_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_productivity_stats_updated_at
  BEFORE UPDATE ON public.productivity_stats
  FOR EACH ROW
  EXECUTE FUNCTION public.update_productivity_stats_updated_at();