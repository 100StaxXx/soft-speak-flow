-- ============================================
-- BONUS QUEST SYSTEM IMPLEMENTATION
-- ============================================
-- Unlocks a 5th "Bonus Quest" slot if:
--   1. User completes all 4 base quests that day, OR
--   2. User is on a 7+ day streak

-- Function to check and create bonus mission
CREATE OR REPLACE FUNCTION public.check_and_create_bonus_mission()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_completed_count INTEGER;
  v_user_streak INTEGER;
  v_bonus_exists BOOLEAN;
  v_mission_date DATE;
  v_total_missions INTEGER;
BEGIN
  -- Only proceed if this is a completion (not uncompleting)
  IF NOT NEW.completed OR OLD.completed THEN
    RETURN NEW;
  END IF;
  
  v_mission_date := NEW.mission_date;
  
  -- Count completed non-bonus missions for that day
  SELECT COUNT(*) INTO v_completed_count
  FROM daily_missions
  WHERE user_id = NEW.user_id
    AND mission_date = v_mission_date
    AND completed = true
    AND is_bonus = false;
  
  -- Check if bonus already exists for that day
  SELECT EXISTS(
    SELECT 1 FROM daily_missions
    WHERE user_id = NEW.user_id
      AND mission_date = v_mission_date
      AND is_bonus = true
  ) INTO v_bonus_exists;
  
  -- Get total missions count to prevent creating too many
  SELECT COUNT(*) INTO v_total_missions
  FROM daily_missions
  WHERE user_id = NEW.user_id
    AND mission_date = v_mission_date;
  
  -- Get user's current streak
  SELECT COALESCE(current_habit_streak, 0) INTO v_user_streak
  FROM profiles
  WHERE id = NEW.user_id;
  
  -- Create bonus mission if conditions are met
  -- Condition 1: All 4 base quests completed
  -- Condition 2: User has 7+ day streak
  IF NOT v_bonus_exists 
     AND v_total_missions < 5 
     AND (v_completed_count >= 4 OR v_user_streak >= 7) THEN
    
    -- Determine bonus mission details based on unlock reason
    DECLARE
      v_bonus_text TEXT;
      v_bonus_xp INTEGER;
    BEGIN
      IF v_completed_count >= 4 AND v_user_streak >= 7 THEN
        v_bonus_text := 'Ultimate Challenge: You''re unstoppable today! 🔥';
        v_bonus_xp := 25;
      ELSIF v_completed_count >= 4 THEN
        v_bonus_text := 'Bonus Challenge: Keep the momentum going! 🎯';
        v_bonus_xp := 20;
      ELSE
        v_bonus_text := 'Streak Bonus: Your dedication has unlocked extra rewards! ⚡';
        v_bonus_xp := 20;
      END IF;
      
      INSERT INTO daily_missions (
        user_id,
        mission_date,
        mission_text,
        mission_type,
        category,
        xp_reward,
        difficulty,
        auto_complete,
        completed,
        progress_target,
        progress_current,
        is_bonus
      ) VALUES (
        NEW.user_id,
        v_mission_date,
        v_bonus_text,
        'bonus_challenge',
        'growth',
        v_bonus_xp,
        'medium',
        false,
        false,
        1,
        0,
        true
      );
      
      -- Log the unlock event
      INSERT INTO activity_feed (user_id, activity_type, activity_data)
      VALUES (
        NEW.user_id,
        'bonus_quest_unlocked',
        json_build_object(
          'date', v_mission_date,
          'unlock_reason', CASE 
            WHEN v_completed_count >= 4 THEN 'all_quests_complete'
            ELSE 'streak_milestone'
          END,
          'streak', v_user_streak
        )
      );
    END;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger on mission completion
DROP TRIGGER IF EXISTS check_bonus_mission_unlock ON daily_missions;
CREATE TRIGGER check_bonus_mission_unlock
  AFTER UPDATE OF completed ON daily_missions
  FOR EACH ROW
  WHEN (NEW.completed = true AND OLD.completed = false)
  EXECUTE FUNCTION check_and_create_bonus_mission();

-- Function to check and unlock bonus on user login (for 7+ day streak)
-- This ensures users with existing streaks get their bonus quest
CREATE OR REPLACE FUNCTION public.check_streak_bonus_on_login(p_user_id uuid, p_date date)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_streak INTEGER;
  v_bonus_exists BOOLEAN;
  v_total_missions INTEGER;
  v_result json;
BEGIN
  -- Get user's current streak
  SELECT COALESCE(current_habit_streak, 0) INTO v_user_streak
  FROM profiles
  WHERE id = p_user_id;
  
  -- Check if bonus already exists for that day
  SELECT EXISTS(
    SELECT 1 FROM daily_missions
    WHERE user_id = p_user_id
      AND mission_date = p_date
      AND is_bonus = true
  ) INTO v_bonus_exists;
  
  -- Get total missions count
  SELECT COUNT(*) INTO v_total_missions
  FROM daily_missions
  WHERE user_id = p_user_id
    AND mission_date = p_date;
  
  -- Create bonus if user has 7+ streak and no bonus exists yet
  IF NOT v_bonus_exists 
     AND v_total_missions < 5 
     AND v_user_streak >= 7 
     AND v_total_missions > 0 THEN -- Only if they have base missions
    
    INSERT INTO daily_missions (
      user_id,
      mission_date,
      mission_text,
      mission_type,
      category,
      xp_reward,
      difficulty,
      auto_complete,
      completed,
      progress_target,
      progress_current,
      is_bonus
    ) VALUES (
      p_user_id,
      p_date,
      'Streak Bonus: Your dedication has unlocked extra rewards! ⚡',
      'bonus_challenge',
      'growth',
      20,
      'medium',
      false,
      false,
      1,
      0,
      true
    );
    
    v_result := json_build_object(
      'bonus_created', true,
      'reason', 'streak_milestone',
      'streak', v_user_streak
    );
  ELSE
    v_result := json_build_object(
      'bonus_created', false,
      'reason', 'not_eligible',
      'streak', v_user_streak,
      'bonus_exists', v_bonus_exists
    );
  END IF;
  
  RETURN v_result;
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.check_streak_bonus_on_login(uuid, date) TO authenticated;

-- Add constraint to prevent more than 5 missions per day per user
-- Note: This is a soft constraint checked in the trigger, not a hard DB constraint
-- to avoid breaking existing data or edge cases

COMMENT ON FUNCTION public.check_and_create_bonus_mission IS 'Automatically creates a bonus quest when user completes 4 quests or has 7+ day streak';
COMMENT ON FUNCTION public.check_streak_bonus_on_login IS 'Check and create streak bonus quest when user logs in with 7+ day streak';
