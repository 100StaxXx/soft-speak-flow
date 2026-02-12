-- ============================================
-- CRITICAL FIX: Transaction Atomicity Issues
-- ============================================
-- Fixes Bugs #14-18 by making all referral operations atomic

-- Fix Bug #14 & #16 & #17: Single atomic function for referral completion
-- This prevents race conditions and ensures all-or-nothing behavior
CREATE OR REPLACE FUNCTION complete_referral_stage3(
  p_referee_id UUID,
  p_referrer_id UUID
) RETURNS JSONB AS $$
DECLARE
  v_new_count INTEGER;
  v_skin_id UUID;
  v_skin_unlocked BOOLEAN := false;
BEGIN
  -- All operations in single transaction (implicit in function)
  -- Either ALL succeed or ALL rollback
  
  -- Validate inputs (Bug #26 fix)
  IF p_referee_id IS NULL OR p_referrer_id IS NULL THEN
    RAISE EXCEPTION 'referee_id and referrer_id cannot be NULL';
  END IF;
  
  IF p_referee_id = p_referrer_id THEN
    RAISE EXCEPTION 'Cannot refer yourself';
  END IF;
  
  -- Step 1: Check if already completed (with row lock to prevent race)
  -- FIX Bug #22: Use WAIT instead of NOWAIT to allow retries
  SET LOCAL lock_timeout = '5s';
  
  PERFORM 1 FROM referral_completions
  WHERE referee_id = p_referee_id 
    AND referrer_id = p_referrer_id
  FOR UPDATE; -- Wait up to 5 seconds for lock
  
  IF FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'reason', 'already_completed',
      'message', 'This referral has already been counted'
    );
  END IF;
  
  -- Step 2: Insert completion record FIRST (acts as lock)
  -- This prevents any other transaction from proceeding
  INSERT INTO referral_completions (referee_id, referrer_id, stage_reached)
  VALUES (p_referee_id, p_referrer_id, 3);
  
  -- Step 3: Atomically increment referral count
  UPDATE profiles
  SET referral_count = COALESCE(referral_count, 0) + 1
  WHERE id = p_referrer_id
  RETURNING referral_count INTO v_new_count;
  
  -- Verify referrer exists
  IF v_new_count IS NULL THEN
    RAISE EXCEPTION 'Referrer profile not found: %', p_referrer_id;
  END IF;
  
  -- Step 4: Check for milestone and unlock skin (if applicable)
  IF v_new_count IN (1, 3, 5) THEN
    -- Find the skin for this milestone
    SELECT id INTO v_skin_id
    FROM companion_skins
    WHERE unlock_type = 'referral'
      AND unlock_requirement = v_new_count
    LIMIT 1;
    
    IF v_skin_id IS NOT NULL THEN
      -- Unlock the skin (upsert to handle duplicates)
      INSERT INTO user_companion_skins (user_id, skin_id, acquired_via)
      VALUES (p_referrer_id, v_skin_id, 'referral_milestone_' || v_new_count)
      ON CONFLICT (user_id, skin_id) DO NOTHING;
      
      v_skin_unlocked := true;
    END IF;
  END IF;
  
  -- Step 5: Clear referred_by from referee profile
  UPDATE profiles
  SET referred_by = NULL
  WHERE id = p_referee_id;
  
  -- Step 6: Log to audit table
  INSERT INTO referral_audit_log (
    referrer_id,
    referee_id,
    event_type,
    old_count,
    new_count,
    metadata
  ) VALUES (
    p_referrer_id,
    p_referee_id,
    'stage_3_completed',
    v_new_count - 1,
    v_new_count,
    jsonb_build_object(
      'milestone_reached', v_new_count IN (1, 3, 5),
      'skin_unlocked', v_skin_unlocked
    )
  );
  
  -- All operations succeeded, transaction will commit
  RETURN jsonb_build_object(
    'success', true,
    'new_count', v_new_count,
    'milestone_reached', v_new_count IN (1, 3, 5),
    'skin_unlocked', v_skin_unlocked
  );
  
EXCEPTION 
  WHEN unique_violation THEN
    -- Another transaction completed the same referral
    RETURN jsonb_build_object(
      'success', false,
      'reason', 'concurrent_completion',
      'message', 'Another process already completed this referral'
    );
  WHEN OTHERS THEN
    -- Unexpected error - rollback happens automatically
    RAISE WARNING 'complete_referral_stage3 failed for referee % referrer %: %', 
      p_referee_id, p_referrer_id, SQLERRM;
    RAISE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Fix Bug #15 & #18: Atomic function for applying referral code
CREATE OR REPLACE FUNCTION apply_referral_code_atomic(
  p_user_id UUID,
  p_referrer_id UUID,
  p_referral_code TEXT
) RETURNS JSONB AS $$
DECLARE
  v_current_referred_by UUID;
  v_already_completed BOOLEAN;
