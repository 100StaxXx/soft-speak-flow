-- Add PayPal email to profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS paypal_email TEXT;

-- Create referral payouts table
CREATE TABLE IF NOT EXISTS referral_payouts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  referee_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  amount NUMERIC(10, 2) NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'paid', 'rejected')),
  payout_type TEXT NOT NULL CHECK (payout_type IN ('first_month', 'first_year')),
  subscription_id TEXT,
  apple_transaction_id TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  approved_at TIMESTAMPTZ,
  paid_at TIMESTAMPTZ,
  rejected_at TIMESTAMPTZ,
  admin_notes TEXT,
  paypal_transaction_id TEXT,
  paypal_payer_id TEXT
);

-- Add indexes
CREATE INDEX IF NOT EXISTS idx_referral_payouts_referrer ON referral_payouts(referrer_id);
CREATE INDEX IF NOT EXISTS idx_referral_payouts_status ON referral_payouts(status);
CREATE INDEX IF NOT EXISTS idx_referral_payouts_created ON referral_payouts(created_at DESC);

-- Enable RLS
ALTER TABLE referral_payouts ENABLE ROW LEVEL SECURITY;

-- Users can view their own payouts
CREATE POLICY "Users can view own payouts"
  ON referral_payouts FOR SELECT
  USING (auth.uid() = referrer_id);

-- Service role can do everything (for admin and edge functions)
CREATE POLICY "Service role full access"
  ON referral_payouts FOR ALL
  USING (is_service_role());