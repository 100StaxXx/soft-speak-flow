CREATE TABLE IF NOT EXISTS public.achievements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  achievement_type TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  icon TEXT NOT NULL,
  tier TEXT NOT NULL DEFAULT 'bronze',
  metadata JSONB DEFAULT '{}'::jsonb,
  earned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now()
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'achievements_user_achievement_unique'
      AND conrelid = 'public.achievements'::regclass
  ) THEN
    ALTER TABLE public.achievements
      ADD CONSTRAINT achievements_user_achievement_unique
      UNIQUE (user_id, achievement_type);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_achievements_user_id
  ON public.achievements(user_id);

ALTER TABLE public.achievements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own achievements" ON public.achievements;
DROP POLICY IF EXISTS "Users can insert own achievements" ON public.achievements;
DROP POLICY IF EXISTS "Users can update own achievements" ON public.achievements;
DROP POLICY IF EXISTS "Users can delete own achievements" ON public.achievements;

CREATE POLICY "Users can view own achievements"
  ON public.achievements
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own achievements"
  ON public.achievements
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own achievements"
  ON public.achievements
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own achievements"
  ON public.achievements
  FOR DELETE
  USING (auth.uid() = user_id);
