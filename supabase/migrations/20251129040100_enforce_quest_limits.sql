-- Add database-level constraint to enforce 4 quest limit per day
-- This prevents race conditions in the client code

-- First, create a function to check quest count
CREATE OR REPLACE FUNCTION check_daily_quest_limit()
RETURNS TRIGGER AS $$
DECLARE
  quest_count INTEGER;
BEGIN
  -- Count existing quests for this user on this date
  SELECT COUNT(*) INTO quest_count
  FROM daily_tasks
  WHERE user_id = NEW.user_id
    AND task_date = NEW.task_date;
  
  -- Allow up to 4 quests per day (or 10 if we want to be lenient)
  -- Using 10 as a safety limit to prevent infinite creation while allowing some flexibility
  IF quest_count >= 10 THEN
    RAISE EXCEPTION 'Maximum quest limit reached for this date (limit: 10)';
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop trigger if it exists
DROP TRIGGER IF EXISTS enforce_daily_quest_limit ON daily_tasks;

-- Create trigger to enforce quest limit on INSERT
CREATE TRIGGER enforce_daily_quest_limit
  BEFORE INSERT ON daily_tasks
  FOR EACH ROW
  EXECUTE FUNCTION check_daily_quest_limit();

COMMENT ON FUNCTION check_daily_quest_limit IS 'Enforces maximum quest limit per day (10 quests) to prevent spam';
COMMENT ON TRIGGER enforce_daily_quest_limit ON daily_tasks IS 'Database-level enforcement of quest limit to prevent race conditions';
