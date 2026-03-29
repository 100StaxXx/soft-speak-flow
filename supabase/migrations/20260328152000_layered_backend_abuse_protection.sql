-- Layered backend abuse protection primitives, policies, and invite/upload hardening.

-- ---------------------------------------------------------------------------
-- Abuse protection configuration + override tables.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.abuse_protection_config (
  profile_key TEXT PRIMARY KEY,
  description TEXT NOT NULL,
  user_limit INTEGER,
  user_window_seconds INTEGER,
  ip_limit INTEGER,
  ip_window_seconds INTEGER,
  email_limit INTEGER,
  email_window_seconds INTEGER,
  cooldown_seconds INTEGER NOT NULL DEFAULT 0 CHECK (cooldown_seconds >= 0),
  severity TEXT NOT NULL DEFAULT 'medium' CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT abuse_protection_config_user_window_check
    CHECK (user_limit IS NULL OR (user_limit > 0 AND user_window_seconds IS NOT NULL AND user_window_seconds > 0)),
  CONSTRAINT abuse_protection_config_ip_window_check
    CHECK (ip_limit IS NULL OR (ip_limit > 0 AND ip_window_seconds IS NOT NULL AND ip_window_seconds > 0)),
  CONSTRAINT abuse_protection_config_email_window_check
    CHECK (email_limit IS NULL OR (email_limit > 0 AND email_window_seconds IS NOT NULL AND email_window_seconds > 0))
);

ALTER TABLE public.abuse_protection_config ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can view abuse protection config" ON public.abuse_protection_config;
CREATE POLICY "Admins can view abuse protection config"
  ON public.abuse_protection_config
  FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS "Admins can insert abuse protection config" ON public.abuse_protection_config;
CREATE POLICY "Admins can insert abuse protection config"
  ON public.abuse_protection_config
  FOR INSERT
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS "Admins can update abuse protection config" ON public.abuse_protection_config;
CREATE POLICY "Admins can update abuse protection config"
  ON public.abuse_protection_config
  FOR UPDATE
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS "Admins can delete abuse protection config" ON public.abuse_protection_config;
CREATE POLICY "Admins can delete abuse protection config"
  ON public.abuse_protection_config
  FOR DELETE
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.abuse_protection_config TO authenticated;

DROP TRIGGER IF EXISTS update_abuse_protection_config_updated_at ON public.abuse_protection_config;
CREATE TRIGGER update_abuse_protection_config_updated_at
  BEFORE UPDATE ON public.abuse_protection_config
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE IF NOT EXISTS public.abuse_limit_overrides (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  profile_key TEXT NOT NULL REFERENCES public.abuse_protection_config(profile_key) ON DELETE CASCADE,
  reason TEXT NOT NULL,
  granted_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  user_limit INTEGER CHECK (user_limit IS NULL OR user_limit > 0),
  user_window_seconds INTEGER CHECK (user_window_seconds IS NULL OR user_window_seconds > 0),
  cooldown_seconds INTEGER CHECK (cooldown_seconds IS NULL OR cooldown_seconds >= 0),
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT abuse_limit_overrides_reason_not_blank CHECK (length(trim(reason)) > 0),
  CONSTRAINT abuse_limit_overrides_window_pair_check
    CHECK (
      (user_limit IS NULL AND user_window_seconds IS NULL)
      OR (user_limit IS NOT NULL AND user_window_seconds IS NOT NULL)
    )
);

CREATE INDEX IF NOT EXISTS idx_abuse_limit_overrides_user_profile_expiry
  ON public.abuse_limit_overrides(user_id, profile_key, expires_at DESC);

ALTER TABLE public.abuse_limit_overrides ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can view abuse limit overrides" ON public.abuse_limit_overrides;
CREATE POLICY "Admins can view abuse limit overrides"
  ON public.abuse_limit_overrides
  FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS "Admins can insert abuse limit overrides" ON public.abuse_limit_overrides;
CREATE POLICY "Admins can insert abuse limit overrides"
  ON public.abuse_limit_overrides
  FOR INSERT
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS "Admins can update abuse limit overrides" ON public.abuse_limit_overrides;
CREATE POLICY "Admins can update abuse limit overrides"
  ON public.abuse_limit_overrides
  FOR UPDATE
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS "Admins can delete abuse limit overrides" ON public.abuse_limit_overrides;
CREATE POLICY "Admins can delete abuse limit overrides"
  ON public.abuse_limit_overrides
  FOR DELETE
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.abuse_limit_overrides TO authenticated;

DROP TRIGGER IF EXISTS update_abuse_limit_overrides_updated_at ON public.abuse_limit_overrides;
CREATE TRIGGER update_abuse_limit_overrides_updated_at
  BEFORE UPDATE ON public.abuse_limit_overrides
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- ---------------------------------------------------------------------------
-- Counter + event storage.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.abuse_counter_windows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_key TEXT NOT NULL REFERENCES public.abuse_protection_config(profile_key) ON DELETE CASCADE,
  subject_type TEXT NOT NULL CHECK (subject_type IN ('user', 'ip', 'email_target')),
  subject_key TEXT NOT NULL,
  window_started_at TIMESTAMPTZ NOT NULL,
  window_seconds INTEGER NOT NULL CHECK (window_seconds > 0),
  request_count INTEGER NOT NULL DEFAULT 0 CHECK (request_count >= 0),
  last_request_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  cooldown_until TIMESTAMPTZ,
  last_blocked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (profile_key, subject_type, subject_key, window_started_at)
);

