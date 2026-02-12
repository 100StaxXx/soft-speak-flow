-- Fix overly permissive RLS policies for Apple IAP security
-- Date: 2025-11-27
-- Purpose: Restrict user permissions to read-only, allow service role full access

-- Revoke overly permissive grants
REVOKE ALL ON subscriptions FROM authenticated;
REVOKE ALL ON payment_history FROM authenticated;

-- Grant only SELECT (read-only) to authenticated users
GRANT SELECT ON subscriptions TO authenticated;
GRANT SELECT ON payment_history TO authenticated;

-- Ensure service role has full access (for edge functions)
GRANT ALL ON subscriptions TO service_role;
GRANT ALL ON payment_history TO service_role;

-- Add explicit policies for service role operations
DROP POLICY IF EXISTS "Service role can insert subscriptions" ON subscriptions;
CREATE POLICY "Service role can insert subscriptions"
  ON subscriptions FOR INSERT
  TO service_role
  WITH CHECK (true);

DROP POLICY IF EXISTS "Service role can update subscriptions" ON subscriptions;
CREATE POLICY "Service role can update subscriptions"
  ON subscriptions FOR UPDATE
  TO service_role
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "Service role can delete subscriptions" ON subscriptions;
CREATE POLICY "Service role can delete subscriptions"
  ON subscriptions FOR DELETE
  TO service_role
  USING (true);

DROP POLICY IF EXISTS "Service role can insert payment history" ON payment_history;
CREATE POLICY "Service role can insert payment history"
  ON payment_history FOR INSERT
  TO service_role
  WITH CHECK (true);

DROP POLICY IF EXISTS "Service role can update payment history" ON payment_history;
CREATE POLICY "Service role can update payment history"
  ON payment_history FOR UPDATE
  TO service_role
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "Service role can delete payment history" ON payment_history;
CREATE POLICY "Service role can delete payment history"
  ON payment_history FOR DELETE
  TO service_role
  USING (true);
