-- Add database-level constraint to enforce 2 active habit limit
-- This prevents race conditions in the client code

-- First, create a function to check active habit count
CREATE OR REPLACE FUNCTION check_active_habit_limit()
RETURNS TRIGGER AS $$
DECLARE
  active_habit_count INTEGER;
BEGIN
  -- Only check on INSERT or when activating a habit
  IF (TG_OP = 'INSERT' AND COALESCE(NEW.is_active, true)) OR 
     (TG_OP = 'UPDATE' AND NEW.is_active AND NOT OLD.is_active) THEN
    
    -- Count existing active habits for this user
    SELECT COUNT(*) INTO active_habit_count
    FROM habits
    WHERE user_id = NEW.user_id
      AND is_active = true
      AND id != COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid);
    
    -- Enforce 2 active habit limit
    IF active_habit_count >= 2 THEN
      RAISE EXCEPTION 'Maximum active habit limit reached (limit: 2)';
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop trigger if it exists
DROP TRIGGER IF EXISTS enforce_active_habit_limit ON habits;

-- Create trigger to enforce habit limit on INSERT and UPDATE
CREATE TRIGGER enforce_active_habit_limit
  BEFORE INSERT OR UPDATE ON habits
  FOR EACH ROW
  EXECUTE FUNCTION check_active_habit_limit();

COMMENT ON FUNCTION check_active_habit_limit IS 'Enforces maximum 2 active habits per user';
COMMENT ON TRIGGER enforce_active_habit_limit ON habits IS 'Database-level enforcement of habit limit to prevent race conditions';
