-- Allow monthly cadence for habits created by Pathfinder and ritual editors.
ALTER TABLE public.habits
  DROP CONSTRAINT IF EXISTS habits_frequency_check;

ALTER TABLE public.habits
  ADD CONSTRAINT habits_frequency_check
  CHECK (frequency IN ('daily', '5x_week', '3x_week', 'custom', 'monthly'));
