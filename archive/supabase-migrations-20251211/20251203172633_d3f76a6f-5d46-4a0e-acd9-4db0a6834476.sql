-- Add columns to track streak at risk state
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS streak_at_risk boolean DEFAULT false;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS streak_at_risk_since timestamp with time zone;