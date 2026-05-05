ALTER TABLE public.companion_evolutions
ADD COLUMN IF NOT EXISTS animation_presented_at TIMESTAMPTZ;

UPDATE public.companion_evolutions
SET animation_presented_at = COALESCE(
  animation_presented_at,
  animation_completed_at,
  evolved_at,
  now()
)
WHERE animation_presented_at IS NULL
  AND animation_status = 'succeeded'
  AND NULLIF(BTRIM(animation_video_url), '') IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_companion_memories_evolution_id
  ON public.companion_memories (
    user_id,
    companion_id,
    ((memory_context #>> '{details,evolutionId}'))
  )
  WHERE memory_type IN ('first_evolution', 'evolution')
    AND memory_context #>> '{details,evolutionId}' IS NOT NULL;

CREATE OR REPLACE FUNCTION public.mark_companion_evolution_animation_presented(
  p_evolution_id UUID
)
RETURNS TABLE (
  id UUID,
  animation_presented_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  RETURN QUERY
  UPDATE public.companion_evolutions ce
  SET animation_presented_at = COALESCE(ce.animation_presented_at, now())
  WHERE ce.id = p_evolution_id
    AND EXISTS (
      SELECT 1
      FROM public.user_companion uc
      WHERE uc.id = ce.companion_id
        AND uc.user_id = v_user_id
    )
  RETURNING ce.id, ce.animation_presented_at;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Evolution not found';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.mark_companion_evolution_animation_presented(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.mark_companion_evolution_animation_presented(UUID) TO authenticated;

COMMENT ON COLUMN public.companion_evolutions.animation_presented_at IS
  'Set when the user has intentionally played the generated evolution reveal.';

COMMENT ON FUNCTION public.mark_companion_evolution_animation_presented(UUID) IS
  'Marks an owned companion evolution animation as presented after the user plays the reveal.';

COMMENT ON INDEX public.idx_companion_memories_evolution_id IS
  'Keeps companion evolution memories idempotent when reveal playback retries or reloads.';
