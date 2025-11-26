-- ============================================
-- CRITICAL REFERRAL SYSTEM SECURITY FIXES
-- ============================================

-- Fix Bug #8: Prevent infinite referral farming via companion reset
-- Add permanent referral tracking table
CREATE TABLE IF NOT EXISTS referral_completions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  referee_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  referrer_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  completed_at TIMESTAMPTZ DEFAULT now(),
  stage_reached INTEGER NOT NULL DEFAULT 3,
  UNIQUE(referee_id, referrer_id)
);

-- Enable RLS
ALTER TABLE referral_completions ENABLE ROW LEVEL SECURITY;

-- Users can view their own completions
CREATE POLICY "Users can view own completions"
ON referral_completions FOR SELECT
USING (auth.uid() = referee_id OR auth.uid() = referrer_id);

-- Fix Bug #10: Restrict profile updates to safe columns only
-- Drop existing overly permissive policy
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile limited" ON public.profiles;

-- Create new restricted policy that prevents modifying referral fields
CREATE POLICY "Users can update own profile (restricted)"
ON public.profiles FOR UPDATE
USING (auth.uid() = id AND auth.uid() IS NOT NULL)
WITH CHECK (
  auth.uid() = id 
  AND auth.uid() IS NOT NULL
  -- Prevent modifying referral system fields
  AND referral_count = (SELECT referral_count FROM profiles WHERE id = auth.uid())
  AND referral_code = (SELECT referral_code FROM profiles WHERE id = auth.uid())
  -- Allow setting referred_by ONLY if currently NULL (one-time only)
  AND (
    referred_by = (SELECT referred_by FROM profiles WHERE id = auth.uid())
    OR (
      (SELECT referred_by FROM profiles WHERE id = auth.uid()) IS NULL
      AND referred_by IS NOT NULL
    )
  )
);

-- Fix Bug #12: Add ON DELETE SET NULL to referred_by FK
-- First, drop the existing constraint
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_referred_by_fkey;

-- Re-add with proper ON DELETE behavior
ALTER TABLE profiles
ADD CONSTRAINT profiles_referred_by_fkey
FOREIGN KEY (referred_by)
REFERENCES profiles(id)
ON DELETE SET NULL;

-- Fix Bug #11: Improve increment_referral_count with validation
CREATE OR REPLACE FUNCTION increment_referral_count(referrer_id UUID)
RETURNS TABLE(referral_count INTEGER) AS $$
DECLARE
  v_count INTEGER;
  v_exists BOOLEAN;
BEGIN
  -- Validate referrer exists
  SELECT EXISTS(SELECT 1 FROM profiles WHERE id = referrer_id) INTO v_exists;
  
  IF NOT v_exists THEN
    RAISE EXCEPTION 'Referrer profile does not exist: %', referrer_id
      USING HINT = 'The referrer may have deleted their account';
  END IF;

  -- Atomic increment with validation
  UPDATE profiles
  SET referral_count = COALESCE(referral_count, 0) + 1
  WHERE id = referrer_id
  RETURNING profiles.referral_count INTO v_count;
  
  -- Ensure update succeeded
  IF v_count IS NULL THEN
    RAISE EXCEPTION 'Failed to increment referral count for referrer: %', referrer_id
      USING HINT = 'The update did not affect any rows';
  END IF;
  
  referral_count := v_count;
  RETURN NEXT;
  
  EXCEPTION
    WHEN OTHERS THEN
      -- Log error and re-raise
      RAISE WARNING 'increment_referral_count failed for %: %', referrer_id, SQLERRM;
      RAISE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Add index for referral_completions lookups
CREATE INDEX IF NOT EXISTS idx_referral_completions_referee 
ON referral_completions(referee_id);

CREATE INDEX IF NOT EXISTS idx_referral_completions_referrer 
ON referral_completions(referrer_id);

-- Add function to check if referral was already completed
CREATE OR REPLACE FUNCTION has_completed_referral(p_referee_id UUID, p_referrer_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS(
    SELECT 1 FROM referral_completions
    WHERE referee_id = p_referee_id
      AND referrer_id = p_referrer_id
  );
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public;

-- Add trigger to log referral completions
CREATE OR REPLACE FUNCTION log_referral_completion()
RETURNS TRIGGER AS $$
BEGIN
  -- Only log if referee has a referrer
  IF NEW.stage_reached >= 3 AND 
     (SELECT referred_by FROM profiles WHERE id = NEW.referee_id) IS NOT NULL THEN
    
    INSERT INTO referral_audit_log (
      referrer_id,
      referee_id,
      event_type,
      new_count,
      metadata
    )
    SELECT 
      referred_by,
      NEW.referee_id,
      'stage_3_reached',
      referral_count,
      jsonb_build_object('stage', NEW.stage_reached)
    FROM profiles
    WHERE id = (SELECT referred_by FROM profiles WHERE id = NEW.referee_id);
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Modify reset-companion to track used referral codes
-- (This will require updating the edge function, but we'll add DB support here)
CREATE TABLE IF NOT EXISTS used_referral_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  referral_code TEXT NOT NULL,
  applied_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, referral_code)
);

ALTER TABLE used_referral_codes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own used codes"
ON used_referral_codes FOR SELECT
USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_used_codes_user 
ON used_referral_codes(user_id);

-- Add check constraint to ensure stage_reached is valid
ALTER TABLE referral_completions
ADD CONSTRAINT valid_stage_reached
CHECK (stage_reached >= 3 AND stage_reached <= 20);