BEGIN
  -- Validate inputs (Bug #26 fix)
  IF p_user_id IS NULL OR p_referrer_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'reason', 'invalid_input',
      'message', 'User ID and referrer ID are required'
    );
  END IF;
  
  -- Validate referral code format (Bug #27 fix)
  IF p_referral_code IS NULL OR 
     p_referral_code = '' OR
     p_referral_code !~ '^REF-[A-Z0-9]{8}$' THEN
    RETURN jsonb_build_object(
      'success', false,
      'reason', 'invalid_code_format',
      'message', 'Invalid referral code format'
    );
  END IF;
  
  -- Lock the user's profile row to prevent concurrent modifications
  SELECT referred_by INTO v_current_referred_by
  FROM profiles
  WHERE id = p_user_id
  FOR UPDATE;
  
  -- Check if user already has a referral code applied
  IF v_current_referred_by IS NOT NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'reason', 'already_has_referrer',
      'message', 'You have already used a referral code'
    );
  END IF;
  
  -- Check if user already completed a referral with this referrer
  -- (in case of companion reset scenario)
  SELECT EXISTS(
    SELECT 1 FROM referral_completions
    WHERE referee_id = p_user_id
      AND referrer_id = p_referrer_id
  ) INTO v_already_completed;
  
  IF v_already_completed THEN
    RETURN jsonb_build_object(
      'success', false,
      'reason', 'already_completed_with_referrer',
      'message', 'You have already completed a referral with this user'
    );
  END IF;
  
  -- Validate referrer exists
  IF NOT EXISTS(SELECT 1 FROM profiles WHERE id = p_referrer_id) THEN
    RETURN jsonb_build_object(
      'success', false,
      'reason', 'invalid_referrer',
      'message', 'Invalid referral code'
    );
  END IF;
  
  -- Prevent self-referral
  IF p_user_id = p_referrer_id THEN
    RETURN jsonb_build_object(
      'success', false,
      'reason', 'self_referral',
      'message', 'You cannot use your own referral code'
    );
  END IF;
  
  -- Atomically update referred_by
  UPDATE profiles
  SET referred_by = p_referrer_id
  WHERE id = p_user_id
    AND referred_by IS NULL; -- Double-check to prevent race
  
  -- Verify update succeeded
  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'reason', 'update_failed',
      'message', 'Failed to apply referral code (possible concurrent update)'
    );
  END IF;
  
  -- Log the application (optional, for tracking)
  INSERT INTO used_referral_codes (user_id, referral_code)
  VALUES (p_user_id, p_referral_code)
  ON CONFLICT (user_id, referral_code) DO NOTHING;
  
  -- Success
  RETURN jsonb_build_object(
    'success', true,
    'message', 'Referral code applied successfully'
  );
  
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'apply_referral_code_atomic failed for user % referrer %: %',
    p_user_id, p_referrer_id, SQLERRM;
  RAISE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Add helper function to safely decrement count (for error recovery)
CREATE OR REPLACE FUNCTION decrement_referral_count(referrer_id UUID)
RETURNS INTEGER AS $$
DECLARE
  v_new_count INTEGER;
BEGIN
  UPDATE profiles
  SET referral_count = GREATEST(COALESCE(referral_count, 0) - 1, 0)
  WHERE id = referrer_id
  RETURNING referral_count INTO v_new_count;
  
  IF v_new_count IS NULL THEN
    RAISE EXCEPTION 'Referrer profile not found: %', referrer_id;
  END IF;
  
  RETURN v_new_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Add index to improve concurrent lock performance
CREATE INDEX IF NOT EXISTS idx_referral_completions_lookup
ON referral_completions(referee_id, referrer_id);

-- Add check constraint to prevent negative counts (if not already added)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.constraint_column_usage
    WHERE constraint_name = 'referral_count_non_negative'
  ) THEN
    ALTER TABLE profiles
    ADD CONSTRAINT referral_count_non_negative
    CHECK (referral_count >= 0);
  END IF;
END $$;

-- Comment explaining the transaction guarantees
COMMENT ON FUNCTION complete_referral_stage3 IS 
'Atomically completes a referral when user reaches Stage 3. 
All operations (completion record, count increment, skin unlock, referred_by clear) 
happen in a single transaction. Either all succeed or all rollback.
Prevents race conditions via row locking and unique constraints.';

COMMENT ON FUNCTION apply_referral_code_atomic IS
'Atomically applies a referral code with row-level locking to prevent TOCTOU races.
Validates all conditions (not already set, not self-referral, referrer exists) 
before updating. Returns detailed success/failure status.';
