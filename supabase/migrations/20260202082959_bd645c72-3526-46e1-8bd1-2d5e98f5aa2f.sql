-- First, clean up existing duplicate habit tasks (keep earliest)
DELETE FROM daily_tasks 
WHERE id IN (
  SELECT id FROM (
    SELECT id, ROW_NUMBER() OVER (
      PARTITION BY user_id, task_date, habit_source_id 
      ORDER BY created_at ASC
    ) as rn
    FROM daily_tasks 
    WHERE habit_source_id IS NOT NULL
  ) dupes 
  WHERE rn > 1
);

-- Add unique constraint to prevent future duplicates for habit-sourced tasks
CREATE UNIQUE INDEX idx_daily_tasks_habit_date_unique 
ON daily_tasks (user_id, task_date, habit_source_id) 
WHERE habit_source_id IS NOT NULL;

-- Also add unique constraint for recurring task templates
CREATE UNIQUE INDEX idx_daily_tasks_template_date_unique 
ON daily_tasks (user_id, task_date, parent_template_id) 
WHERE parent_template_id IS NOT NULL;