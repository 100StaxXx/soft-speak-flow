-- More robust deduplication: keep only the first mission per user/date/category
WITH ranked AS (
  SELECT id, 
         ROW_NUMBER() OVER (PARTITION BY user_id, mission_date, category ORDER BY created_at ASC) as rn
  FROM daily_missions
)
DELETE FROM daily_missions 
WHERE id IN (SELECT id FROM ranked WHERE rn > 1);

-- Now add unique constraint
CREATE UNIQUE INDEX idx_daily_missions_unique_per_day 
ON daily_missions(user_id, mission_date, category);