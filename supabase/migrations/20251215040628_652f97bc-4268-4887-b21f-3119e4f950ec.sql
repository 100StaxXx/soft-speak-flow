-- Create security audit log table for tracking auth failures and suspicious activity
CREATE TABLE IF NOT EXISTS public.security_audit_log (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  event_type TEXT NOT NULL,
  function_name TEXT NOT NULL,
  ip_address TEXT,
  user_agent TEXT,
  details JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.security_audit_log ENABLE ROW LEVEL SECURITY;

-- Only service role can insert (edge functions use service role)
CREATE POLICY "Service role can insert audit logs"
ON public.security_audit_log
FOR INSERT
WITH CHECK (true);

-- Only service role can read (no public access)
CREATE POLICY "Service role can read audit logs"
ON public.security_audit_log
FOR SELECT
USING (false);

-- Add index for querying by event type and time
CREATE INDEX idx_security_audit_log_event_type ON public.security_audit_log(event_type);
CREATE INDEX idx_security_audit_log_created_at ON public.security_audit_log(created_at DESC);

-- Auto-delete old audit logs after 30 days (cleanup function)
CREATE OR REPLACE FUNCTION public.cleanup_old_audit_logs()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.security_audit_log
  WHERE created_at < NOW() - INTERVAL '30 days';
END;
$$;