-- Persist meaningful companion touches and daily answers without allowing users
-- to mutate protected bond counters directly.
CREATE TABLE IF NOT EXISTS public.companion_interaction_memory (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  companion_id uuid NOT NULL REFERENCES public.user_companion(id) ON DELETE CASCADE,
  interaction_kind text NOT NULL CHECK (
    interaction_kind IN ('tap', 'pet', 'hold', 'keyboard', 'answer')
  ),
  prompt_key text CHECK (prompt_key IS NULL OR char_length(prompt_key) <= 80),
  answer_key text CHECK (answer_key IS NULL OR char_length(answer_key) <= 80),
  companion_stage integer NOT NULL DEFAULT 0 CHECK (companion_stage BETWEEN 0 AND 100),
  interaction_day date NOT NULL DEFAULT CURRENT_DATE,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT companion_interaction_answer_shape CHECK (
    (interaction_kind = 'answer' AND prompt_key IS NOT NULL AND answer_key IS NOT NULL)
    OR
    (interaction_kind <> 'answer' AND prompt_key IS NULL AND answer_key IS NULL)
  )
);

CREATE INDEX IF NOT EXISTS companion_interaction_memory_user_created_idx
  ON public.companion_interaction_memory (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS companion_interaction_memory_companion_created_idx
  ON public.companion_interaction_memory (companion_id, created_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS companion_interaction_memory_daily_answer_idx
  ON public.companion_interaction_memory (
    user_id,
    companion_id,
    prompt_key,
    interaction_day
  )
  WHERE interaction_kind = 'answer';

ALTER TABLE public.companion_interaction_memory ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read their companion interaction memories"
  ON public.companion_interaction_memory;
CREATE POLICY "Users can read their companion interaction memories"
  ON public.companion_interaction_memory
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

REVOKE INSERT, UPDATE, DELETE ON public.companion_interaction_memory
  FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.companion_interaction_memory TO authenticated;

CREATE OR REPLACE FUNCTION public.record_companion_interaction(
  p_companion_id uuid,
  p_kind text,
  p_prompt_key text DEFAULT NULL,
  p_answer_key text DEFAULT NULL,
  p_stage integer DEFAULT 0,
  p_local_date date DEFAULT CURRENT_DATE
)
RETURNS TABLE (
  total_interactions integer,
  bond_level integer,
  last_interaction_at timestamptz,
  counted boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_last_interaction_at timestamptz;
  v_counted boolean := false;
  v_now timestamptz := clock_timestamp();
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501';
  END IF;

  IF p_kind IS NULL OR p_kind NOT IN ('tap', 'pet', 'hold', 'keyboard', 'answer') THEN
    RAISE EXCEPTION 'Unsupported companion interaction kind' USING ERRCODE = '22023';
  END IF;

  IF p_stage IS NULL OR p_stage < 0 OR p_stage > 100 THEN
    RAISE EXCEPTION 'Companion stage must be between 0 and 100' USING ERRCODE = '22023';
  END IF;

  -- A device-local day may differ from UTC by one date near midnight. Keep the
  -- accepted window narrow so clients cannot use this RPC to backdate history.
  IF p_local_date IS NULL OR p_local_date < CURRENT_DATE - 1 OR p_local_date > CURRENT_DATE + 1 THEN
    RAISE EXCEPTION 'Interaction date must match the current local day' USING ERRCODE = '22023';
  END IF;

  IF p_kind = 'answer' THEN
    IF nullif(btrim(p_prompt_key), '') IS NULL OR nullif(btrim(p_answer_key), '') IS NULL THEN
      RAISE EXCEPTION 'Prompt and answer keys are required for answers' USING ERRCODE = '22023';
    END IF;
    IF char_length(btrim(p_prompt_key)) > 80 OR char_length(btrim(p_answer_key)) > 80 THEN
      RAISE EXCEPTION 'Prompt and answer keys must be 80 characters or fewer' USING ERRCODE = '22023';
    END IF;
  ELSIF p_prompt_key IS NOT NULL OR p_answer_key IS NOT NULL THEN
    RAISE EXCEPTION 'Prompt data is only valid for answers' USING ERRCODE = '22023';
  END IF;

  SELECT uc.last_interaction_at
    INTO v_last_interaction_at
  FROM public.user_companion uc
  WHERE uc.id = p_companion_id
    AND uc.user_id = v_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Companion not found' USING ERRCODE = 'P0002';
  END IF;

  -- Touches may be frequent. Count at most one bond interaction per 20 seconds,
  -- while always preserving a user's explicit daily answer.
  v_counted := v_last_interaction_at IS NULL
    OR v_last_interaction_at < v_now - interval '20 seconds';

  IF p_kind = 'answer' OR v_counted THEN
    INSERT INTO public.companion_interaction_memory (
      user_id,
      companion_id,
      interaction_kind,
      prompt_key,
      answer_key,
      companion_stage,
      interaction_day,
      created_at
    ) VALUES (
      v_user_id,
      p_companion_id,
      p_kind,
      CASE WHEN p_kind = 'answer' THEN btrim(p_prompt_key) ELSE NULL END,
      CASE WHEN p_kind = 'answer' THEN btrim(p_answer_key) ELSE NULL END,
      p_stage,
      p_local_date,
      v_now
    )
    ON CONFLICT DO NOTHING;
  END IF;

  UPDATE public.user_companion uc
  SET
    total_interactions = coalesce(uc.total_interactions, 0) + CASE WHEN v_counted THEN 1 ELSE 0 END,
    last_interaction_at = v_now,
    updated_at = v_now
  WHERE uc.id = p_companion_id
    AND uc.user_id = v_user_id;

  RETURN QUERY
  SELECT
    coalesce(uc.total_interactions, 0),
    coalesce(uc.bond_level, 0),
    uc.last_interaction_at,
    v_counted
  FROM public.user_companion uc
  WHERE uc.id = p_companion_id
    AND uc.user_id = v_user_id;
END;
$$;

REVOKE ALL ON FUNCTION public.record_companion_interaction(uuid, text, text, text, integer, date)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_companion_interaction(uuid, text, text, text, integer, date)
  TO authenticated;
