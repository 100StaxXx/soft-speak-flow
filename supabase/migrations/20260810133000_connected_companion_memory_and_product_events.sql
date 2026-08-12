-- Deepen the Guide -> practice -> companion loop while keeping personal memory
-- explicit, user-controlled, and separate from earned progression memories.

BEGIN;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS companion_memory_enabled boolean NOT NULL DEFAULT true;

COMMENT ON COLUMN public.profiles.companion_memory_enabled IS
  'When enabled, Graceward may use durable chat details and recent daily patterns to personalize Companion replies.';

ALTER TABLE public.daily_guide_threads
  ADD COLUMN IF NOT EXISTS companion_question_id text,
  ADD COLUMN IF NOT EXISTS companion_question text,
  ADD COLUMN IF NOT EXISTS companion_answer_id text,
  ADD COLUMN IF NOT EXISTS companion_answer_label text,
  ADD COLUMN IF NOT EXISTS companion_answered_at timestamptz;

ALTER TABLE public.daily_guide_threads
  ADD CONSTRAINT daily_guide_threads_companion_answer_check CHECK (
    (
      companion_answer_id IS NULL
      AND companion_answer_label IS NULL
      AND companion_answered_at IS NULL
    )
    OR
    (
      companion_question_id IS NOT NULL
      AND companion_question IS NOT NULL
      AND companion_answer_id IS NOT NULL
      AND companion_answer_label IS NOT NULL
      AND companion_answered_at IS NOT NULL
    )
  );

COMMENT ON COLUMN public.daily_guide_threads.companion_answer_label IS
  'A short, user-selected Companion check-in answer that the Guide may reference later in the same daily thread.';

DROP POLICY IF EXISTS "Users can update own companion memories" ON public.companion_memories;
CREATE POLICY "Users can update own companion memories"
  ON public.companion_memories FOR UPDATE TO authenticated
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can delete own companion memories" ON public.companion_memories;
CREATE POLICY "Users can delete own companion memories"
  ON public.companion_memories FOR DELETE TO authenticated
  USING ((SELECT auth.uid()) = user_id);

GRANT UPDATE, DELETE ON public.companion_memories TO authenticated;

CREATE OR REPLACE FUNCTION public.clear_personal_companion_memory()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_user_id uuid := auth.uid();
  v_deleted integer := 0;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '42501';
  END IF;

  DELETE FROM public.companion_memories AS memory
  WHERE memory.user_id = v_user_id
    AND memory.memory_type = 'special_moment'
    AND memory.memory_context #>> '{details,source}' = 'companion_chat';
  GET DIAGNOSTICS v_deleted = ROW_COUNT;

  UPDATE public.user_ai_learning AS learning
  SET
    conversation_profile = '{}'::jsonb,
    updated_at = now()
  WHERE learning.user_id = v_user_id;

  RETURN v_deleted;
END;
$function$;

REVOKE ALL ON FUNCTION public.clear_personal_companion_memory() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.clear_personal_companion_memory() FROM anon;
GRANT EXECUTE ON FUNCTION public.clear_personal_companion_memory() TO authenticated;
GRANT EXECUTE ON FUNCTION public.clear_personal_companion_memory() TO service_role;

COMMENT ON FUNCTION public.clear_personal_companion_memory() IS
  'Clears durable personal details learned from Companion chat without deleting chat history or earned progression memories.';

CREATE TABLE public.product_experience_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES public.profiles(id) ON DELETE CASCADE,
  event_name text NOT NULL,
  surface text NOT NULL,
  session_id text,
  properties jsonb NOT NULL DEFAULT '{}'::jsonb,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT product_experience_events_name_check CHECK (
    event_name ~ '^[a-z][a-z0-9_]{2,63}$'
  ),
  CONSTRAINT product_experience_events_surface_check CHECK (
    surface ~ '^[a-z][a-z0-9_-]{1,39}$'
  ),
  CONSTRAINT product_experience_events_session_length_check CHECK (
    session_id IS NULL OR length(session_id) BETWEEN 1 AND 100
  ),
  CONSTRAINT product_experience_events_properties_size_check CHECK (
    octet_length(properties::text) <= 2048
  )
);

CREATE INDEX product_experience_events_user_recent_idx
  ON public.product_experience_events (user_id, occurred_at DESC);
CREATE INDEX product_experience_events_name_recent_idx
  ON public.product_experience_events (event_name, occurred_at DESC);

ALTER TABLE public.product_experience_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can record their own product experience events"
  ON public.product_experience_events FOR INSERT TO authenticated
  WITH CHECK ((SELECT auth.uid()) = user_id);

CREATE POLICY "Users can view their own product experience events"
  ON public.product_experience_events FOR SELECT TO authenticated
  USING ((SELECT auth.uid()) = user_id);

CREATE POLICY "Users can delete their own product experience events"
  ON public.product_experience_events FOR DELETE TO authenticated
  USING ((SELECT auth.uid()) = user_id);

GRANT SELECT, INSERT, DELETE ON public.product_experience_events TO authenticated;

COMMENT ON TABLE public.product_experience_events IS
  'Private first-party, content-free journey events used to find breaks in Graceward''s Guide-practice-Companion loop.';

COMMIT;
