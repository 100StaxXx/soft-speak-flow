-- Preserve both visual endpoints for Graceward's egg-to-infant hatch videos.
-- `source_image_url` remains the revealed stage image for compatibility;
-- `start_image_url` stores the egg that Kling must use as the first frame.

ALTER TABLE public.companion_animation_jobs
  ADD COLUMN IF NOT EXISTS start_image_url TEXT;

COMMENT ON COLUMN public.companion_animation_jobs.start_image_url IS
  'Optional first-frame image. Required by the application for stage-1 egg-to-infant hatch jobs.';

UPDATE public.companion_animation_jobs AS job
SET start_image_url = companion.initial_image_url
FROM public.user_companion AS companion
WHERE job.companion_id = companion.id
  AND job.stage = 1
  AND NULLIF(BTRIM(job.start_image_url), '') IS NULL
  AND NULLIF(BTRIM(companion.initial_image_url), '') IS NOT NULL
  AND BTRIM(companion.initial_image_url) <> BTRIM(job.source_image_url);

-- Existing stage-1 videos were generated from the infant portrait alone, so
-- they cannot prove an egg-to-infant first/last-frame transition. Stop them
-- from replaying; the app will use its exact two-image fallback until the
-- animation is re-prewarmed through the corrected pipeline.
UPDATE public.companion_evolutions
SET animation_status = 'skipped',
    animation_video_url = NULL,
    animation_storage_path = NULL,
    animation_provider_task_id = NULL,
    animation_error_code = 'legacy_hatch_endpoints_unverified',
    animation_error_message =
      'Legacy hatch animation was invalidated because its egg and infant endpoints were not locked.',
    animation_completed_at = now()
WHERE stage = 1
  AND (
    NULLIF(BTRIM(animation_video_url), '') IS NOT NULL
    OR animation_status IN ('queued', 'processing', 'succeeded')
  );

UPDATE public.companion_animation_jobs
SET status = 'failed',
    provider_task_id = NULL,
    provider_status = NULL,
    video_url = NULL,
    storage_path = NULL,
    error_code = 'legacy_hatch_endpoints_unverified',
    error_message =
      'Legacy hatch animation was invalidated because its egg and infant endpoints were not locked.',
    retry_count = 0,
    next_retry_at = NULL,
    started_at = NULL,
    completed_at = now(),
    updated_at = now()
WHERE stage = 1
  AND (
    NULLIF(BTRIM(video_url), '') IS NOT NULL
    OR status IN ('queued', 'processing', 'succeeded')
  );
