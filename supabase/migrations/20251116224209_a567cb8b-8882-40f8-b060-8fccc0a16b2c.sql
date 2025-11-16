-- Drop and recreate view without SECURITY DEFINER
DROP VIEW IF EXISTS public.user_achievement_stats;

CREATE OR REPLACE VIEW public.user_achievement_stats 
WITH (security_invoker = true) AS
SELECT 
  user_id,
  COUNT(*) as total_achievements,
  COUNT(*) FILTER (WHERE tier = 'bronze') as bronze_count,
  COUNT(*) FILTER (WHERE tier = 'silver') as silver_count,
  COUNT(*) FILTER (WHERE tier = 'gold') as gold_count,
  COUNT(*) FILTER (WHERE tier = 'platinum') as platinum_count
FROM public.achievements
GROUP BY user_id;