CREATE INDEX IF NOT EXISTS idx_abuse_counter_windows_subject_latest
  ON public.abuse_counter_windows(profile_key, subject_type, subject_key, window_started_at DESC);

ALTER TABLE public.abuse_counter_windows ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can view abuse counter windows" ON public.abuse_counter_windows;
CREATE POLICY "Admins can view abuse counter windows"
  ON public.abuse_counter_windows
  FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));

GRANT SELECT ON public.abuse_counter_windows TO authenticated;

DROP TRIGGER IF EXISTS update_abuse_counter_windows_updated_at ON public.abuse_counter_windows;
CREATE TRIGGER update_abuse_counter_windows_updated_at
  BEFORE UPDATE ON public.abuse_counter_windows
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE IF NOT EXISTS public.abuse_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id UUID NOT NULL DEFAULT gen_random_uuid(),
  event_type TEXT NOT NULL CHECK (event_type IN ('blocked_limit', 'blocked_cooldown', 'bypass_attempt', 'limiter_error', 'blocked_policy')),
  severity TEXT NOT NULL DEFAULT 'medium' CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  endpoint_name TEXT NOT NULL,
  profile_key TEXT,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ip_address TEXT,
  email_target TEXT,
  code TEXT NOT NULL,
  retry_after_seconds INTEGER,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_abuse_events_created_at
  ON public.abuse_events(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_abuse_events_profile_created
  ON public.abuse_events(profile_key, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_abuse_events_ip_created
  ON public.abuse_events(ip_address, created_at DESC)
  WHERE ip_address IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_abuse_events_user_created
  ON public.abuse_events(user_id, created_at DESC)
  WHERE user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_abuse_events_email_created
  ON public.abuse_events(email_target, created_at DESC)
  WHERE email_target IS NOT NULL;

ALTER TABLE public.abuse_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can view abuse events" ON public.abuse_events;
CREATE POLICY "Admins can view abuse events"
  ON public.abuse_events
  FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));

GRANT SELECT ON public.abuse_events TO authenticated;

-- ---------------------------------------------------------------------------
-- Request header helpers + event logging.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.abuse_window_start(
  p_now TIMESTAMPTZ,
  p_window_seconds INTEGER
)
RETURNS TIMESTAMPTZ
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT to_timestamp(
    floor(extract(epoch from p_now) / GREATEST(p_window_seconds, 1)) * GREATEST(p_window_seconds, 1)
  );
$$;

CREATE OR REPLACE FUNCTION public.get_request_ip_address()
RETURNS TEXT
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_headers JSONB := COALESCE(NULLIF(current_setting('request.headers', true), ''), '{}')::JSONB;
  v_ip TEXT;
BEGIN
  v_ip := NULLIF(trim(COALESCE(v_headers ->> 'cf-connecting-ip', '')), '');

  IF v_ip IS NULL THEN
    v_ip := NULLIF(trim(split_part(COALESCE(v_headers ->> 'x-forwarded-for', ''), ',', 1)), '');
  END IF;

  IF v_ip IS NULL THEN
    RETURN 'unknown';
  END IF;

  RETURN v_ip;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_request_ip_address() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_request_ip_address() TO service_role;

