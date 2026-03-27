-- Restore Notifications V2 as the single source of truth for daily push delivery.
-- This migration aligns the quote delivery tables with the generated client types
-- and hardens natural-key uniqueness before V2 enqueue starts creating source rows.

CREATE TABLE IF NOT EXISTS public.daily_quotes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mentor_slug TEXT NOT NULL,
  quote_id UUID NOT NULL REFERENCES public.quotes(id) ON DELETE CASCADE,
  for_date DATE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.user_daily_quote_pushes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  daily_quote_id UUID NOT NULL REFERENCES public.daily_quotes(id) ON DELETE CASCADE,
  scheduled_at TIMESTAMPTZ NOT NULL,
  delivered_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.daily_quotes
  ADD COLUMN IF NOT EXISTS mentor_slug TEXT,
  ADD COLUMN IF NOT EXISTS quote_id UUID,
  ADD COLUMN IF NOT EXISTS for_date DATE,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now();

ALTER TABLE public.user_daily_quote_pushes
  ADD COLUMN IF NOT EXISTS user_id UUID,
  ADD COLUMN IF NOT EXISTS daily_quote_id UUID,
  ADD COLUMN IF NOT EXISTS scheduled_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS delivered_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now();

UPDATE public.daily_quotes
SET created_at = now()
WHERE created_at IS NULL;

UPDATE public.user_daily_quote_pushes
SET created_at = now()
WHERE created_at IS NULL;

ALTER TABLE public.daily_quotes
  ALTER COLUMN created_at SET DEFAULT now();

ALTER TABLE public.user_daily_quote_pushes
  ALTER COLUMN created_at SET DEFAULT now();

ALTER TABLE public.daily_quotes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_daily_quote_pushes ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'daily_quotes'
      AND policyname = 'Anyone can view daily quotes'
  ) THEN
    CREATE POLICY "Anyone can view daily quotes"
      ON public.daily_quotes
      FOR SELECT
      USING (true);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'daily_quotes'
      AND policyname = 'Admins can manage daily quotes'
  ) THEN
    CREATE POLICY "Admins can manage daily quotes"
      ON public.daily_quotes
      FOR ALL
      USING (has_role(auth.uid(), 'admin'::app_role));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'user_daily_quote_pushes'
      AND policyname = 'Users can view own daily quote pushes'
  ) THEN
    CREATE POLICY "Users can view own daily quote pushes"
      ON public.user_daily_quote_pushes
      FOR SELECT
      USING (auth.uid() = user_id);
  END IF;
END $$;

WITH ranked_daily_quotes AS (
  SELECT
    id,
    mentor_slug,
    for_date,
    first_value(id) OVER (
      PARTITION BY mentor_slug, for_date
      ORDER BY created_at ASC NULLS LAST, id ASC
    ) AS keep_id
  FROM public.daily_quotes
  WHERE mentor_slug IS NOT NULL
    AND for_date IS NOT NULL
)
UPDATE public.user_daily_quote_pushes AS udp
SET daily_quote_id = ranked.keep_id
FROM ranked_daily_quotes AS ranked
WHERE udp.daily_quote_id = ranked.id
  AND ranked.keep_id <> ranked.id;

WITH ranked_daily_quotes AS (
  SELECT
    id,
    first_value(id) OVER (
      PARTITION BY mentor_slug, for_date
      ORDER BY created_at ASC NULLS LAST, id ASC
    ) AS keep_id
  FROM public.daily_quotes
  WHERE mentor_slug IS NOT NULL
    AND for_date IS NOT NULL
)
DELETE FROM public.daily_quotes AS dq
USING ranked_daily_quotes AS ranked
WHERE dq.id = ranked.id
  AND ranked.keep_id <> ranked.id;

WITH ranked_user_daily_pushes AS (
  SELECT
    id,
    row_number() OVER (
      PARTITION BY user_id, daily_pep_talk_id
      ORDER BY
        (delivered_at IS NOT NULL) DESC,
        delivered_at DESC NULLS LAST,
        scheduled_at DESC NULLS LAST,
        created_at DESC NULLS LAST,
        id DESC
    ) AS rn
  FROM public.user_daily_pushes
  WHERE user_id IS NOT NULL
    AND daily_pep_talk_id IS NOT NULL
)
DELETE FROM public.user_daily_pushes AS udp
USING ranked_user_daily_pushes AS ranked
WHERE udp.id = ranked.id
  AND ranked.rn > 1;

WITH ranked_user_daily_quote_pushes AS (
  SELECT
    id,
    row_number() OVER (
      PARTITION BY user_id, daily_quote_id
      ORDER BY
        (delivered_at IS NOT NULL) DESC,
        delivered_at DESC NULLS LAST,
        scheduled_at DESC NULLS LAST,
        created_at DESC NULLS LAST,
        id DESC
    ) AS rn
  FROM public.user_daily_quote_pushes
  WHERE user_id IS NOT NULL
    AND daily_quote_id IS NOT NULL
)
DELETE FROM public.user_daily_quote_pushes AS udp
USING ranked_user_daily_quote_pushes AS ranked
WHERE udp.id = ranked.id
  AND ranked.rn > 1;

CREATE INDEX IF NOT EXISTS idx_user_daily_quote_pushes_scheduled
ON public.user_daily_quote_pushes(scheduled_at, delivered_at);

CREATE UNIQUE INDEX IF NOT EXISTS idx_daily_quotes_mentor_date_unique
ON public.daily_quotes(mentor_slug, for_date);

CREATE UNIQUE INDEX IF NOT EXISTS idx_user_daily_pushes_user_pep_unique
ON public.user_daily_pushes(user_id, daily_pep_talk_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_user_daily_quote_pushes_user_quote_unique
ON public.user_daily_quote_pushes(user_id, daily_quote_id);
