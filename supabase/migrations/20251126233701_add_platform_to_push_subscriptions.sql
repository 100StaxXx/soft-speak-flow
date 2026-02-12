-- Add platform column to push_subscriptions table
-- This distinguishes between web push, iOS native, and Android native subscriptions

-- Add platform column if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'push_subscriptions' 
    AND column_name = 'platform'
  ) THEN
    ALTER TABLE push_subscriptions 
    ADD COLUMN platform TEXT DEFAULT 'web' CHECK (platform IN ('web', 'ios', 'android'));
    
    -- Add comment
    COMMENT ON COLUMN push_subscriptions.platform IS 'Platform type: web (Web Push), ios (APNs), android (FCM)';
    
    -- Update existing rows to 'web' platform
    UPDATE push_subscriptions SET platform = 'web' WHERE platform IS NULL;
  END IF;
END $$;

-- Create index for faster platform queries
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_platform 
ON push_subscriptions(platform);

-- Create index for user + platform queries
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user_platform 
ON push_subscriptions(user_id, platform);
