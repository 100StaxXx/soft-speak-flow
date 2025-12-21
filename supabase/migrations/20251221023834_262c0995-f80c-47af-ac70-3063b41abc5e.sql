-- Add missing environment and source columns to subscriptions table
ALTER TABLE subscriptions 
ADD COLUMN IF NOT EXISTS environment TEXT,
ADD COLUMN IF NOT EXISTS source TEXT;

-- Add comment for clarity
COMMENT ON COLUMN subscriptions.environment IS 'Apple environment: Production or Sandbox';
COMMENT ON COLUMN subscriptions.source IS 'How subscription was verified: receipt or webhook';