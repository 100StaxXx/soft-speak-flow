CREATE TABLE IF NOT EXISTS public.ai_rate_limit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  function_key TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.ai_rate_limit_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role can insert ai rate limit log" ON public.ai_rate_limit_log;
CREATE POLICY "Service role can insert ai rate limit log"
ON public.ai_rate_limit_log
FOR INSERT
WITH CHECK (true);

DROP POLICY IF EXISTS "Service role can read ai rate limit log" ON public.ai_rate_limit_log;
CREATE POLICY "Service role can read ai rate limit log"
ON public.ai_rate_limit_log
FOR SELECT
USING (false);

CREATE INDEX IF NOT EXISTS idx_ai_rate_limit_log_lookup
ON public.ai_rate_limit_log (user_id, function_key, created_at DESC);
