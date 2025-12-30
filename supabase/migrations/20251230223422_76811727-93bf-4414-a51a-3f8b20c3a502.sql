-- Drop the old constraint and add the correct one
ALTER TABLE public.focus_sessions DROP CONSTRAINT IF EXISTS focus_sessions_duration_type_check;

ALTER TABLE public.focus_sessions ADD CONSTRAINT focus_sessions_duration_type_check 
  CHECK (duration_type = ANY (ARRAY['pomodoro', 'short_break', 'long_break', 'custom']));