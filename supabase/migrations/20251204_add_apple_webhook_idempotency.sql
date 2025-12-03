-- Migration: Add Idempotency for Apple IAP Webhooks
-- Prevents duplicate processing of webhook notifications

-- Table to track processed Apple webhook notifications
CREATE TABLE IF NOT EXISTS public.apple_webhook_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id TEXT NOT NULL,
  notification_type TEXT NOT NULL,
  product_id TEXT,
  user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  raw_payload JSONB,
  processed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  processing_status TEXT NOT NULL DEFAULT 'success',
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Unique constraint: same transaction + notification type can only be processed once
  CONSTRAINT unique_transaction_notification UNIQUE (transaction_id, notification_type)
);

-- Index for fast lookups
CREATE INDEX idx_apple_webhook_events_transaction ON public.apple_webhook_events(transaction_id);
CREATE INDEX idx_apple_webhook_events_user ON public.apple_webhook_events(user_id);
CREATE INDEX idx_apple_webhook_events_created ON public.apple_webhook_events(created_at DESC);

-- Enable RLS
ALTER TABLE public.apple_webhook_events ENABLE ROW LEVEL SECURITY;

-- Only admins can view webhook events (security/audit trail)
CREATE POLICY "Admins can view webhook events" ON public.apple_webhook_events
  FOR SELECT USING (has_role(auth.uid(), 'admin'::app_role));

-- Comment
COMMENT ON TABLE public.apple_webhook_events IS 'Tracks processed Apple webhook notifications for idempotency and audit trail';
COMMENT ON COLUMN public.apple_webhook_events.transaction_id IS 'Apple original_transaction_id from webhook payload';
COMMENT ON COLUMN public.apple_webhook_events.notification_type IS 'Type of notification (INITIAL_BUY, DID_RENEW, etc.)';
COMMENT ON COLUMN public.apple_webhook_events.raw_payload IS 'Full webhook payload for debugging';
COMMENT ON COLUMN public.apple_webhook_events.processing_status IS 'success, failed, or skipped';

-- Function to check if webhook was already processed
CREATE OR REPLACE FUNCTION check_webhook_processed(
  p_transaction_id TEXT,
  p_notification_type TEXT
) RETURNS BOOLEAN AS $$
DECLARE
  v_exists BOOLEAN;
BEGIN
  SELECT EXISTS(
    SELECT 1 FROM apple_webhook_events
    WHERE transaction_id = p_transaction_id
      AND notification_type = p_notification_type
  ) INTO v_exists;
  
  RETURN v_exists;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to log webhook event (with conflict handling)
CREATE OR REPLACE FUNCTION log_webhook_event(
  p_transaction_id TEXT,
  p_notification_type TEXT,
  p_product_id TEXT,
  p_user_id UUID,
  p_raw_payload JSONB,
  p_processing_status TEXT DEFAULT 'success',
  p_error_message TEXT DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
  v_event_id UUID;
BEGIN
  -- Insert with ON CONFLICT to handle race conditions
  INSERT INTO apple_webhook_events (
    transaction_id,
    notification_type,
    product_id,
    user_id,
    raw_payload,
    processing_status,
    error_message
  ) VALUES (
    p_transaction_id,
    p_notification_type,
    p_product_id,
    p_user_id,
    p_raw_payload,
    p_processing_status,
    p_error_message
  )
  ON CONFLICT (transaction_id, notification_type) DO UPDATE
    SET processed_at = NOW(),
        processing_status = EXCLUDED.processing_status,
        error_message = EXCLUDED.error_message
  RETURNING id INTO v_event_id;
  
  RETURN v_event_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION check_webhook_processed IS 'Check if a webhook notification was already processed (idempotency check)';
COMMENT ON FUNCTION log_webhook_event IS 'Log a processed webhook event with conflict handling for race conditions';
