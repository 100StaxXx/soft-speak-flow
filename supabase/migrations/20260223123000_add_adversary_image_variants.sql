-- Add support for multiple cached image variants per adversary theme/tier.
ALTER TABLE public.adversary_images
ADD COLUMN IF NOT EXISTS variant_index integer;

UPDATE public.adversary_images
SET variant_index = 0
WHERE variant_index IS NULL;

ALTER TABLE public.adversary_images
ALTER COLUMN variant_index SET DEFAULT 0;

ALTER TABLE public.adversary_images
ALTER COLUMN variant_index SET NOT NULL;

ALTER TABLE public.adversary_images
DROP CONSTRAINT IF EXISTS adversary_images_theme_tier_key;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'adversary_images_theme_tier_variant_index_key'
      AND conrelid = 'public.adversary_images'::regclass
  ) THEN
    ALTER TABLE public.adversary_images
    ADD CONSTRAINT adversary_images_theme_tier_variant_index_key
    UNIQUE (theme, tier, variant_index);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS adversary_images_theme_tier_idx
ON public.adversary_images (theme, tier);
