ALTER TABLE public.evening_reflections
  ADD COLUMN IF NOT EXISTS additional_reflection text,
  ADD COLUMN IF NOT EXISTS tomorrow_adjustment text;
