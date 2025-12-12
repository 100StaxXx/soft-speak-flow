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
CREATE POLICY IF NOT EXISTS "Service role can insert subscriptions"
  ON subscriptions FOR INSERT
  TO service_role
  USING (true);

CREATE POLICY IF NOT EXISTS "Service role can update subscriptions"
  ON subscriptions FOR UPDATE
  TO service_role
  USING (true);

CREATE POLICY IF NOT EXISTS "Service role can delete subscriptions"
  ON subscriptions FOR DELETE
  TO service_role
  USING (true);

CREATE POLICY IF NOT EXISTS "Service role can insert payment history"
  ON payment_history FOR INSERT
  TO service_role
  USING (true);

CREATE POLICY IF NOT EXISTS "Service role can update payment history"
  ON payment_history FOR UPDATE
  TO service_role
  USING (true);

CREATE POLICY IF NOT EXISTS "Service role can delete payment history"
  ON payment_history FOR DELETE
  TO service_role
  USING (true);

-- Add comments for documentation
COMMENT ON POLICY "Users can view their own subscriptions" ON subscriptions IS 
  'Authenticated users can only SELECT their own subscription data';

COMMENT ON POLICY "Service role can manage all subscriptions" ON subscriptions IS 
  'Service role (edge functions) has full CRUD access to all subscriptions';

COMMENT ON POLICY "Users can view their own payment history" ON payment_history IS 
  'Authenticated users can only SELECT their own payment history';

COMMENT ON POLICY "Service role can manage all payment history" ON payment_history IS 
  'Service role (edge functions) has full CRUD access to all payment history';
