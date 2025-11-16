-- Create achievements table
CREATE TABLE IF NOT EXISTS public.achievements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  achievement_type TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  icon TEXT NOT NULL,
  tier TEXT NOT NULL DEFAULT 'bronze',
  earned_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Add RLS policies
ALTER TABLE public.achievements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own achievements"
  ON public.achievements FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own achievements"
  ON public.achievements FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Create index for performance
CREATE INDEX idx_achievements_user_id ON public.achievements(user_id);
CREATE INDEX idx_achievements_type ON public.achievements(achievement_type);

-- Create view for achievement stats
CREATE OR REPLACE VIEW public.user_achievement_stats AS
SELECT 
  user_id,
  COUNT(*) as total_achievements,
  COUNT(*) FILTER (WHERE tier = 'bronze') as bronze_count,
  COUNT(*) FILTER (WHERE tier = 'silver') as silver_count,
  COUNT(*) FILTER (WHERE tier = 'gold') as gold_count,
  COUNT(*) FILTER (WHERE tier = 'platinum') as platinum_count
FROM public.achievements
GROUP BY user_id;