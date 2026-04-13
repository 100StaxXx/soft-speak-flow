-- Make native push tokens installation-aware and clean up duplicated notification sources.

ALTER TABLE public.push_device_tokens
  ADD COLUMN IF NOT EXISTS installation_id text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_trigger
    WHERE tgname = 'set_push_device_tokens_updated_at'
      AND tgrelid = 'public.push_device_tokens'::regclass
  ) THEN
    CREATE TRIGGER set_push_device_tokens_updated_at
      BEFORE UPDATE ON public.push_device_tokens
      FOR EACH ROW
      EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
END $$;

WITH ranked_push_rows AS (
  SELECT
    id,
    row_number() OVER (
      PARTITION BY user_id, platform, installation_id
      ORDER BY updated_at DESC NULLS LAST, created_at DESC NULLS LAST, id DESC
    ) AS row_number
  FROM public.push_device_tokens
  WHERE installation_id IS NOT NULL
)
DELETE FROM public.push_device_tokens AS tokens
USING ranked_push_rows AS ranked
WHERE tokens.id = ranked.id
  AND ranked.row_number > 1;

CREATE UNIQUE INDEX IF NOT EXISTS idx_push_device_tokens_user_platform_installation_unique
  ON public.push_device_tokens (user_id, platform, installation_id)
  WHERE installation_id IS NOT NULL;

WITH ranked_user_daily_pushes AS (
  SELECT
    id,
    row_number() OVER (
      PARTITION BY user_id, daily_pep_talk_id
      ORDER BY scheduled_at DESC NULLS LAST, created_at DESC NULLS LAST, id DESC
    ) AS row_number
  FROM public.user_daily_pushes
)
DELETE FROM public.user_daily_pushes AS udp
USING ranked_user_daily_pushes AS ranked
WHERE udp.id = ranked.id
  AND ranked.row_number > 1;

WITH ranked_user_daily_quote_pushes AS (
  SELECT
    id,
    row_number() OVER (
      PARTITION BY user_id, daily_quote_id
      ORDER BY scheduled_at DESC NULLS LAST, created_at DESC NULLS LAST, id DESC
    ) AS row_number
  FROM public.user_daily_quote_pushes
)
DELETE FROM public.user_daily_quote_pushes AS udp
USING ranked_user_daily_quote_pushes AS ranked
WHERE udp.id = ranked.id
  AND ranked.row_number > 1;

CREATE UNIQUE INDEX IF NOT EXISTS idx_user_daily_pushes_user_pep_unique
  ON public.user_daily_pushes(user_id, daily_pep_talk_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_user_daily_quote_pushes_user_quote_unique
  ON public.user_daily_quote_pushes(user_id, daily_quote_id);
