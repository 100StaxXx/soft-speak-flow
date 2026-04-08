CREATE TABLE public.wallpaper_assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  page_key TEXT NOT NULL CHECK (page_key IN ('quests', 'campaigns', 'companion', 'profile')),
  source_kind TEXT NOT NULL DEFAULT 'generated' CHECK (source_kind IN ('generated', 'seed')),
  prompt_text TEXT NOT NULL,
  prompt_version INTEGER NOT NULL DEFAULT 1,
  render_model TEXT NOT NULL,
  storage_path TEXT NOT NULL UNIQUE,
  image_url TEXT NOT NULL,
  image_width INTEGER NOT NULL CHECK (image_width > 0),
  image_height INTEGER NOT NULL CHECK (image_height > 0),
  mobile_focus_x NUMERIC(5,2) NOT NULL DEFAULT 50 CHECK (mobile_focus_x BETWEEN 0 AND 100),
  mobile_focus_y NUMERIC(5,2) NOT NULL DEFAULT 50 CHECK (mobile_focus_y BETWEEN 0 AND 100),
  desktop_focus_x NUMERIC(5,2) NOT NULL DEFAULT 50 CHECK (desktop_focus_x BETWEEN 0 AND 100),
  desktop_focus_y NUMERIC(5,2) NOT NULL DEFAULT 50 CHECK (desktop_focus_y BETWEEN 0 AND 100),
  publish_state TEXT NOT NULL DEFAULT 'ready' CHECK (publish_state IN ('ready', 'validation_failed', 'suppressed', 'retired')),
  validation_result JSONB NOT NULL DEFAULT '{}'::jsonb,
  generation_error TEXT,
  generation_date DATE NOT NULL,
  generated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX wallpaper_assets_page_key_created_at_idx
  ON public.wallpaper_assets (page_key, created_at DESC);

CREATE INDEX wallpaper_assets_generation_date_idx
  ON public.wallpaper_assets (generation_date DESC);

ALTER TABLE public.wallpaper_assets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can view wallpaper assets" ON public.wallpaper_assets;
CREATE POLICY "Public can view wallpaper assets"
ON public.wallpaper_assets FOR SELECT
USING (true);

DROP POLICY IF EXISTS "Admins can manage wallpaper assets" ON public.wallpaper_assets;
CREATE POLICY "Admins can manage wallpaper assets"
ON public.wallpaper_assets FOR ALL
USING (public.has_role(auth.uid(), 'admin'::public.app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

DROP TRIGGER IF EXISTS update_wallpaper_assets_updated_at ON public.wallpaper_assets;
CREATE TRIGGER update_wallpaper_assets_updated_at
BEFORE UPDATE ON public.wallpaper_assets
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.daily_wallpaper_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  page_key TEXT NOT NULL CHECK (page_key IN ('quests', 'campaigns', 'companion', 'profile')),
  for_date DATE NOT NULL,
  wallpaper_asset_id UUID NOT NULL REFERENCES public.wallpaper_assets(id) ON DELETE CASCADE,
  assignment_source TEXT NOT NULL DEFAULT 'auto' CHECK (assignment_source IN ('auto', 'carry_forward', 'admin_override')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(page_key, for_date)
);

CREATE INDEX daily_wallpaper_assignments_for_date_idx
  ON public.daily_wallpaper_assignments (for_date DESC, page_key);

ALTER TABLE public.daily_wallpaper_assignments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can view daily wallpaper assignments" ON public.daily_wallpaper_assignments;
CREATE POLICY "Public can view daily wallpaper assignments"
ON public.daily_wallpaper_assignments FOR SELECT
USING (true);

DROP POLICY IF EXISTS "Admins can manage daily wallpaper assignments" ON public.daily_wallpaper_assignments;
CREATE POLICY "Admins can manage daily wallpaper assignments"
ON public.daily_wallpaper_assignments FOR ALL
USING (public.has_role(auth.uid(), 'admin'::public.app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

DROP TRIGGER IF EXISTS update_daily_wallpaper_assignments_updated_at ON public.daily_wallpaper_assignments;
CREATE TRIGGER update_daily_wallpaper_assignments_updated_at
BEFORE UPDATE ON public.daily_wallpaper_assignments
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO storage.buckets (id, name, public)
VALUES ('wallpaper-catalog', 'wallpaper-catalog', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Public can view wallpaper catalog images" ON storage.objects;
CREATE POLICY "Public can view wallpaper catalog images"
ON storage.objects FOR SELECT
USING (bucket_id = 'wallpaper-catalog');

DROP POLICY IF EXISTS "Service role can upload wallpaper catalog images" ON storage.objects;
CREATE POLICY "Service role can upload wallpaper catalog images"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'wallpaper-catalog' AND auth.role() = 'service_role');

DROP POLICY IF EXISTS "Service role can update wallpaper catalog images" ON storage.objects;
CREATE POLICY "Service role can update wallpaper catalog images"
ON storage.objects FOR UPDATE
USING (bucket_id = 'wallpaper-catalog' AND auth.role() = 'service_role')
WITH CHECK (bucket_id = 'wallpaper-catalog' AND auth.role() = 'service_role');

DROP POLICY IF EXISTS "Service role can delete wallpaper catalog images" ON storage.objects;
CREATE POLICY "Service role can delete wallpaper catalog images"
ON storage.objects FOR DELETE
USING (bucket_id = 'wallpaper-catalog' AND auth.role() = 'service_role');

DO $$
BEGIN
  BEGIN
    PERFORM cron.unschedule('rotate-daily-wallpapers')
    FROM cron.job
    WHERE cron.job.jobname = 'rotate-daily-wallpapers';
  EXCEPTION
    WHEN undefined_table OR undefined_function THEN
      NULL;
    WHEN OTHERS THEN
      NULL;
  END;
END $$;

SELECT cron.schedule(
  'rotate-daily-wallpapers',
  '5 9 * * *',
  $$SELECT public.invoke_edge_function_with_internal_secret('rotate-daily-wallpapers', '{}'::jsonb);$$
)
WHERE NOT EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'rotate-daily-wallpapers');
