-- Ensure each native push installation/device token can only belong to one account at a time,
-- and provide an authenticated RPC that atomically claims the current install for the caller.

WITH ranked_installation_rows AS (
  SELECT
    id,
    row_number() OVER (
      PARTITION BY platform, installation_id
      ORDER BY updated_at DESC NULLS LAST, created_at DESC NULLS LAST, id DESC
    ) AS row_number
  FROM public.push_device_tokens
  WHERE installation_id IS NOT NULL
)
DELETE FROM public.push_device_tokens AS tokens
USING ranked_installation_rows AS ranked
WHERE tokens.id = ranked.id
  AND ranked.row_number > 1;

WITH ranked_device_token_rows AS (
  SELECT
    id,
    row_number() OVER (
      PARTITION BY platform, device_token
      ORDER BY updated_at DESC NULLS LAST, created_at DESC NULLS LAST, id DESC
    ) AS row_number
  FROM public.push_device_tokens
)
DELETE FROM public.push_device_tokens AS tokens
USING ranked_device_token_rows AS ranked
WHERE tokens.id = ranked.id
  AND ranked.row_number > 1;

DROP INDEX IF EXISTS idx_push_device_tokens_user_platform_installation_unique;

CREATE UNIQUE INDEX IF NOT EXISTS idx_push_device_tokens_platform_installation_unique
  ON public.push_device_tokens (platform, installation_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_push_device_tokens_platform_device_token_unique
  ON public.push_device_tokens (platform, device_token);

CREATE INDEX IF NOT EXISTS idx_push_device_tokens_user_platform_installation_lookup
  ON public.push_device_tokens (user_id, platform, installation_id);

DROP FUNCTION IF EXISTS public.claim_push_device_token(text, text, text, text);
CREATE OR REPLACE FUNCTION public.claim_push_device_token(
  p_installation_id text,
  p_device_token text,
  p_platform text,
  p_user_agent text DEFAULT NULL
)
RETURNS public.push_device_tokens
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_installation_id text := NULLIF(btrim(p_installation_id), '');
  v_device_token text := NULLIF(btrim(p_device_token), '');
  v_user_agent text := NULLIF(btrim(p_user_agent), '');
  v_claimed_row public.push_device_tokens;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  IF v_installation_id IS NULL THEN
    RAISE EXCEPTION 'installation_id is required';
  END IF;

  IF v_device_token IS NULL THEN
    RAISE EXCEPTION 'device_token is required';
  END IF;

  IF p_platform NOT IN ('ios', 'android') THEN
    RAISE EXCEPTION 'platform must be ios or android';
  END IF;

  DELETE FROM public.push_device_tokens
  WHERE platform = p_platform
    AND (
      installation_id = v_installation_id
      OR device_token = v_device_token
    )
    AND (
      user_id <> v_user_id
      OR installation_id IS DISTINCT FROM v_installation_id
    );

  INSERT INTO public.push_device_tokens (
    user_id,
    device_token,
    installation_id,
    platform,
    user_agent
  )
  VALUES (
    v_user_id,
    v_device_token,
    v_installation_id,
    p_platform,
    v_user_agent
  )
  ON CONFLICT (platform, installation_id)
  DO UPDATE SET
    user_id = EXCLUDED.user_id,
    device_token = EXCLUDED.device_token,
    user_agent = EXCLUDED.user_agent,
    updated_at = NOW()
  RETURNING * INTO v_claimed_row;

  RETURN v_claimed_row;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_push_device_token(text, text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.claim_push_device_token(text, text, text, text) TO authenticated;
