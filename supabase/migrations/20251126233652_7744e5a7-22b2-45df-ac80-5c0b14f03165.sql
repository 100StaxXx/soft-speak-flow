-- Create push_device_tokens table for native iOS push notifications
CREATE TABLE IF NOT EXISTS public.push_device_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  device_token TEXT NOT NULL,
  platform TEXT NOT NULL CHECK (platform IN ('ios', 'android')),
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, device_token)
);

-- Enable RLS
ALTER TABLE public.push_device_tokens ENABLE ROW LEVEL SECURITY;

-- Policy: Users can insert their own device tokens
CREATE POLICY "Users can insert their own device tokens"
  ON public.push_device_tokens
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Policy: Users can view their own device tokens
CREATE POLICY "Users can view their own device tokens"
  ON public.push_device_tokens
  FOR SELECT
  USING (auth.uid() = user_id);

-- Policy: Users can delete their own device tokens
CREATE POLICY "Users can delete their own device tokens"
  ON public.push_device_tokens
  FOR DELETE
  USING (auth.uid() = user_id);

-- Create index for faster lookups
CREATE INDEX idx_push_device_tokens_user_id ON public.push_device_tokens(user_id);
CREATE INDEX idx_push_device_tokens_platform ON public.push_device_tokens(platform);