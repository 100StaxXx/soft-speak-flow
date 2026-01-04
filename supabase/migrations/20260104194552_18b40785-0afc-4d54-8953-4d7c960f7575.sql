-- Add learning columns to user_ai_learning for organic work style inference
ALTER TABLE user_ai_learning 
ADD COLUMN IF NOT EXISTS inferred_work_style text,
ADD COLUMN IF NOT EXISTS work_style_confidence numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS scheduling_patterns jsonb DEFAULT '{}'::jsonb,
ADD COLUMN IF NOT EXISTS task_completion_times jsonb DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS day_of_week_patterns jsonb DEFAULT '{}'::jsonb;

-- Add comment explaining the columns
COMMENT ON COLUMN user_ai_learning.inferred_work_style IS 'Auto-inferred: traditional, entrepreneur, hybrid, or flexible';
COMMENT ON COLUMN user_ai_learning.scheduling_patterns IS 'Learned patterns: avgCompletionHour, commonStartTimes, lunchBreakPattern, etc';
COMMENT ON COLUMN user_ai_learning.task_completion_times IS 'Recent task completion timestamps for pattern analysis';
COMMENT ON COLUMN user_ai_learning.day_of_week_patterns IS 'Per-day productivity patterns';