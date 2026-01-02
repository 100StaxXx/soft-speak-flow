-- Add sort_order column for task reordering
ALTER TABLE public.daily_tasks 
ADD COLUMN IF NOT EXISTS sort_order integer DEFAULT 0;

-- Create index for efficient ordering queries
CREATE INDEX IF NOT EXISTS idx_daily_tasks_sort_order ON public.daily_tasks(user_id, task_date, sort_order);