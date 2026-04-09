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
