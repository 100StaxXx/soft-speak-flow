-- One-time recovery for Graceward evolution jobs stranded by the retired
-- provider-backed path or an unavailable Edge scheduler. Only fully published
-- Level 1 portrait/video pairs may advance, and the update is idempotent.

WITH eligible AS (
  SELECT DISTINCT ON (job.companion_id)
    job.id AS job_id,
    companion.id AS companion_id,
    companion.current_xp,
    contract.asset_version,
    contract.product_mode,
    contract.species,
    contract.element,
    contract.boundary_level,
    contract.portrait_bucket,
    contract.portrait_storage_path,
    contract.video_bucket,
    contract.video_storage_path,
    COALESCE(public.resolve_supabase_project_url(), '') AS project_url
  FROM public.companion_evolution_jobs AS job
  JOIN public.user_companion AS companion
    ON companion.id = job.companion_id
  JOIN public.companion_premade_asset_contracts AS contract
    ON contract.product_mode = 'graceward'
    AND contract.species = lower(regexp_replace(
      trim(COALESCE(companion.spirit_animal, '')),
      '[^a-zA-Z0-9]+',
      '',
      'g'
    ))
    AND contract.element = public.normalize_companion_element_slug(
      companion.core_element
    )
    AND contract.boundary_level = 1
  WHERE job.status = 'queued'
    AND job.requested_stage = 1
    AND companion.product_mode = 'graceward'
    AND companion.current_stage = 0
    AND companion.current_xp >= COALESCE(
      (
        SELECT threshold.xp_required
        FROM public.evolution_thresholds AS threshold
        WHERE threshold.stage = 1
        LIMIT 1
      ),
      10
    )
    AND EXISTS (
      SELECT 1
      FROM storage.objects AS portrait
      WHERE portrait.bucket_id = contract.portrait_bucket
        AND portrait.name = contract.portrait_storage_path
    )
    AND EXISTS (
      SELECT 1
      FROM storage.objects AS video
      WHERE video.bucket_id = contract.video_bucket
        AND video.name = contract.video_storage_path
    )
  ORDER BY job.companion_id, job.requested_at ASC, job.created_at ASC
), upserted_evolutions AS (
  INSERT INTO public.companion_evolutions (
    companion_id,
    stage,
    image_url,
    xp_at_evolution,
    evolved_at,
    generation_metadata,
    animation_video_url,
    animation_storage_path,
    animation_provider,
    animation_provider_model,
    animation_status,
    animation_error_code,
    animation_error_message,
    animation_requested_at,
    animation_completed_at
  )
  SELECT
    eligible.companion_id,
    eligible.boundary_level,
    eligible.project_url || '/storage/v1/object/public/' ||
      eligible.portrait_bucket || '/' || eligible.portrait_storage_path,
    eligible.current_xp,
    now(),
    jsonb_build_object(
      'sourceType', 'premade',
      'provider', 'higgsfield',
      'assetVersion', eligible.asset_version,
      'productMode', eligible.product_mode,
      'species', eligible.species,
      'element', eligible.element,
      'boundaryLevel', eligible.boundary_level,
      'portraitRegenerated', false,
      'portraitStoragePath', eligible.portrait_storage_path,
      'videoStoragePath', eligible.video_storage_path,
      'recoveredAt', now()
    ),
    eligible.project_url || '/storage/v1/object/public/' ||
      eligible.video_bucket || '/' || eligible.video_storage_path,
    eligible.video_storage_path,
    'higgsfield',
    'premade',
    'succeeded',
    NULL,
    NULL,
    now(),
    now()
  FROM eligible
  ON CONFLICT (companion_id, stage) DO UPDATE SET
    image_url = EXCLUDED.image_url,
    xp_at_evolution = GREATEST(
      public.companion_evolutions.xp_at_evolution,
      EXCLUDED.xp_at_evolution
    ),
    generation_metadata = COALESCE(
      public.companion_evolutions.generation_metadata,
      '{}'::jsonb
    ) || EXCLUDED.generation_metadata,
    animation_video_url = EXCLUDED.animation_video_url,
    animation_storage_path = EXCLUDED.animation_storage_path,
    animation_provider = EXCLUDED.animation_provider,
    animation_provider_model = EXCLUDED.animation_provider_model,
    animation_status = 'succeeded',
    animation_error_code = NULL,
    animation_error_message = NULL,
    animation_requested_at = COALESCE(
      public.companion_evolutions.animation_requested_at,
      now()
    ),
    animation_completed_at = now()
  RETURNING id, companion_id, image_url, animation_video_url
), promoted_companions AS (
  UPDATE public.user_companion AS companion
  SET current_stage = 1,
      current_image_url = evolution.image_url,
      current_image_focal_x = 0.5,
      current_image_focal_y = 0.5,
      dormant_image_url = NULL,
      dormant_image_focal_x = NULL,
      dormant_image_focal_y = NULL,
      neglected_image_url = NULL,
      neglected_image_focal_x = NULL,
      neglected_image_focal_y = NULL,
      updated_at = now()
  FROM upserted_evolutions AS evolution
  WHERE companion.id = evolution.companion_id
    AND companion.current_stage = 0
  RETURNING companion.id
)
UPDATE public.companion_evolution_jobs AS job
SET status = 'succeeded',
    error_code = NULL,
    error_message = NULL,
    result_image_url = evolution.image_url,
    result_evolution_id = evolution.id,
    next_retry_at = NULL,
    completed_at = now(),
    updated_at = now()
FROM eligible
JOIN upserted_evolutions AS evolution
  ON evolution.companion_id = eligible.companion_id
JOIN promoted_companions AS promoted
  ON promoted.id = eligible.companion_id
WHERE job.id = eligible.job_id;
