CREATE TABLE IF NOT EXISTS public.user_reflections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  mood text NOT NULL,
  note text,
  ai_reply text,
  reflection_date date NOT NULL DEFAULT CURRENT_DATE,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.user_reflections ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own reflections" ON public.user_reflections;
CREATE POLICY "Users can view own reflections"
ON public.user_reflections
FOR SELECT
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own reflections" ON public.user_reflections;
CREATE POLICY "Users can insert own reflections"
ON public.user_reflections
FOR INSERT
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own reflections" ON public.user_reflections;
CREATE POLICY "Users can update own reflections"
ON public.user_reflections
FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own reflections" ON public.user_reflections;
CREATE POLICY "Users can delete own reflections"
ON public.user_reflections
FOR DELETE
USING (auth.uid() = user_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_user_reflections_user_date
ON public.user_reflections(user_id, reflection_date);

CREATE INDEX IF NOT EXISTS idx_user_reflections_user_created
ON public.user_reflections(user_id, created_at DESC);

NOTIFY pgrst, 'reload schema';
