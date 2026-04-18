ALTER TABLE public.wallpaper_assets
  DROP CONSTRAINT IF EXISTS wallpaper_assets_page_key_check;

ALTER TABLE public.wallpaper_assets
  ADD CONSTRAINT wallpaper_assets_page_key_check
  CHECK (page_key IN ('guide', 'quests', 'campaigns', 'companion', 'profile', 'pep_talk'));

ALTER TABLE public.daily_wallpaper_assignments
  DROP CONSTRAINT IF EXISTS daily_wallpaper_assignments_page_key_check;

ALTER TABLE public.daily_wallpaper_assignments
  ADD CONSTRAINT daily_wallpaper_assignments_page_key_check
  CHECK (page_key IN ('guide', 'quests', 'campaigns', 'companion', 'profile', 'pep_talk'));

DROP VIEW IF EXISTS public.live_wallpaper_manifest_v;

CREATE VIEW public.live_wallpaper_manifest_v
WITH (security_invoker = true)
AS
SELECT
  assignments.for_date,
  assignments.page_key,
  assignments.assignment_source,
  assets.image_url,
  assets.mobile_focus_x,
  assets.mobile_focus_y,
  assets.desktop_focus_x,
  assets.desktop_focus_y,
  GREATEST(assignments.updated_at, assets.updated_at) AS updated_at
FROM public.daily_wallpaper_assignments AS assignments
JOIN public.wallpaper_assets AS assets
  ON assets.id = assignments.wallpaper_asset_id
WHERE assets.publish_state = 'ready';

GRANT SELECT ON public.live_wallpaper_manifest_v TO anon, authenticated, service_role;
