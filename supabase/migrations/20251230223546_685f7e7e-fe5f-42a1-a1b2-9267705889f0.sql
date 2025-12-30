-- Update status constraint to include 'cancelled' (matching the code)
ALTER TABLE public.focus_sessions DROP CONSTRAINT IF EXISTS focus_sessions_status_check;

ALTER TABLE public.focus_sessions ADD CONSTRAINT focus_sessions_status_check 
  CHECK (status = ANY (ARRAY['active', 'paused', 'completed', 'cancelled', 'abandoned']));