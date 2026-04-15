ALTER TABLE public.referral_codes
  ADD COLUMN IF NOT EXISTS affiliate_provider TEXT,
  ADD COLUMN IF NOT EXISTS tolt_partner_id TEXT,
  ADD COLUMN IF NOT EXISTS tolt_link_id TEXT,
  ADD COLUMN IF NOT EXISTS tolt_partner_status TEXT,
  ADD COLUMN IF NOT EXISTS tolt_synced_at TIMESTAMP WITH TIME ZONE;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'referral_codes_affiliate_provider_check'
  ) THEN
    ALTER TABLE public.referral_codes
      ADD CONSTRAINT referral_codes_affiliate_provider_check
      CHECK (affiliate_provider IS NULL OR affiliate_provider IN ('tolt'));
  END IF;
END;
$$;

CREATE UNIQUE INDEX IF NOT EXISTS idx_referral_codes_tolt_partner_id
  ON public.referral_codes (tolt_partner_id)
  WHERE tolt_partner_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.affiliate_conversions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider TEXT NOT NULL,
  referral_code_id UUID NOT NULL REFERENCES public.referral_codes(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  source_transaction_id TEXT NOT NULL,
  source_product_id TEXT NOT NULL,
  plan TEXT NOT NULL,
  amount_cents INTEGER NOT NULL CHECK (amount_cents >= 0),
  commission_cents INTEGER NOT NULL CHECK (commission_cents >= 0),
  applied_offer_id TEXT,
  provider_partner_id TEXT,
  provider_customer_id TEXT,
  provider_transaction_id TEXT,
  provider_commission_id TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  last_error TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT affiliate_conversions_provider_check CHECK (provider IN ('tolt')),
  CONSTRAINT affiliate_conversions_plan_check CHECK (plan IN ('yearly')),
  CONSTRAINT affiliate_conversions_status_check CHECK (status IN ('pending', 'reported', 'failed', 'reversed'))
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_affiliate_conversions_provider_tx
  ON public.affiliate_conversions (provider, source_transaction_id);

CREATE INDEX IF NOT EXISTS idx_affiliate_conversions_referral_code
  ON public.affiliate_conversions (referral_code_id, status);

CREATE INDEX IF NOT EXISTS idx_affiliate_conversions_user_id
  ON public.affiliate_conversions (user_id);

ALTER TABLE public.affiliate_conversions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role manages affiliate conversions" ON public.affiliate_conversions;
CREATE POLICY "Service role manages affiliate conversions"
ON public.affiliate_conversions
FOR ALL
USING (is_service_role())
WITH CHECK (is_service_role());
