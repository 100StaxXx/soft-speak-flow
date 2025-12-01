-- Create referral_codes table for decoupled referral system
CREATE TABLE referral_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT UNIQUE NOT NULL,
  owner_type TEXT NOT NULL CHECK (owner_type IN ('user', 'influencer')),
  owner_user_id UUID REFERENCES auth.users(id),  -- NULL for influencers
  influencer_name TEXT,
  influencer_email TEXT,
  influencer_handle TEXT,
  payout_method TEXT DEFAULT 'paypal',
  payout_identifier TEXT,  -- PayPal email or other payout info
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Add index for fast code lookups
CREATE INDEX idx_referral_codes_code ON referral_codes(code);
CREATE INDEX idx_referral_codes_owner_user_id ON referral_codes(owner_user_id);

-- Add referred_by_code to profiles
ALTER TABLE profiles ADD COLUMN referred_by_code TEXT;

-- Add referral_code_id to referral_payouts
ALTER TABLE referral_payouts ADD COLUMN referral_code_id UUID REFERENCES referral_codes(id);

-- Migrate existing users to referral_codes
INSERT INTO referral_codes (code, owner_type, owner_user_id, payout_identifier, created_at)
SELECT 
  referral_code,
  'user',
  id,
  paypal_email,
  created_at
FROM profiles
WHERE referral_code IS NOT NULL;

-- Migrate existing referral_payouts to use referral_code_id
UPDATE referral_payouts rp
SET referral_code_id = rc.id
FROM referral_codes rc
WHERE rc.owner_user_id = rp.referrer_id
  AND rc.owner_type = 'user';

-- RLS Policies
ALTER TABLE referral_codes ENABLE ROW LEVEL SECURITY;

-- Anyone can view active codes (for validation)
CREATE POLICY "Anyone can validate codes"
ON referral_codes FOR SELECT
USING (is_active = true);

-- Users can view their own code
CREATE POLICY "Users view own code"
ON referral_codes FOR SELECT
USING (owner_user_id = auth.uid());

-- Service role can create codes (for influencers and user signup)
CREATE POLICY "Service creates codes"
ON referral_codes FOR INSERT
WITH CHECK (is_service_role());