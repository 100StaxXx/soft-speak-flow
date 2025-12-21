-- Create rate limiting table for influencer code creation
CREATE TABLE IF NOT EXISTS public.influencer_creation_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ip_address TEXT NOT NULL,
  email TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Add index for efficient lookups
CREATE INDEX IF NOT EXISTS idx_influencer_creation_log_ip_time ON public.influencer_creation_log(ip_address, created_at);

-- Enable RLS
ALTER TABLE public.influencer_creation_log ENABLE ROW LEVEL SECURITY;

-- Only service role can access this table (edge functions use service role)
CREATE POLICY "Service role only" ON public.influencer_creation_log
FOR ALL USING (false)
WITH CHECK (false);

-- Cleanup old logs after 24 hours (optional - saves space)
CREATE OR REPLACE FUNCTION public.cleanup_old_influencer_logs()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  DELETE FROM public.influencer_creation_log
  WHERE created_at < NOW() - INTERVAL '24 hours';
END;
$$;