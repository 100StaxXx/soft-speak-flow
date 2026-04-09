ALTER TABLE public.wallpaper_assets
  DROP CONSTRAINT IF EXISTS wallpaper_assets_page_key_check;

ALTER TABLE public.wallpaper_assets
  ADD CONSTRAINT wallpaper_assets_page_key_check
  CHECK (page_key IN ('guide', 'quests', 'campaigns', 'companion', 'profile'));

ALTER TABLE public.daily_wallpaper_assignments
  DROP CONSTRAINT IF EXISTS daily_wallpaper_assignments_page_key_check;

ALTER TABLE public.daily_wallpaper_assignments
  ADD CONSTRAINT daily_wallpaper_assignments_page_key_check
  CHECK (page_key IN ('guide', 'quests', 'campaigns', 'companion', 'profile'));
