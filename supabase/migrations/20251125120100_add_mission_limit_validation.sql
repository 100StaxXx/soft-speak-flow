-- Add validation to prevent more than 5 missions per user per day
-- This is enforced in the trigger logic, but we add a check constraint for safety

-- Add a comment documenting the limit
COMMENT ON COLUMN daily_missions.is_bonus IS 'Marks a mission as bonus quest. Max 1 bonus per day. Total limit: 4 base + 1 bonus = 5 missions per day';

-- Create a function to validate mission count on insert
CREATE OR REPLACE FUNCTION public.validate_mission_count()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_mission_count INTEGER;
BEGIN
  -- Count existing missions for this user and date
  SELECT COUNT(*) INTO v_mission_count
  FROM daily_missions
  WHERE user_id = NEW.user_id
    AND mission_date = NEW.mission_date;
  
  -- Allow up to 5 missions total (4 base + 1 bonus)
  IF v_mission_count >= 5 THEN
    RAISE EXCEPTION 'MISSION_LIMIT_REACHED: Maximum 5 missions per day (4 base + 1 bonus)';
  END IF;
  
  -- If this is a bonus mission, ensure only one bonus exists
  IF NEW.is_bonus THEN
    DECLARE
      v_bonus_count INTEGER;
    BEGIN
      SELECT COUNT(*) INTO v_bonus_count
      FROM daily_missions
      WHERE user_id = NEW.user_id
        AND mission_date = NEW.mission_date
        AND is_bonus = true;
      
      IF v_bonus_count >= 1 THEN
        RAISE EXCEPTION 'BONUS_MISSION_EXISTS: Only one bonus mission allowed per day';
      END IF;
    END;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger to enforce mission limits
DROP TRIGGER IF EXISTS validate_mission_count_trigger ON daily_missions;
CREATE TRIGGER validate_mission_count_trigger
  BEFORE INSERT ON daily_missions
  FOR EACH ROW
  EXECUTE FUNCTION validate_mission_count();

COMMENT ON FUNCTION public.validate_mission_count IS 'Enforces mission limits: max 5 total per day (4 base + 1 bonus), max 1 bonus per day';
