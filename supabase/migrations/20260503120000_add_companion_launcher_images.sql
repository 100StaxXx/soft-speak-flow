ALTER TABLE public.user_companion
  ADD COLUMN IF NOT EXISTS launcher_image_url text,
  ADD COLUMN IF NOT EXISTS launcher_image_focal_x double precision,
  ADD COLUMN IF NOT EXISTS launcher_image_focal_y double precision,
  ADD COLUMN IF NOT EXISTS launcher_image_source_url text;
