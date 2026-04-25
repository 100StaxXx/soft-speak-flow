ALTER TABLE public.companion_image_generation_requests
  ALTER COLUMN expires_at SET DEFAULT (now() + interval '30 minutes');

CREATE OR REPLACE FUNCTION public.begin_companion_image_generation_request(
  p_user_id uuid,
  p_request_key text,
  p_stale_after interval DEFAULT interval '3 minutes',
  p_expires_after interval DEFAULT interval '30 minutes'
)
RETURNS TABLE(
  action text,
  status text,
  response_payload jsonb,
  error_message text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_request public.companion_image_generation_requests%ROWTYPE;
BEGIN
  IF p_user_id IS NULL OR p_request_key IS NULL OR btrim(p_request_key) = '' THEN
    RAISE EXCEPTION 'user_id and request_key are required';
  END IF;

  DELETE FROM public.companion_image_generation_requests
  WHERE expires_at <= now();

  INSERT INTO public.companion_image_generation_requests (
    user_id,
    request_key,
    status,
    expires_at
  ) VALUES (
    p_user_id,
    btrim(p_request_key),
    'in_progress',
    now() + p_expires_after
  )
  ON CONFLICT (user_id, request_key) DO NOTHING
  RETURNING * INTO v_request;

  IF FOUND THEN
    RETURN QUERY SELECT
      'started'::text,
      v_request.status,
      NULL::jsonb,
      NULL::text;
    RETURN;
  END IF;

  SELECT *
  INTO v_request
  FROM public.companion_image_generation_requests
  WHERE user_id = p_user_id
    AND request_key = btrim(p_request_key)
  FOR UPDATE;

  IF v_request.status = 'completed'
     AND v_request.response_payload IS NOT NULL
     AND v_request.expires_at > now() THEN
    RETURN QUERY SELECT
      'completed'::text,
      v_request.status,
      v_request.response_payload,
      v_request.error_message;
    RETURN;
  END IF;

  IF v_request.status = 'in_progress'
     AND v_request.updated_at > now() - p_stale_after THEN
    RETURN QUERY SELECT
      'in_progress'::text,
      v_request.status,
      NULL::jsonb,
      v_request.error_message;
    RETURN;
  END IF;

  UPDATE public.companion_image_generation_requests
  SET
    status = 'in_progress',
    response_payload = NULL,
    error_message = NULL,
    updated_at = now(),
    expires_at = now() + p_expires_after
  WHERE id = v_request.id;

  RETURN QUERY SELECT
    'started'::text,
    'in_progress'::text,
    NULL::jsonb,
    NULL::text;
END;
$function$;

CREATE OR REPLACE FUNCTION public.complete_companion_image_generation_request(
  p_user_id uuid,
  p_request_key text,
  p_status text,
  p_response_payload jsonb DEFAULT NULL,
  p_error_message text DEFAULT NULL,
  p_expires_after interval DEFAULT interval '30 minutes'
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF p_status NOT IN ('completed', 'failed') THEN
    RAISE EXCEPTION 'invalid companion image request status: %', p_status;
  END IF;

  UPDATE public.companion_image_generation_requests
  SET
    status = p_status,
    response_payload = CASE WHEN p_status = 'completed' THEN p_response_payload ELSE NULL END,
    error_message = CASE WHEN p_status = 'failed' THEN p_error_message ELSE NULL END,
    updated_at = now(),
    expires_at = now() + p_expires_after
  WHERE user_id = p_user_id
    AND request_key = btrim(p_request_key);
END;
$function$;

REVOKE ALL ON FUNCTION public.begin_companion_image_generation_request(uuid, text, interval, interval) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.complete_companion_image_generation_request(uuid, text, text, jsonb, text, interval) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.begin_companion_image_generation_request(uuid, text, interval, interval) TO service_role;
GRANT EXECUTE ON FUNCTION public.complete_companion_image_generation_request(uuid, text, text, jsonb, text, interval) TO service_role;
