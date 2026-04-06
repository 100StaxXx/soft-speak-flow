-- Fix ambiguity between the RETURNS TABLE output column and the window row column.
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
  v_cooldown_until TIMESTAMPTZ;
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
    UPDATE public.abuse_counter_windows AS counter_window
    SET
      cooldown_until = CASE
        WHEN p_cooldown_seconds > 0 THEN GREATEST(
          COALESCE(counter_window.cooldown_until, p_now),
          p_now + make_interval(secs => p_cooldown_seconds)
        )
        ELSE counter_window.cooldown_until
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

  UPDATE public.abuse_counter_windows AS counter_window
  SET
    request_count = counter_window.request_count + 1,
    last_request_at = p_now,
    updated_at = p_now
  WHERE id = v_row.id
  RETURNING counter_window.request_count, counter_window.cooldown_until
  INTO v_new_count, v_cooldown_until;

  RETURN QUERY
  SELECT
    true,
    NULL::TEXT,
    NULL::INTEGER,
    GREATEST(0, p_limit - v_new_count),
    v_reset_at,
    v_cooldown_until;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.consume_abuse_subject(TEXT, TEXT, TEXT, INTEGER, INTEGER, INTEGER, TIMESTAMPTZ)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.consume_abuse_subject(TEXT, TEXT, TEXT, INTEGER, INTEGER, INTEGER, TIMESTAMPTZ)
  TO service_role;
