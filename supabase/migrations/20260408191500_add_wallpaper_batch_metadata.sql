ALTER TABLE public.wallpaper_assets
ADD COLUMN IF NOT EXISTS variant_key TEXT;

ALTER TABLE public.wallpaper_assets
ADD COLUMN IF NOT EXISTS batch_label TEXT;

CREATE INDEX IF NOT EXISTS wallpaper_assets_batch_label_created_at_idx
  ON public.wallpaper_assets (batch_label, created_at DESC)
  WHERE batch_label IS NOT NULL;

CREATE INDEX IF NOT EXISTS wallpaper_assets_variant_key_idx
  ON public.wallpaper_assets (variant_key)
  WHERE variant_key IS NOT NULL;