CREATE OR REPLACE FUNCTION public.record_abuse_event(
  p_event_type TEXT,
  p_endpoint_name TEXT,
  p_code TEXT,
  p_request_id UUID DEFAULT gen_random_uuid(),
  p_severity TEXT DEFAULT 'medium',
  p_profile_key TEXT DEFAULT NULL,
  p_user_id UUID DEFAULT NULL,
  p_ip_address TEXT DEFAULT NULL,
  p_email_target TEXT DEFAULT NULL,
  p_retry_after_seconds INTEGER DEFAULT NULL,
  p_metadata JSONB DEFAULT '{}'::jsonb
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.abuse_events (
    request_id,
    event_type,
    severity,
    endpoint_name,
    profile_key,
    user_id,
    ip_address,
    email_target,
    code,
    retry_after_seconds,
    metadata
  ) VALUES (
    COALESCE(p_request_id, gen_random_uuid()),
    p_event_type,
    p_severity,
    p_endpoint_name,
    p_profile_key,
    p_user_id,
    p_ip_address,
    CASE
      WHEN p_email_target IS NULL OR trim(p_email_target) = '' THEN NULL
      ELSE lower(trim(p_email_target))
    END,
    p_code,
    p_retry_after_seconds,
    COALESCE(p_metadata, '{}'::jsonb)
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.record_abuse_event(TEXT, TEXT, TEXT, UUID, TEXT, TEXT, UUID, TEXT, TEXT, INTEGER, JSONB)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_abuse_event(TEXT, TEXT, TEXT, UUID, TEXT, TEXT, UUID, TEXT, TEXT, INTEGER, JSONB)
  TO service_role;

-- ---------------------------------------------------------------------------
-- Atomic subject + profile consumption helpers.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.consume_abuse_subject(
  p_profile_key TEXT,
  p_subject_type TEXT,
  p_subject_key TEXT,
  p_limit INTEGER,
  p_window_seconds INTEGER,
  p_cooldown_seconds INTEGER,
  p_now TIMESTAMPTZ DEFAULT now()
)
RETURNS TABLE(
  allowed BOOLEAN,
  blocked_reason TEXT,
  retry_after_seconds INTEGER,
  remaining INTEGER,
  reset_at TIMESTAMPTZ,
  cooldown_until TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_window_started TIMESTAMPTZ;
  v_reset_at TIMESTAMPTZ;
  v_row public.abuse_counter_windows%ROWTYPE;
  v_latest public.abuse_counter_windows%ROWTYPE;
  v_retry_until TIMESTAMPTZ;
  v_new_count INTEGER;
BEGIN
  IF p_subject_key IS NULL OR trim(p_subject_key) = '' OR p_limit IS NULL OR p_window_seconds IS NULL THEN
    RETURN QUERY
    SELECT true, NULL::TEXT, NULL::INTEGER, NULL::INTEGER, NULL::TIMESTAMPTZ, NULL::TIMESTAMPTZ;
    RETURN;
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext(CONCAT_WS('|', 'abuse', p_profile_key, p_subject_type, p_subject_key)));

  SELECT *
  INTO v_latest
  FROM public.abuse_counter_windows
  WHERE profile_key = p_profile_key
    AND subject_type = p_subject_type
    AND subject_key = p_subject_key
  ORDER BY window_started_at DESC
  LIMIT 1;

  IF v_latest.cooldown_until IS NOT NULL AND v_latest.cooldown_until > p_now THEN
    RETURN QUERY
    SELECT
      false,
      'cooldown_active'::TEXT,
      GREATEST(1, ceil(extract(epoch from (v_latest.cooldown_until - p_now)))::INTEGER),
      0,
      v_latest.window_started_at + make_interval(secs => v_latest.window_seconds),
      v_latest.cooldown_until;
    RETURN;
  END IF;

  v_window_started := public.abuse_window_start(p_now, p_window_seconds);
  v_reset_at := v_window_started + make_interval(secs => p_window_seconds);

  INSERT INTO public.abuse_counter_windows (
    profile_key,
    subject_type,
    subject_key,
    window_started_at,
    window_seconds,
    request_count,
    last_request_at
  )
  VALUES (
    p_profile_key,
    p_subject_type,
    p_subject_key,
    v_window_started,
    p_window_seconds,
    0,
    p_now
  )
  ON CONFLICT (profile_key, subject_type, subject_key, window_started_at) DO NOTHING;

  SELECT *
  INTO v_row
  FROM public.abuse_counter_windows
  WHERE profile_key = p_profile_key
    AND subject_type = p_subject_type
    AND subject_key = p_subject_key
    AND window_started_at = v_window_started
  FOR UPDATE;

  IF v_row.request_count >= p_limit THEN
    UPDATE public.abuse_counter_windows
    SET
      cooldown_until = CASE
        WHEN p_cooldown_seconds > 0 THEN GREATEST(
          COALESCE(cooldown_until, p_now),
          p_now + make_interval(secs => p_cooldown_seconds)
        )
        ELSE cooldown_until
      END,
      last_blocked_at = p_now,
      updated_at = p_now
    WHERE id = v_row.id
    RETURNING * INTO v_row;

    v_retry_until := GREATEST(
      v_reset_at,
      COALESCE(v_row.cooldown_until, v_reset_at)
    );

    RETURN QUERY
    SELECT
      false,
      'rate_limit_exceeded'::TEXT,
      GREATEST(1, ceil(extract(epoch from (v_retry_until - p_now)))::INTEGER),
      0,
      v_reset_at,
      v_row.cooldown_until;
    RETURN;
  END IF;

  UPDATE public.abuse_counter_windows
  SET
    request_count = request_count + 1,
    last_request_at = p_now,
    updated_at = p_now
  WHERE id = v_row.id
  RETURNING request_count, cooldown_until INTO v_new_count, cooldown_until;

  RETURN QUERY
  SELECT
    true,
    NULL::TEXT,
    NULL::INTEGER,
    GREATEST(0, p_limit - v_new_count),
    v_reset_at,
    cooldown_until;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.consume_abuse_subject(TEXT, TEXT, TEXT, INTEGER, INTEGER, INTEGER, TIMESTAMPTZ)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.consume_abuse_subject(TEXT, TEXT, TEXT, INTEGER, INTEGER, INTEGER, TIMESTAMPTZ)
  TO service_role;

CREATE OR REPLACE FUNCTION public.consume_abuse_protection(
  p_profile_key TEXT,
  p_endpoint_name TEXT,
  p_user_id UUID DEFAULT NULL,
  p_ip_address TEXT DEFAULT NULL,
  p_email_target TEXT DEFAULT NULL,
  p_request_id UUID DEFAULT gen_random_uuid(),
  p_metadata JSONB DEFAULT '{}'::jsonb
)
RETURNS TABLE(
  allowed BOOLEAN,
  code TEXT,
  retry_after_seconds INTEGER,
  matched_profile TEXT,
  limit_user INTEGER,
  remaining_user INTEGER,
  reset_user_at TIMESTAMPTZ,
  limit_ip INTEGER,
  remaining_ip INTEGER,
  reset_ip_at TIMESTAMPTZ,
  limit_email INTEGER,
  remaining_email INTEGER,
  reset_email_at TIMESTAMPTZ,
  cooldown_until TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_config public.abuse_protection_config%ROWTYPE;
  v_override public.abuse_limit_overrides%ROWTYPE;
  v_now TIMESTAMPTZ := now();
  v_effective_user_limit INTEGER;
  v_effective_user_window INTEGER;
  v_effective_cooldown INTEGER;
  v_email_result RECORD;
  v_user_result RECORD;
  v_ip_result RECORD;
  v_event_type TEXT;
  v_code TEXT;
  v_retry_after INTEGER;
  v_cooldown_until TIMESTAMPTZ;
  v_severity TEXT;
  v_email_target TEXT := CASE
    WHEN p_email_target IS NULL OR trim(p_email_target) = '' THEN NULL
    ELSE lower(trim(p_email_target))
  END;
BEGIN
  SELECT *
  INTO v_config
  FROM public.abuse_protection_config
  WHERE profile_key = p_profile_key
    AND enabled = true;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'abuse protection profile % is not configured', p_profile_key
      USING ERRCODE = '22023';
  END IF;

  IF p_user_id IS NOT NULL THEN
    SELECT *
    INTO v_override
    FROM public.abuse_limit_overrides
    WHERE user_id = p_user_id
      AND profile_key = p_profile_key
      AND expires_at > v_now
    ORDER BY expires_at DESC
    LIMIT 1;
  END IF;

  v_effective_user_limit := COALESCE(v_override.user_limit, v_config.user_limit);
  v_effective_user_window := COALESCE(v_override.user_window_seconds, v_config.user_window_seconds);
  v_effective_cooldown := COALESCE(v_override.cooldown_seconds, v_config.cooldown_seconds);
  v_severity := v_config.severity;

  IF v_email_target IS NOT NULL AND v_config.email_limit IS NOT NULL THEN
    SELECT *
    INTO v_email_result
    FROM public.consume_abuse_subject(
      p_profile_key,
      'email_target',
      v_email_target,
      v_config.email_limit,
      v_config.email_window_seconds,
      v_effective_cooldown,
      v_now
    );

    IF NOT COALESCE(v_email_result.allowed, true) THEN
      v_event_type := CASE
        WHEN v_email_result.blocked_reason = 'cooldown_active' THEN 'blocked_cooldown'
        ELSE 'blocked_limit'
      END;
      v_code := CASE
        WHEN v_email_result.blocked_reason = 'cooldown_active' THEN 'cooldown_active'
        ELSE 'rate_limit_exceeded'
      END;
      v_retry_after := v_email_result.retry_after_seconds;
      v_cooldown_until := v_email_result.cooldown_until;

      PERFORM public.record_abuse_event(
        p_event_type => v_event_type,
        p_endpoint_name => p_endpoint_name,
        p_code => v_code,
        p_request_id => p_request_id,
        p_severity => v_severity,
        p_profile_key => p_profile_key,
        p_user_id => p_user_id,
        p_ip_address => p_ip_address,
        p_email_target => v_email_target,
        p_retry_after_seconds => v_retry_after,
        p_metadata => COALESCE(p_metadata, '{}'::jsonb) || jsonb_build_object('subject_type', 'email_target')
      );

      RETURN QUERY
      SELECT
        false,
        v_code,
        v_retry_after,
        p_profile_key,
        v_effective_user_limit,
        NULL::INTEGER,
        NULL::TIMESTAMPTZ,
        v_config.ip_limit,
        NULL::INTEGER,
        NULL::TIMESTAMPTZ,
        v_config.email_limit,
        0,
        v_email_result.reset_at,
        v_cooldown_until;
      RETURN;
    END IF;
  END IF;

  IF p_user_id IS NOT NULL AND v_effective_user_limit IS NOT NULL THEN
    SELECT *
    INTO v_user_result
    FROM public.consume_abuse_subject(
      p_profile_key,
      'user',
      p_user_id::TEXT,
      v_effective_user_limit,
      v_effective_user_window,
      v_effective_cooldown,
      v_now
    );

    IF NOT COALESCE(v_user_result.allowed, true) THEN
      v_event_type := CASE
        WHEN v_user_result.blocked_reason = 'cooldown_active' THEN 'blocked_cooldown'
        ELSE 'blocked_limit'
      END;
      v_code := CASE
        WHEN v_user_result.blocked_reason = 'cooldown_active' THEN 'cooldown_active'
        ELSE 'rate_limit_exceeded'
      END;
      v_retry_after := v_user_result.retry_after_seconds;
      v_cooldown_until := v_user_result.cooldown_until;

      PERFORM public.record_abuse_event(
        p_event_type => v_event_type,
        p_endpoint_name => p_endpoint_name,
        p_code => v_code,
        p_request_id => p_request_id,
        p_severity => v_severity,
        p_profile_key => p_profile_key,
        p_user_id => p_user_id,
        p_ip_address => p_ip_address,
        p_email_target => v_email_target,
        p_retry_after_seconds => v_retry_after,
        p_metadata => COALESCE(p_metadata, '{}'::jsonb) || jsonb_build_object('subject_type', 'user')
      );

      RETURN QUERY
      SELECT
        false,
        v_code,
        v_retry_after,
        p_profile_key,
        v_effective_user_limit,
        0,
        v_user_result.reset_at,
        v_config.ip_limit,
        NULL::INTEGER,
        NULL::TIMESTAMPTZ,
        v_config.email_limit,
        CASE WHEN v_email_result.allowed IS TRUE THEN v_email_result.remaining ELSE NULL END,
        CASE WHEN v_email_result.allowed IS TRUE THEN v_email_result.reset_at ELSE NULL END,
        v_cooldown_until;
      RETURN;
    END IF;
  END IF;

  IF p_ip_address IS NOT NULL AND trim(p_ip_address) <> '' AND v_config.ip_limit IS NOT NULL THEN
    SELECT *
    INTO v_ip_result
    FROM public.consume_abuse_subject(
      p_profile_key,
      'ip',
      trim(p_ip_address),
      v_config.ip_limit,
      v_config.ip_window_seconds,
      v_effective_cooldown,
      v_now
    );

    IF NOT COALESCE(v_ip_result.allowed, true) THEN
      v_event_type := CASE
        WHEN v_ip_result.blocked_reason = 'cooldown_active' THEN 'blocked_cooldown'
        ELSE 'blocked_limit'
      END;
      v_code := CASE
        WHEN v_ip_result.blocked_reason = 'cooldown_active' THEN 'cooldown_active'
        ELSE 'rate_limit_exceeded'
      END;
      v_retry_after := v_ip_result.retry_after_seconds;
      v_cooldown_until := v_ip_result.cooldown_until;

      PERFORM public.record_abuse_event(
        p_event_type => v_event_type,
        p_endpoint_name => p_endpoint_name,
        p_code => v_code,
        p_request_id => p_request_id,
        p_severity => v_severity,
        p_profile_key => p_profile_key,
        p_user_id => p_user_id,
        p_ip_address => p_ip_address,
        p_email_target => v_email_target,
        p_retry_after_seconds => v_retry_after,
        p_metadata => COALESCE(p_metadata, '{}'::jsonb) || jsonb_build_object('subject_type', 'ip')
      );

      RETURN QUERY
      SELECT
        false,
        v_code,
        v_retry_after,
        p_profile_key,
        v_effective_user_limit,
        CASE WHEN v_user_result.allowed IS TRUE THEN v_user_result.remaining ELSE NULL END,
        CASE WHEN v_user_result.allowed IS TRUE THEN v_user_result.reset_at ELSE NULL END,
        v_config.ip_limit,
        0,
        v_ip_result.reset_at,
        v_config.email_limit,
        CASE WHEN v_email_result.allowed IS TRUE THEN v_email_result.remaining ELSE NULL END,
        CASE WHEN v_email_result.allowed IS TRUE THEN v_email_result.reset_at ELSE NULL END,
        v_cooldown_until;
      RETURN;
    END IF;
  END IF;

  RETURN QUERY
  SELECT
    true,
    'allowed'::TEXT,
    NULL::INTEGER,
    p_profile_key,
    v_effective_user_limit,
    CASE WHEN v_user_result.allowed IS TRUE THEN v_user_result.remaining ELSE NULL END,
    CASE WHEN v_user_result.allowed IS TRUE THEN v_user_result.reset_at ELSE NULL END,
    v_config.ip_limit,
    CASE WHEN v_ip_result.allowed IS TRUE THEN v_ip_result.remaining ELSE NULL END,
    CASE WHEN v_ip_result.allowed IS TRUE THEN v_ip_result.reset_at ELSE NULL END,
    v_config.email_limit,
    CASE WHEN v_email_result.allowed IS TRUE THEN v_email_result.remaining ELSE NULL END,
    CASE WHEN v_email_result.allowed IS TRUE THEN v_email_result.reset_at ELSE NULL END,
    COALESCE(v_user_result.cooldown_until, v_ip_result.cooldown_until, v_email_result.cooldown_until);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.consume_abuse_protection(TEXT, TEXT, UUID, TEXT, TEXT, UUID, JSONB)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.consume_abuse_protection(TEXT, TEXT, UUID, TEXT, TEXT, UUID, JSONB)
  TO service_role;

-- ---------------------------------------------------------------------------
-- Admin-facing rollup view.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE VIEW public.abuse_recent_patterns
WITH (security_invoker = true) AS
WITH recent AS (
  SELECT *
  FROM public.abuse_events
  WHERE created_at >= now() - INTERVAL '24 hours'
)
SELECT
  'blocked_by_ip'::TEXT AS pattern_type,
  profile_key,
  endpoint_name,
  ip_address AS subject_key,
  count(*)::BIGINT AS event_count,
  count(DISTINCT user_id)::BIGINT AS distinct_user_count,
  min(created_at) AS first_seen_at,
  max(created_at) AS last_seen_at,
  array_remove(array_agg(DISTINCT code), NULL) AS codes
FROM recent
WHERE ip_address IS NOT NULL
GROUP BY profile_key, endpoint_name, ip_address
HAVING count(*) >= 3

UNION ALL

SELECT
  'blocked_by_user'::TEXT AS pattern_type,
  profile_key,
  endpoint_name,
  user_id::TEXT AS subject_key,
  count(*)::BIGINT AS event_count,
  1::BIGINT AS distinct_user_count,
  min(created_at) AS first_seen_at,
  max(created_at) AS last_seen_at,
  array_remove(array_agg(DISTINCT code), NULL) AS codes
FROM recent
WHERE user_id IS NOT NULL
GROUP BY profile_key, endpoint_name, user_id
HAVING count(*) >= 3

UNION ALL

SELECT
  'auth_email_target'::TEXT AS pattern_type,
  profile_key,
  endpoint_name,
  email_target AS subject_key,
  count(*)::BIGINT AS event_count,
  count(DISTINCT user_id)::BIGINT AS distinct_user_count,
  min(created_at) AS first_seen_at,
  max(created_at) AS last_seen_at,
  array_remove(array_agg(DISTINCT code), NULL) AS codes
FROM recent
WHERE email_target IS NOT NULL
  AND (profile_key LIKE 'auth.%' OR profile_key = 'email.send')
GROUP BY profile_key, endpoint_name, email_target
HAVING count(*) >= 2

UNION ALL

SELECT
  'ip_multi_user'::TEXT AS pattern_type,
  NULL::TEXT AS profile_key,
  NULL::TEXT AS endpoint_name,
  ip_address AS subject_key,
  count(*)::BIGINT AS event_count,
  count(DISTINCT user_id)::BIGINT AS distinct_user_count,
  min(created_at) AS first_seen_at,
  max(created_at) AS last_seen_at,
  array_remove(array_agg(DISTINCT code), NULL) AS codes
FROM recent
WHERE ip_address IS NOT NULL
GROUP BY ip_address
HAVING count(DISTINCT user_id) >= 3 AND count(*) >= 3;

GRANT SELECT ON public.abuse_recent_patterns TO authenticated;

-- ---------------------------------------------------------------------------
-- Seed configurable profiles.
-- ---------------------------------------------------------------------------
INSERT INTO public.abuse_protection_config (
  profile_key,
  description,
  user_limit,
  user_window_seconds,
  ip_limit,
  ip_window_seconds,
  email_limit,
  email_window_seconds,
  cooldown_seconds,
  severity
) VALUES
  ('auth.sign_in', 'Password and native sign-in attempts', 5, 600, 20, 600, NULL, NULL, 900, 'high'),
  ('auth.sign_up', 'Password sign-up attempts', NULL, NULL, 10, 3600, 3, 3600, 3600, 'high'),
  ('auth.reset_password', 'Password reset email requests', NULL, NULL, 10, 3600, 2, 3600, 3600, 'high'),
  ('ai.standard', 'Standard AI generation/chat endpoints', 20, 900, 60, 900, NULL, NULL, 600, 'medium'),
  ('ai.expensive_export', 'Expensive AI media or export-like generation endpoints', 5, 1800, 15, 1800, NULL, NULL, 1800, 'high'),
  ('upload.attachments', 'Quest attachment upload initialization', 20, 600, 50, 600, NULL, NULL, 900, 'medium'),
  ('invite', 'Referral, promo, and invite redemption flows', 10, 600, 25, 600, NULL, NULL, 900, 'high'),
  ('email.send', 'Backend-owned outbound email sends', NULL, NULL, 10, 3600, 3, 3600, 43200, 'high')
ON CONFLICT (profile_key) DO UPDATE
SET
  description = EXCLUDED.description,
  user_limit = EXCLUDED.user_limit,
  user_window_seconds = EXCLUDED.user_window_seconds,
  ip_limit = EXCLUDED.ip_limit,
  ip_window_seconds = EXCLUDED.ip_window_seconds,
  email_limit = EXCLUDED.email_limit,
  email_window_seconds = EXCLUDED.email_window_seconds,
  cooldown_seconds = EXCLUDED.cooldown_seconds,
  severity = EXCLUDED.severity,
  enabled = true,
  updated_at = now();

-- ---------------------------------------------------------------------------
-- Harden invite-side RPCs and move epic join-by-code to the backend.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.apply_referral_code_secure(
  p_user_id UUID,
  p_referral_code TEXT
)
RETURNS TABLE(success BOOLEAN, message TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_code_record RECORD;
  v_referrer_id UUID;
  v_already_referred BOOLEAN;
  v_abuse RECORD;
  v_request_id UUID := gen_random_uuid();
  v_request_ip TEXT := public.get_request_ip_address();
BEGIN
  IF auth.uid() IS NULL OR auth.uid() <> p_user_id THEN
    PERFORM public.record_abuse_event(
      p_event_type => 'bypass_attempt',
      p_endpoint_name => 'apply_referral_code_secure',
      p_code => 'user_mismatch',
      p_request_id => v_request_id,
      p_severity => 'high',
      p_profile_key => 'invite',
      p_user_id => auth.uid(),
      p_ip_address => v_request_ip,
      p_metadata => jsonb_build_object('requested_user_id', p_user_id)
    );

    RAISE EXCEPTION 'Cannot apply a referral code for another user'
      USING ERRCODE = '42501';
  END IF;

  SELECT *
  INTO v_abuse
  FROM public.consume_abuse_protection(
    p_profile_key => 'invite',
    p_endpoint_name => 'apply_referral_code_secure',
    p_user_id => p_user_id,
    p_ip_address => v_request_ip,
    p_request_id => v_request_id,
    p_metadata => jsonb_build_object('flow', 'apply_referral_code_secure')
  );

  IF NOT COALESCE(v_abuse.allowed, true) THEN
    RETURN QUERY
    SELECT false, 'Too many invite attempts. Please try again later.'::TEXT;
    RETURN;
  END IF;

  SELECT rc.id, rc.code, rc.owner_type, rc.owner_user_id, rc.is_active
  INTO v_code_record
  FROM public.referral_codes rc
  WHERE UPPER(rc.code) = UPPER(p_referral_code)
    AND rc.is_active = true
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN QUERY SELECT false AS success, 'Invalid referral code'::TEXT AS message;
    RETURN;
  END IF;

  IF v_code_record.owner_type = 'user' AND v_code_record.owner_user_id = p_user_id THEN
    RETURN QUERY SELECT false AS success, 'Cannot use your own referral code'::TEXT AS message;
    RETURN;
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE id = p_user_id
      AND referred_by_code IS NOT NULL
  ) INTO v_already_referred;

  IF v_already_referred THEN
    RETURN QUERY SELECT false AS success, 'You have already used a referral code'::TEXT AS message;
    RETURN;
  END IF;

  v_referrer_id := v_code_record.owner_user_id;

  UPDATE public.profiles
  SET
    referred_by_code = UPPER(p_referral_code),
    referred_by = v_referrer_id
  WHERE id = p_user_id;

  IF v_code_record.owner_type = 'user' AND v_referrer_id IS NOT NULL THEN
    UPDATE public.profiles
    SET referral_count = COALESCE(referral_count, 0) + 1
    WHERE id = v_referrer_id;
  END IF;

  IF v_code_record.owner_type = 'influencer' THEN
    UPDATE public.referral_codes
    SET total_signups = COALESCE(total_signups, 0) + 1
    WHERE id = v_code_record.id;
  END IF;

  RETURN QUERY SELECT true AS success, 'Referral code applied successfully'::TEXT AS message;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.apply_referral_code_secure(UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.apply_referral_code_secure(UUID, TEXT) TO authenticated;

CREATE OR REPLACE FUNCTION public.redeem_promo_code_secure(
  p_user_id UUID,
  p_promo_code TEXT
)
RETURNS TABLE(success BOOLEAN, status TEXT, message TEXT, access_expires_at TIMESTAMPTZ)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_now TIMESTAMPTZ := NOW();
  v_code TEXT := UPPER(TRIM(COALESCE(p_promo_code, '')));
  v_promo RECORD;
  v_existing_redemption RECORD;
  v_granted_until TIMESTAMPTZ;
  v_active_subscription RECORD;
  v_abuse RECORD;
  v_request_id UUID := gen_random_uuid();
  v_request_ip TEXT := public.get_request_ip_address();
BEGIN
  IF auth.uid() IS NULL OR auth.uid() <> p_user_id THEN
    PERFORM public.record_abuse_event(
      p_event_type => 'bypass_attempt',
      p_endpoint_name => 'redeem_promo_code_secure',
      p_code => 'user_mismatch',
      p_request_id => v_request_id,
      p_severity => 'high',
      p_profile_key => 'invite',
      p_user_id => auth.uid(),
      p_ip_address => v_request_ip,
      p_metadata => jsonb_build_object('requested_user_id', p_user_id)
    );

    RETURN QUERY SELECT false, 'unauthorized'::TEXT, 'Unauthorized request'::TEXT, NULL::TIMESTAMPTZ;
    RETURN;
  END IF;

  SELECT *
  INTO v_abuse
  FROM public.consume_abuse_protection(
    p_profile_key => 'invite',
    p_endpoint_name => 'redeem_promo_code_secure',
    p_user_id => p_user_id,
    p_ip_address => v_request_ip,
    p_request_id => v_request_id,
    p_metadata => jsonb_build_object('flow', 'redeem_promo_code_secure')
  );

  IF NOT COALESCE(v_abuse.allowed, true) THEN
    RETURN QUERY SELECT false, 'rate_limited'::TEXT, 'Too many promo redemption attempts. Please try again later.'::TEXT, NULL::TIMESTAMPTZ;
    RETURN;
  END IF;

  IF v_code = '' THEN
    RETURN QUERY SELECT false, 'invalid'::TEXT, 'Enter a valid promo code'::TEXT, NULL::TIMESTAMPTZ;
    RETURN;
  END IF;

  SELECT id, granted_until
  INTO v_existing_redemption
  FROM public.promo_code_redemptions
  WHERE user_id = p_user_id
  LIMIT 1;

  IF FOUND THEN
    RETURN QUERY SELECT
      false,
      'used'::TEXT,
      'A promo code has already been redeemed for this account'::TEXT,
      v_existing_redemption.granted_until;
    RETURN;
  END IF;

  SELECT id
  INTO v_active_subscription
  FROM public.subscriptions
  WHERE user_id = p_user_id
    AND status IN ('active', 'trialing')
    AND current_period_end > v_now
    AND COALESCE(source, 'receipt') <> 'promo_code'
  LIMIT 1;

  IF FOUND THEN
    RETURN QUERY SELECT
      false,
      'already_active'::TEXT,
      'Your account already has an active subscription'::TEXT,
      NULL::TIMESTAMPTZ;
    RETURN;
  END IF;

  SELECT *
  INTO v_promo
  FROM public.promo_codes
  WHERE code = v_code
  FOR UPDATE;

  IF NOT FOUND OR v_promo.is_active IS NOT TRUE THEN
    RETURN QUERY SELECT false, 'invalid'::TEXT, 'Invalid promo code'::TEXT, NULL::TIMESTAMPTZ;
    RETURN;
  END IF;

  IF v_promo.expires_at IS NOT NULL AND v_promo.expires_at < v_now THEN
    RETURN QUERY SELECT false, 'expired'::TEXT, 'This promo code has expired'::TEXT, NULL::TIMESTAMPTZ;
    RETURN;
  END IF;

  IF v_promo.max_redemptions IS NOT NULL AND v_promo.redeemed_count >= v_promo.max_redemptions THEN
    RETURN QUERY SELECT false, 'used'::TEXT, 'This promo code has reached its redemption limit'::TEXT, NULL::TIMESTAMPTZ;
    RETURN;
  END IF;

  v_granted_until := v_now + make_interval(days => GREATEST(COALESCE(v_promo.grant_days, 30), 1));

  INSERT INTO public.promo_code_redemptions (
    promo_code_id,
    user_id,
    redeemed_code,
    redeemed_at,
    granted_until
  ) VALUES (
    v_promo.id,
    p_user_id,
    v_code,
    v_now,
    v_granted_until
  );

  UPDATE public.promo_codes
  SET
    redeemed_count = redeemed_count + 1,
    updated_at = v_now
  WHERE id = v_promo.id;

  RETURN QUERY SELECT true, 'success'::TEXT, 'Promo code applied successfully'::TEXT, v_granted_until;
EXCEPTION
  WHEN unique_violation THEN
    RETURN QUERY SELECT false, 'used'::TEXT, 'A promo code has already been redeemed for this account'::TEXT, NULL::TIMESTAMPTZ;
END;
$$;

GRANT EXECUTE ON FUNCTION public.redeem_promo_code_secure(UUID, TEXT) TO authenticated;

CREATE OR REPLACE FUNCTION public.join_epic_by_invite_code(p_invite_code TEXT)
RETURNS TABLE(
  success BOOLEAN,
  code TEXT,
  message TEXT,
  epic_id UUID,
  epic_title TEXT,
  copied_habit_count INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_code TEXT := UPPER(TRIM(COALESCE(p_invite_code, '')));
  v_epic public.epics%ROWTYPE;
  v_existing_member BOOLEAN;
  v_inserted_count INTEGER := 0;
  v_request_id UUID := gen_random_uuid();
  v_request_ip TEXT := public.get_request_ip_address();
  v_abuse RECORD;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN QUERY SELECT false, 'unauthorized'::TEXT, 'Not authenticated'::TEXT, NULL::UUID, NULL::TEXT, 0;
    RETURN;
  END IF;

  SELECT *
  INTO v_abuse
  FROM public.consume_abuse_protection(
    p_profile_key => 'invite',
    p_endpoint_name => 'join_epic_by_invite_code',
    p_user_id => v_user_id,
    p_ip_address => v_request_ip,
    p_request_id => v_request_id,
    p_metadata => jsonb_build_object('flow', 'join_epic_by_invite_code')
  );

  IF NOT COALESCE(v_abuse.allowed, true) THEN
    RETURN QUERY SELECT false, 'rate_limited'::TEXT, 'Too many invite attempts. Please try again later.'::TEXT, NULL::UUID, NULL::TEXT, 0;
    RETURN;
  END IF;

  IF v_code = '' THEN
    RETURN QUERY SELECT false, 'invalid'::TEXT, 'Invite code is required'::TEXT, NULL::UUID, NULL::TEXT, 0;
    RETURN;
  END IF;

  IF v_code NOT LIKE 'EPIC-%' THEN
    v_code := 'EPIC-' || regexp_replace(v_code, '^EPIC-', '', 'i');
  END IF;

  SELECT *
  INTO v_epic
  FROM public.epics
  WHERE invite_code = v_code
    AND is_public = true
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN QUERY SELECT false, 'invalid'::TEXT, 'Epic not found'::TEXT, NULL::UUID, NULL::TEXT, 0;
    RETURN;
  END IF;

  IF v_epic.user_id = v_user_id THEN
    RETURN QUERY SELECT false, 'already_member'::TEXT, 'You already own this epic'::TEXT, v_epic.id, v_epic.title, 0;
    RETURN;
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM public.epic_members
    WHERE epic_id = v_epic.id
      AND user_id = v_user_id
  )
  INTO v_existing_member;

  IF v_existing_member THEN
    RETURN QUERY SELECT false, 'already_member'::TEXT, 'You are already in this guild'::TEXT, v_epic.id, v_epic.title, 0;
    RETURN;
  END IF;

  IF public.count_user_epics(v_user_id) >= 3 THEN
    RETURN QUERY SELECT false, 'epic_limit_reached'::TEXT, 'You can only have 3 active epics at a time'::TEXT, v_epic.id, v_epic.title, 0;
    RETURN;
  END IF;

  INSERT INTO public.epic_members (epic_id, user_id)
  VALUES (v_epic.id, v_user_id);

  WITH source_habits AS (
    SELECT h.*
    FROM public.epic_habits eh
    JOIN public.habits h ON h.id = eh.habit_id
    WHERE eh.epic_id = v_epic.id
  ),
  inserted_habits AS (
    INSERT INTO public.habits (
      user_id,
      title,
      difficulty,
      frequency,
      custom_days,
      custom_month_days,
      category,
      description,
      estimated_minutes,
      preferred_time,
      reminder_enabled,
      reminder_minutes_before,
      reminder_sent_today,
      is_active,
      sort_order,
      current_streak,
      longest_streak
    )
    SELECT
      v_user_id,
      sh.title,
      sh.difficulty,
      sh.frequency,
      sh.custom_days,
      sh.custom_month_days,
      sh.category,
      sh.description,
      sh.estimated_minutes,
      sh.preferred_time,
      sh.reminder_enabled,
      sh.reminder_minutes_before,
      false,
      COALESCE(sh.is_active, true),
      sh.sort_order,
      0,
      0
    FROM source_habits sh
    RETURNING id
  ),
  inserted_links AS (
    INSERT INTO public.epic_habits (epic_id, habit_id)
    SELECT v_epic.id, ih.id
    FROM inserted_habits ih
    RETURNING habit_id
  )
  SELECT count(*) INTO v_inserted_count FROM inserted_links;

  RETURN QUERY SELECT true, 'joined'::TEXT, 'Joined epic successfully'::TEXT, v_epic.id, v_epic.title, COALESCE(v_inserted_count, 0);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.join_epic_by_invite_code(TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.join_epic_by_invite_code(TEXT) TO authenticated;

-- ---------------------------------------------------------------------------
-- Stop direct client writes/deletes to quest attachments; signed URLs will be
-- issued server-side and deletions will go through an edge function.
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Users can upload quest attachments" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete quest attachments" ON storage.objects;

-- ---------------------------------------------------------------------------
-- Ensure PostgREST notices the new RPCs immediately.
-- ---------------------------------------------------------------------------
NOTIFY pgrst, 'reload schema';
