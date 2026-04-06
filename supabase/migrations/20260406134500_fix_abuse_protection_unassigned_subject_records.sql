-- Avoid reading from unassigned RECORD variables when a subject path is skipped.
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
  v_email_remaining INTEGER;
  v_email_reset_at TIMESTAMPTZ;
  v_email_cooldown_until TIMESTAMPTZ;
  v_user_remaining INTEGER;
  v_user_reset_at TIMESTAMPTZ;
  v_user_cooldown_until TIMESTAMPTZ;
  v_ip_remaining INTEGER;
  v_ip_reset_at TIMESTAMPTZ;
  v_ip_cooldown_until TIMESTAMPTZ;
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

    v_email_remaining := CASE WHEN v_email_result.allowed IS TRUE THEN v_email_result.remaining ELSE NULL END;
    v_email_reset_at := CASE WHEN v_email_result.allowed IS TRUE THEN v_email_result.reset_at ELSE NULL END;
    v_email_cooldown_until := v_email_result.cooldown_until;

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

    v_user_remaining := CASE WHEN v_user_result.allowed IS TRUE THEN v_user_result.remaining ELSE NULL END;
    v_user_reset_at := CASE WHEN v_user_result.allowed IS TRUE THEN v_user_result.reset_at ELSE NULL END;
    v_user_cooldown_until := v_user_result.cooldown_until;

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
        v_email_remaining,
        v_email_reset_at,
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

    v_ip_remaining := CASE WHEN v_ip_result.allowed IS TRUE THEN v_ip_result.remaining ELSE NULL END;
    v_ip_reset_at := CASE WHEN v_ip_result.allowed IS TRUE THEN v_ip_result.reset_at ELSE NULL END;
    v_ip_cooldown_until := v_ip_result.cooldown_until;

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
        v_user_remaining,
        v_user_reset_at,
        v_config.ip_limit,
        0,
        v_ip_result.reset_at,
        v_config.email_limit,
        v_email_remaining,
        v_email_reset_at,
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
    v_user_remaining,
    v_user_reset_at,
    v_config.ip_limit,
    v_ip_remaining,
    v_ip_reset_at,
    v_config.email_limit,
    v_email_remaining,
    v_email_reset_at,
    COALESCE(v_user_cooldown_until, v_ip_cooldown_until, v_email_cooldown_until);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.consume_abuse_protection(TEXT, TEXT, UUID, TEXT, TEXT, UUID, JSONB)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.consume_abuse_protection(TEXT, TEXT, UUID, TEXT, TEXT, UUID, JSONB)
  TO service_role;
