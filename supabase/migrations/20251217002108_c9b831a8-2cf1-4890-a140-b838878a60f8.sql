-- Make referrer_id nullable for external influencers
ALTER TABLE referral_payouts ALTER COLUMN referrer_id DROP NOT NULL;