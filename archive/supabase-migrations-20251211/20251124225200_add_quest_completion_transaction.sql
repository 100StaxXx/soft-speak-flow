-- Transaction function for quest completion
-- Ensures atomicity: quest completion + XP award + evolution check happen together
CREATE OR REPLACE FUNCTION complete_quest_with_xp(
  p_task_id UUID,
  p_user_id UUID,
  p_xp_amount INT
) RETURNS JSON AS $$
DECLARE
  v_companion_id UUID;
  v_current_xp BIGINT;
  v_new_xp BIGINT;
  v_current_stage INT;
  v_should_evolve BOOLEAN;
  v_next_threshold BIGINT;
BEGIN
  -- 1. Mark quest as completed (atomic check)
  UPDATE daily_tasks
  SET 
    completed = true, 
    completed_at = NOW()
  WHERE id = p_task_id 
    AND user_id = p_user_id
    AND completed = false;
  
  IF NOT FOUND THEN
    RETURN json_build_object(
      'success', false, 
      'error', 'Quest already completed or not found'
    );
  END IF;
  
  -- 2. Update companion XP atomically
  UPDATE user_companion
  SET current_xp = current_xp + p_xp_amount
  WHERE user_id = p_user_id
  RETURNING id, current_xp, current_stage 
  INTO v_companion_id, v_new_xp, v_current_stage;
  
  IF NOT FOUND THEN
    -- Rollback will happen automatically
    RAISE EXCEPTION 'No companion found for user';
  END IF;
  
  -- 3. Check if evolution is needed
  SELECT should_evolve(v_current_stage, v_new_xp) INTO v_should_evolve;
  SELECT get_next_evolution_threshold(v_current_stage) INTO v_next_threshold;
  
  -- 4. Log XP event (optional, for analytics)
  INSERT INTO xp_events (user_id, companion_id, xp_amount, event_type, event_metadata)
  VALUES (
    p_user_id, 
    v_companion_id, 
    p_xp_amount, 
    'quest_complete',
    json_build_object('task_id', p_task_id)
  );
  
  -- 5. Return success with evolution status
  RETURN json_build_object(
    'success', true,
    'companion_id', v_companion_id,
    'new_xp', v_new_xp,
    'current_stage', v_current_stage,
    'should_evolve', v_should_evolve,
    'next_threshold', v_next_threshold
  );
  
EXCEPTION
  WHEN OTHERS THEN
    -- All changes rolled back automatically
    RETURN json_build_object(
      'success', false,
      'error', SQLERRM
    );
END;
$$ LANGUAGE plpgsql;

-- Create xp_events table if it doesn't exist
CREATE TABLE IF NOT EXISTS xp_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  companion_id UUID REFERENCES user_companion(id) ON DELETE CASCADE,
  xp_amount INT NOT NULL,
  event_type TEXT NOT NULL,
  event_metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE xp_events ENABLE ROW LEVEL SECURITY;

-- Users can only see their own XP events
CREATE POLICY "Users can view own XP events"
  ON xp_events
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_xp_events_user_created 
  ON xp_events(user_id, created_at DESC);

COMMENT ON FUNCTION complete_quest_with_xp IS 'Atomically complete quest, award XP, and check for evolution';
COMMENT ON TABLE xp_events IS 'Audit log of all XP awards';
