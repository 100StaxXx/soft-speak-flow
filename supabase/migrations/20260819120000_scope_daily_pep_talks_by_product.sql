-- Daily pep talks were originally global per mentor/date, allowing one app's
-- presentation and faith policy to overwrite the other app's content. Preserve
-- legacy rows as Cosmiq and require all new lookups/generation to name a product.

ALTER TABLE public.daily_pep_talks
  ADD COLUMN IF NOT EXISTS product_mode text NOT NULL DEFAULT 'cosmiq';

ALTER TABLE public.daily_pep_talks
  DROP CONSTRAINT IF EXISTS daily_pep_talks_product_mode_check;

ALTER TABLE public.daily_pep_talks
  ADD CONSTRAINT daily_pep_talks_product_mode_check
  CHECK (product_mode IN ('graceward', 'cosmiq'));

DROP INDEX IF EXISTS public.idx_daily_pep_talks_mentor_date_unique;

CREATE UNIQUE INDEX IF NOT EXISTS idx_daily_pep_talks_product_mentor_date_unique
  ON public.daily_pep_talks(product_mode, mentor_slug, for_date);

CREATE INDEX IF NOT EXISTS idx_daily_pep_talks_product_date
  ON public.daily_pep_talks(product_mode, for_date, mentor_slug);

-- The reusable pep-talk library is also presented by both products. Keep its
-- legacy catalog with Cosmiq and stamp all new Graceward library rows explicitly.
ALTER TABLE public.pep_talks
  ADD COLUMN IF NOT EXISTS product_mode text NOT NULL DEFAULT 'cosmiq';

ALTER TABLE public.pep_talks
  DROP CONSTRAINT IF EXISTS pep_talks_product_mode_check;

ALTER TABLE public.pep_talks
  ADD CONSTRAINT pep_talks_product_mode_check
  CHECK (product_mode IN ('graceward', 'cosmiq'));

CREATE INDEX IF NOT EXISTS idx_pep_talks_product_date
  ON public.pep_talks(product_mode, for_date, mentor_slug);

-- Motivational quotes are a Cosmiq catalog unless explicitly authored for a
-- different product. Graceward must not silently inherit the legacy library.
ALTER TABLE public.quotes
  ADD COLUMN IF NOT EXISTS product_mode text NOT NULL DEFAULT 'cosmiq';

ALTER TABLE public.quotes
  DROP CONSTRAINT IF EXISTS quotes_product_mode_check;

ALTER TABLE public.quotes
  ADD CONSTRAINT quotes_product_mode_check
  CHECK (product_mode IN ('graceward', 'cosmiq'));

CREATE INDEX IF NOT EXISTS idx_quotes_product_mentor
  ON public.quotes(product_mode, mentor_id);
