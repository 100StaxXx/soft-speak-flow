-- Add a deterministic ledger of user-owned storage objects so account deletion
-- can remove exact bucket/path pairs instead of rediscovering assets from
-- storage metadata heuristics.

CREATE TABLE IF NOT EXISTS public.user_storage_assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  bucket_id TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  source_kind TEXT NOT NULL,
  source_record_table TEXT,
  source_record_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_user_storage_assets_bucket_path
  ON public.user_storage_assets(bucket_id, storage_path);

CREATE INDEX IF NOT EXISTS idx_user_storage_assets_user_created
  ON public.user_storage_assets(user_id, created_at DESC);

ALTER TABLE public.user_storage_assets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own storage assets" ON public.user_storage_assets;
CREATE POLICY "Users can view own storage assets"
ON public.user_storage_assets
FOR SELECT
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Service role can manage user storage assets" ON public.user_storage_assets;
CREATE POLICY "Service role can manage user storage assets"
ON public.user_storage_assets
FOR ALL
USING (auth.role() = 'service_role')
WITH CHECK (auth.role() = 'service_role');

CREATE OR REPLACE FUNCTION public.register_user_storage_asset(
  p_user_id UUID,
  p_bucket_id TEXT,
  p_storage_path TEXT,
  p_source_kind TEXT,
  p_source_record_table TEXT DEFAULT NULL,
  p_source_record_id UUID DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF p_user_id IS NULL OR p_bucket_id IS NULL OR p_storage_path IS NULL OR p_source_kind IS NULL THEN
    RETURN;
  END IF;

  INSERT INTO public.user_storage_assets (
    user_id,
    bucket_id,
    storage_path,
    source_kind,
    source_record_table,
    source_record_id
  )
  VALUES (
    p_user_id,
    btrim(p_bucket_id),
    btrim(p_storage_path),
    btrim(p_source_kind),
    NULLIF(btrim(COALESCE(p_source_record_table, '')), ''),
    p_source_record_id
  )
  ON CONFLICT (bucket_id, storage_path) DO UPDATE
  SET
    user_id = EXCLUDED.user_id,
    source_kind = EXCLUDED.source_kind,
    source_record_table = COALESCE(EXCLUDED.source_record_table, public.user_storage_assets.source_record_table),
    source_record_id = COALESCE(EXCLUDED.source_record_id, public.user_storage_assets.source_record_id);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.register_user_storage_asset(UUID, TEXT, TEXT, TEXT, TEXT, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.register_user_storage_asset(UUID, TEXT, TEXT, TEXT, TEXT, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.register_user_storage_asset(UUID, TEXT, TEXT, TEXT, TEXT, UUID) TO service_role;

CREATE OR REPLACE FUNCTION public.extract_project_storage_asset(
  p_url TEXT,
  p_allowed_buckets TEXT[]
)
RETURNS TABLE(bucket_id TEXT, storage_path TEXT)
LANGUAGE sql
IMMUTABLE
AS $$
  WITH matches AS (
    SELECT regexp_match(
      p_url,
      '^https?://[^/]+/storage/v1/object/public/([^/]+)/(.+?)(?:\?.*)?$'
    ) AS captures
  )
  SELECT
    captures[1]::TEXT AS bucket_id,
    replace(captures[2], '%2F', '/')::TEXT AS storage_path
  FROM matches
  WHERE captures IS NOT NULL
    AND captures[1] = ANY(p_allowed_buckets);
$$;

CREATE OR REPLACE FUNCTION public.register_task_attachment_storage_asset()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  PERFORM public.register_user_storage_asset(
    NEW.user_id,
    'quest-attachments',
    NEW.file_path,
    'task_attachment',
    'task_attachments',
    NEW.id
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS register_task_attachment_storage_asset ON public.task_attachments;
CREATE TRIGGER register_task_attachment_storage_asset
  AFTER INSERT ON public.task_attachments
  FOR EACH ROW
  EXECUTE FUNCTION public.register_task_attachment_storage_asset();

INSERT INTO storage.buckets (id, name, public)
VALUES ('companion-images', 'companion-images', true)
ON CONFLICT (id) DO UPDATE
SET public = EXCLUDED.public;

DROP POLICY IF EXISTS "Public can view companion images" ON storage.objects;
CREATE POLICY "Public can view companion images"
ON storage.objects FOR SELECT
USING (bucket_id = 'companion-images');

DROP POLICY IF EXISTS "Service role can manage companion images" ON storage.objects;
CREATE POLICY "Service role can manage companion images"
ON storage.objects FOR ALL
USING (bucket_id = 'companion-images' AND auth.role() = 'service_role')
WITH CHECK (bucket_id = 'companion-images' AND auth.role() = 'service_role');

WITH allowed_owned_buckets AS (
  SELECT ARRAY[
    'quest-attachments',
    'mentors-avatars',
    'journey-paths',
    'evolution-cards',
    'companion-images'
  ]::TEXT[] AS buckets
),
backfill_rows AS (
  SELECT
    ta.user_id,
    'quest-attachments'::TEXT AS bucket_id,
    ta.file_path AS storage_path,
    'task_attachment'::TEXT AS source_kind,
    'task_attachments'::TEXT AS source_record_table,
    ta.id AS source_record_id
  FROM public.task_attachments ta

  UNION ALL

  SELECT
    uc.user_id,
    asset.bucket_id,
    asset.storage_path,
    'companion_current_image'::TEXT,
    'user_companion'::TEXT,
    uc.id
  FROM public.user_companion uc
  CROSS JOIN allowed_owned_buckets aob
  CROSS JOIN LATERAL public.extract_project_storage_asset(uc.current_image_url, aob.buckets) asset

  UNION ALL

  SELECT
    uc.user_id,
    asset.bucket_id,
    asset.storage_path,
    'companion_initial_image'::TEXT,
    'user_companion'::TEXT,
    uc.id
  FROM public.user_companion uc
  CROSS JOIN allowed_owned_buckets aob
  CROSS JOIN LATERAL public.extract_project_storage_asset(uc.initial_image_url, aob.buckets) asset

  UNION ALL

  SELECT
    uc.user_id,
    asset.bucket_id,
    asset.storage_path,
    'companion_dormant_image'::TEXT,
    'user_companion'::TEXT,
    uc.id
  FROM public.user_companion uc
  CROSS JOIN allowed_owned_buckets aob
  CROSS JOIN LATERAL public.extract_project_storage_asset(uc.dormant_image_url, aob.buckets) asset

  UNION ALL

  SELECT
    uc.user_id,
    asset.bucket_id,
    asset.storage_path,
    'companion_neglected_image'::TEXT,
    'user_companion'::TEXT,
    uc.id
  FROM public.user_companion uc
  CROSS JOIN allowed_owned_buckets aob
  CROSS JOIN LATERAL public.extract_project_storage_asset(uc.neglected_image_url, aob.buckets) asset

  UNION ALL

  SELECT
    uc.user_id,
    asset.bucket_id,
    asset.storage_path,
    'companion_scarred_image'::TEXT,
    'user_companion'::TEXT,
    uc.id
  FROM public.user_companion uc
  CROSS JOIN allowed_owned_buckets aob
  CROSS JOIN LATERAL public.extract_project_storage_asset(uc.scarred_image_url, aob.buckets) asset

  UNION ALL

  SELECT
    uc.user_id,
    asset.bucket_id,
    asset.storage_path,
    'companion_evolution'::TEXT,
    'companion_evolutions'::TEXT,
    ce.id
  FROM public.companion_evolutions ce
  JOIN public.user_companion uc ON uc.id = ce.companion_id
  CROSS JOIN allowed_owned_buckets aob
  CROSS JOIN LATERAL public.extract_project_storage_asset(ce.image_url, aob.buckets) asset

  UNION ALL

  SELECT
    cec.user_id,
    asset.bucket_id,
    asset.storage_path,
    'companion_evolution_card'::TEXT,
    'companion_evolution_cards'::TEXT,
    cec.id
  FROM public.companion_evolution_cards cec
  CROSS JOIN allowed_owned_buckets aob
  CROSS JOIN LATERAL public.extract_project_storage_asset(cec.image_url, aob.buckets) asset

  UNION ALL

  SELECT
    cej.user_id,
    asset.bucket_id,
    asset.storage_path,
    'companion_evolution_job'::TEXT,
    'companion_evolution_jobs'::TEXT,
    cej.id
  FROM public.companion_evolution_jobs cej
  CROSS JOIN allowed_owned_buckets aob
  CROSS JOIN LATERAL public.extract_project_storage_asset(cej.result_image_url, aob.buckets) asset

  UNION ALL

  SELECT
    cp.user_id,
    asset.bucket_id,
    asset.storage_path,
    'companion_postcard'::TEXT,
    'companion_postcards'::TEXT,
    cp.id
  FROM public.companion_postcards cp
  CROSS JOIN allowed_owned_buckets aob
  CROSS JOIN LATERAL public.extract_project_storage_asset(cp.image_url, aob.buckets) asset

  UNION ALL

  SELECT
    cm.user_id,
    asset.bucket_id,
    asset.storage_path,
    'companion_memorial'::TEXT,
    'companion_memorials'::TEXT,
    cm.id
  FROM public.companion_memorials cm
  CROSS JOIN allowed_owned_buckets aob
  CROSS JOIN LATERAL public.extract_project_storage_asset(cm.memorial_image_url, aob.buckets) asset

  UNION ALL

  SELECT
    ejp.user_id,
    asset.bucket_id,
    asset.storage_path,
    'journey_path'::TEXT,
    'epic_journey_paths'::TEXT,
    ejp.id
  FROM public.epic_journey_paths ejp
  CROSS JOIN allowed_owned_buckets aob
  CROSS JOIN LATERAL public.extract_project_storage_asset(ejp.image_url, aob.buckets) asset
)
INSERT INTO public.user_storage_assets (
  user_id,
  bucket_id,
  storage_path,
  source_kind,
  source_record_table,
  source_record_id
)
SELECT
  user_id,
  bucket_id,
  storage_path,
  source_kind,
  source_record_table,
  source_record_id
FROM backfill_rows
ON CONFLICT (bucket_id, storage_path) DO UPDATE
SET
  user_id = EXCLUDED.user_id,
  source_kind = EXCLUDED.source_kind,
  source_record_table = COALESCE(EXCLUDED.source_record_table, public.user_storage_assets.source_record_table),
  source_record_id = COALESCE(EXCLUDED.source_record_id, public.user_storage_assets.source_record_id);

NOTIFY pgrst, 'reload schema';
