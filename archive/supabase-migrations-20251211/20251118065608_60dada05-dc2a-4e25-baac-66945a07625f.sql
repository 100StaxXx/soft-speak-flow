-- Function to update companion resilience based on streak milestones
CREATE OR REPLACE FUNCTION public.update_companion_resilience_on_streak()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_companion_id uuid;
  v_resilience_gain integer;
  v_current_resilience integer;
  v_new_resilience integer;
BEGIN
  -- Only process on UPDATE when current_habit_streak changes
  IF TG_OP = 'UPDATE' AND (NEW.current_habit_streak IS DISTINCT FROM OLD.current_habit_streak) THEN
    -- Get companion for this user
    SELECT id, resilience INTO v_companion_id, v_current_resilience
    FROM user_companion
    WHERE user_id = NEW.id;
    
    -- Skip if no companion
    IF v_companion_id IS NULL THEN
      RETURN NEW;
    END IF;
    
    -- Determine resilience gain based on streak milestone
    v_resilience_gain := 0;
    IF NEW.current_habit_streak = 7 THEN
      v_resilience_gain := 5;
    ELSIF NEW.current_habit_streak = 14 THEN
      v_resilience_gain := 10;
    ELSIF NEW.current_habit_streak = 30 THEN
      v_resilience_gain := 15;
    ELSIF NEW.current_habit_streak % 7 = 0 AND NEW.current_habit_streak > 30 THEN
      -- Small bonus every week after 30 days
      v_resilience_gain := 2;
    END IF;
    
    -- Update companion resilience if there's a gain
    IF v_resilience_gain > 0 THEN
      v_new_resilience := LEAST(100, COALESCE(v_current_resilience, 0) + v_resilience_gain);
      
      UPDATE user_companion
      SET resilience = v_new_resilience,
          updated_at = now()
      WHERE id = v_companion_id;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger on profiles table for streak updates
DROP TRIGGER IF EXISTS on_profile_streak_update ON profiles;
CREATE TRIGGER on_profile_streak_update
  AFTER UPDATE ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_companion_resilience_on_streak();