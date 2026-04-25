CREATE TABLE IF NOT EXISTS public.pep_talk_generation_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_key text NOT NULL,
  mentor_slug text NOT NULL,
  for_date date NOT NULL,
  started_by_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'in_progress',
  response_payload jsonb,
  error_message text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  expires_at timestamp with time zone NOT NULL DEFAULT (now() + interval '30 minutes'),
  CONSTRAINT pep_talk_generation_requests_status_check
    CHECK (status IN ('in_progress', 'completed', 'failed')),
  CONSTRAINT pep_talk_generation_requests_key_not_blank
    CHECK (btrim(request_key) <> ''),
  CONSTRAINT pep_talk_generation_requests_mentor_not_blank
    CHECK (btrim(mentor_slug) <> '')
);

CREATE UNIQUE INDEX IF NOT EXISTS pep_talk_generation_requests_key_idx
  ON public.pep_talk_generation_requests(request_key);

CREATE INDEX IF NOT EXISTS pep_talk_generation_requests_mentor_date_idx
  ON public.pep_talk_generation_requests(mentor_slug, for_date);

CREATE INDEX IF NOT EXISTS pep_talk_generation_requests_cleanup_idx
  ON public.pep_talk_generation_requests(expires_at);

ALTER TABLE public.pep_talk_generation_requests ENABLE ROW LEVEL SECURITY;

DROP INDEX IF EXISTS public.idx_user_daily_pushes_user_pep_unique;

WITH ranked_daily_pep_talks AS (
  SELECT
    id,
    first_value(id) OVER (
      PARTITION BY mentor_slug, for_date
      ORDER BY created_at DESC, id DESC
    ) AS canonical_id,
    row_number() OVER (
      PARTITION BY mentor_slug, for_date
      ORDER BY created_at DESC, id DESC
    ) AS row_rank
  FROM public.daily_pep_talks
)
UPDATE public.user_daily_pushes AS pushes
SET daily_pep_talk_id = ranked_daily_pep_talks.canonical_id
FROM ranked_daily_pep_talks
WHERE pushes.daily_pep_talk_id = ranked_daily_pep_talks.id
  AND ranked_daily_pep_talks.row_rank > 1;

WITH ranked_daily_pep_talks AS (
  SELECT
    id,
    row_number() OVER (
      PARTITION BY mentor_slug, for_date
      ORDER BY created_at DESC, id DESC
    ) AS row_rank
  FROM public.daily_pep_talks
)
DELETE FROM public.daily_pep_talks AS daily_pep_talks
USING ranked_daily_pep_talks
WHERE daily_pep_talks.id = ranked_daily_pep_talks.id
  AND ranked_daily_pep_talks.row_rank > 1;

WITH ranked_user_daily_pushes AS (
  SELECT
    id,
    row_number() OVER (
      PARTITION BY user_id, daily_pep_talk_id
      ORDER BY created_at DESC, id DESC
    ) AS row_rank
  FROM public.user_daily_pushes
)
DELETE FROM public.user_daily_pushes AS pushes
USING ranked_user_daily_pushes
WHERE pushes.id = ranked_user_daily_pushes.id
  AND ranked_user_daily_pushes.row_rank > 1;

CREATE UNIQUE INDEX IF NOT EXISTS idx_user_daily_pushes_user_pep_unique
  ON public.user_daily_pushes(user_id, daily_pep_talk_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_daily_pep_talks_mentor_date_unique
  ON public.daily_pep_talks(mentor_slug, for_date);

CREATE OR REPLACE FUNCTION public.begin_pep_talk_generation_request(
  p_request_key text,
  p_mentor_slug text,
  p_for_date date,
  p_started_by_user_id uuid DEFAULT NULL,
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
  v_request public.pep_talk_generation_requests%ROWTYPE;
BEGIN
  IF p_request_key IS NULL OR btrim(p_request_key) = '' THEN
    RAISE EXCEPTION 'request_key is required';
  END IF;

  IF p_mentor_slug IS NULL OR btrim(p_mentor_slug) = '' OR p_for_date IS NULL THEN
    RAISE EXCEPTION 'mentor_slug and for_date are required';
  END IF;

  DELETE FROM public.pep_talk_generation_requests
  WHERE expires_at <= now();

  INSERT INTO public.pep_talk_generation_requests (
    request_key,
    mentor_slug,
    for_date,
    started_by_user_id,
    status,
    expires_at
  ) VALUES (
    btrim(p_request_key),
    btrim(p_mentor_slug),
    p_for_date,
    p_started_by_user_id,
    'in_progress',
    now() + p_expires_after
  )
  ON CONFLICT (request_key) DO NOTHING
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
  FROM public.pep_talk_generation_requests
  WHERE request_key = btrim(p_request_key)
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

  UPDATE public.pep_talk_generation_requests
  SET
    mentor_slug = btrim(p_mentor_slug),
    for_date = p_for_date,
    started_by_user_id = p_started_by_user_id,
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

CREATE OR REPLACE FUNCTION public.complete_pep_talk_generation_request(
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
  IF p_request_key IS NULL OR btrim(p_request_key) = '' THEN
    RAISE EXCEPTION 'request_key is required';
  END IF;

  IF p_status NOT IN ('completed', 'failed') THEN
    RAISE EXCEPTION 'invalid pep talk generation request status: %', p_status;
  END IF;

  UPDATE public.pep_talk_generation_requests
  SET
    status = p_status,
    response_payload = CASE WHEN p_status = 'completed' THEN p_response_payload ELSE NULL END,
    error_message = CASE WHEN p_status = 'failed' THEN p_error_message ELSE NULL END,
    updated_at = now(),
    expires_at = now() + p_expires_after
  WHERE request_key = btrim(p_request_key);
END;
$function$;

REVOKE ALL ON public.pep_talk_generation_requests FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.begin_pep_talk_generation_request(text, text, date, uuid, interval, interval) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.complete_pep_talk_generation_request(text, text, jsonb, text, interval) FROM PUBLIC, anon, authenticated;

GRANT ALL ON public.pep_talk_generation_requests TO service_role;
GRANT EXECUTE ON FUNCTION public.begin_pep_talk_generation_request(text, text, date, uuid, interval, interval) TO service_role;
GRANT EXECUTE ON FUNCTION public.complete_pep_talk_generation_request(text, text, jsonb, text, interval) TO service_role;
