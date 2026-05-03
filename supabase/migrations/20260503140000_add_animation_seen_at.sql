-- Track when the user has been shown a Kling reveal video for an evolution.
-- Used by GlobalEvolutionListener to (a) re-present the evolution screen the
-- next time the user opens the app if a video arrived while they were away,
-- and (b) avoid re-presenting the same video more than once.

ALTER TABLE public.companion_evolutions
  ADD COLUMN IF NOT EXISTS animation_seen_at timestamptz;

CREATE INDEX IF NOT EXISTS companion_evolutions_animation_unseen_idx
  ON public.companion_evolutions (companion_id, evolved_at DESC)
  WHERE animation_video_url IS NOT NULL AND animation_seen_at IS NULL;

-- SECURITY DEFINER RPC: clients can only mark their own evolution videos as
-- seen, and ONLY the animation_seen_at column is touched. Avoids granting a
-- broad UPDATE policy that would let users tamper with image_url etc.
CREATE OR REPLACE FUNCTION public.mark_companion_animation_seen(p_evolution_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_user_id uuid := auth.uid();
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  UPDATE public.companion_evolutions ce
     SET animation_seen_at = COALESCE(ce.animation_seen_at, now())
   WHERE ce.id = p_evolution_id
     AND ce.companion_id IN (
       SELECT uc.id FROM public.user_companion uc
        WHERE uc.user_id = v_user_id
     );
END $$;

REVOKE ALL ON FUNCTION public.mark_companion_animation_seen(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mark_companion_animation_seen(uuid) TO authenticated, service_role;
