-- The initial reveal-tracking backfill treated every completed animation as
-- already presented. Stage-one prewarms can finish while the companion is still
-- an egg, so those rows must stay revealable once the hatch is claimed.

UPDATE public.companion_evolutions ce
SET animation_presented_at = NULL
FROM public.user_companion uc
WHERE uc.id = ce.companion_id
  AND ce.animation_presented_at IS NOT NULL
  AND ce.animation_status = 'succeeded'
  AND NULLIF(BTRIM(ce.animation_video_url), '') IS NOT NULL
  AND (
    COALESCE(uc.current_stage, 0) < ce.stage
    OR (
      ce.generation_metadata ->> 'animationPrewarmSource' = 'future_stage_reveal'
      AND (
        (
          ce.animation_completed_at IS NOT NULL
          AND ce.animation_presented_at = ce.animation_completed_at
        )
        OR (
          ce.animation_completed_at IS NULL
          AND ce.evolved_at IS NOT NULL
          AND ce.animation_presented_at = ce.evolved_at
        )
      )
    )
  );
