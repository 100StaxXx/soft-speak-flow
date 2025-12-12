-- Fix for Bug #1: Add atomic increment function to prevent race conditions
CREATE OR REPLACE FUNCTION increment_referral_count(referrer_id UUID)
RETURNS TABLE(referral_count INTEGER) AS $$
BEGIN
  -- Atomic increment - prevents race conditions
  UPDATE profiles
  SET referral_count = COALESCE(referral_count, 0) + 1
  WHERE id = referrer_id
  RETURNING profiles.referral_count INTO referral_count;
  
  RETURN NEXT;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Note: referral_count_non_negative constraint is added in 20251126_fix_transaction_bugs.sql
-- with proper IF NOT EXISTS check to prevent migration conflicts

-- Add index for performance on referred_by lookups
CREATE INDEX IF NOT EXISTS idx_profiles_referred_by 
ON profiles(referred_by) 
WHERE referred_by IS NOT NULL;

-- Add audit log table for debugging referral issues
CREATE TABLE IF NOT EXISTS referral_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_id UUID REFERENCES profiles(id),
  referee_id UUID REFERENCES profiles(id),
  event_type TEXT NOT NULL,
  old_count INTEGER,
  new_count INTEGER,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS on audit log
ALTER TABLE referral_audit_log ENABLE ROW LEVEL SECURITY;

-- Users can view their own referral events
CREATE POLICY "Users can view own referral events"
ON referral_audit_log FOR SELECT
USING (auth.uid() = referrer_id OR auth.uid() = referee_id);

-- Create trigger to log referral count changes
CREATE OR REPLACE FUNCTION log_referral_count_change()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.referral_count IS DISTINCT FROM NEW.referral_count THEN
    INSERT INTO referral_audit_log (
      referrer_id,
      event_type,
      old_count,
      new_count
    ) VALUES (
      NEW.id,
      'count_updated',
      OLD.referral_count,
      NEW.referral_count
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER referral_count_change_trigger
AFTER UPDATE ON profiles
FOR EACH ROW
WHEN (OLD.referral_count IS DISTINCT FROM NEW.referral_count)
EXECUTE FUNCTION log_referral_count_change();
