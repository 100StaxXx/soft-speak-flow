-- Referral payout hardening:
-- 1) Align payout status constraint with runtime statuses used by edge functions.
-- 2) Add webhook event log table for idempotent PayPal webhook processing.

DO $$
DECLARE
  v_constraint RECORD;
BEGIN
  -- Remove legacy status checks so we can replace with the canonical status set.
  FOR v_constraint IN
    SELECT conname
    FROM pg_constraint
    WHERE conrelid = 'public.referral_payouts'::regclass
      AND contype = 'c'
      AND pg_get_constraintdef(oid) ILIKE '%status%'
  LOOP
    EXECUTE format(
      'ALTER TABLE public.referral_payouts DROP CONSTRAINT %I',
      v_constraint.conname
    );
  END LOOP;
END $$;

ALTER TABLE public.referral_payouts
  ADD CONSTRAINT referral_payouts_status_check
  CHECK (
    status = ANY (ARRAY[
      'pending',
      'requested',
      'approved',
      'processing',
      'paid',
      'failed',
      'rejected',
      'cancelled',
      'unclaimed'
    ])
  );

CREATE TABLE IF NOT EXISTS public.payment_webhook_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider TEXT NOT NULL,
  event_id TEXT NOT NULL,
  event_type TEXT,
  payload JSONB,
  received_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  processed_at TIMESTAMPTZ
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_payment_webhook_events_provider_event
  ON public.payment_webhook_events(provider, event_id);

CREATE INDEX IF NOT EXISTS idx_payment_webhook_events_received_at
  ON public.payment_webhook_events(received_at DESC);

ALTER TABLE public.payment_webhook_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role full access on payment webhook events"
  ON public.payment_webhook_events;

CREATE POLICY "Service role full access on payment webhook events"
  ON public.payment_webhook_events
  FOR ALL
  USING (is_service_role())
  WITH CHECK (is_service_role());
