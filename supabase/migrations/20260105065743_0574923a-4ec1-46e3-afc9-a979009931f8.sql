-- Fix referral_codes foreign key to cascade on user deletion
-- This allows auth.users deletion to succeed by automatically removing referral_codes

-- Drop the existing constraint
ALTER TABLE public.referral_codes
  DROP CONSTRAINT IF EXISTS referral_codes_owner_user_id_fkey;

-- Recreate with ON DELETE CASCADE
ALTER TABLE public.referral_codes
  ADD CONSTRAINT referral_codes_owner_user_id_fkey
  FOREIGN KEY (owner_user_id)
  REFERENCES auth.users(id)
  ON DELETE CASCADE;