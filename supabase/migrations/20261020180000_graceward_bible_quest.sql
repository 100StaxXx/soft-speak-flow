-- Additive first Adventure chapter. No changes to existing progression totals.
BEGIN;
CREATE TABLE public.graceward_adventure_completions (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  node_id integer NOT NULL CHECK (node_id BETWEEN 1 AND 3),
  content_version integer NOT NULL DEFAULT 1 CHECK (content_version = 1),
  score integer NOT NULL CHECK (score BETWEEN 0 AND 5),
  xp_awarded integer NOT NULL DEFAULT 0 CHECK (xp_awarded >= 0),
  coins_awarded integer NOT NULL DEFAULT 10 CHECK (coins_awarded = 10),
  completed_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, node_id)
);
ALTER TABLE public.graceward_adventure_completions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.graceward_adventure_completions FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.graceward_adventure_completions TO authenticated;
CREATE POLICY "Read own adventure completions" ON public.graceward_adventure_completions
  FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE FUNCTION public.get_graceward_adventure_progress()
RETURNS TABLE(node_id integer, score integer, xp_awarded integer, coins_awarded integer)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public
AS $$
  SELECT c.node_id, c.score, c.xp_awarded, c.coins_awarded
  FROM public.graceward_adventure_completions c
  WHERE c.user_id = auth.uid() ORDER BY c.node_id;
$$;

CREATE FUNCTION public.complete_graceward_bible_quest(p_node_id integer, p_answers integer[])
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_expected integer[];
  v_score integer := 0;
  v_award integer;
  v_existing public.graceward_adventure_completions%ROWTYPE;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.user_companion WHERE user_id = v_user
    AND product_mode = 'graceward' AND current_stage >= 1) THEN
    RAISE EXCEPTION 'A hatched Graceward companion is required';
  END IF;
  IF p_node_id IS NULL OR p_node_id NOT BETWEEN 1 AND 3 THEN RAISE EXCEPTION 'Unknown trail'; END IF;
  IF p_answers IS NULL OR array_ndims(p_answers) IS DISTINCT FROM 1
    OR cardinality(p_answers) <> 5 OR array_lower(p_answers, 1) <> 1
    OR EXISTS (SELECT 1 FROM unnest(p_answers) a WHERE a IS NULL OR a NOT BETWEEN 0 AND 3) THEN
    RAISE EXCEPTION 'Five valid answers are required';
  END IF;
  -- Serialize all chapter rewards for this account, including concurrent devices.
  PERFORM pg_advisory_xact_lock(hashtextextended('graceward-adventure:' || v_user::text, 0));
  SELECT * INTO v_existing FROM public.graceward_adventure_completions
    WHERE user_id = v_user AND node_id = p_node_id;
  IF FOUND THEN
    RETURN jsonb_build_object('node_id', p_node_id, 'score', v_existing.score,
      'xp_awarded', v_existing.xp_awarded, 'coins_awarded', v_existing.coins_awarded, 'already_completed', true);
  END IF;
  IF p_node_id > 1 AND NOT EXISTS (SELECT 1 FROM public.graceward_adventure_completions
    WHERE user_id = v_user AND node_id = p_node_id - 1) THEN RAISE EXCEPTION 'Previous trail is incomplete'; END IF;
  v_expected := CASE p_node_id WHEN 1 THEN ARRAY[1,0,2,1,3] WHEN 2 THEN ARRAY[0,2,1,3,0] ELSE ARRAY[1,2,3,0,1] END;
  FOR i IN 1..5 LOOP
    IF p_answers[i] = v_expected[i] THEN v_score := v_score + 1; END IF;
  END LOOP;
  -- Participation earns progress; correctness is a personal learning score.
  -- Reuse the existing atomic writer and its caps/evolution bookkeeping.
  SELECT a.xp_awarded INTO STRICT v_award FROM public.award_xp_v2(
    'challenge_complete', 20,
    jsonb_build_object('source', 'graceward_bible_quest', 'content_version', 1, 'node_id', p_node_id, 'score', v_score),
    'graceward:bible-quest:v1:' || p_node_id::text
  ) a;
  INSERT INTO public.graceward_adventure_completions(user_id, node_id, score, xp_awarded)
    VALUES(v_user, p_node_id, v_score, v_award);
  RETURN jsonb_build_object('node_id', p_node_id, 'score', v_score,
    'xp_awarded', v_award, 'coins_awarded', 10, 'already_completed', false);
END;
$$;
REVOKE ALL ON FUNCTION public.get_graceward_adventure_progress() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.complete_graceward_bible_quest(integer, integer[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_graceward_adventure_progress() TO authenticated;
GRANT EXECUTE ON FUNCTION public.complete_graceward_bible_quest(integer, integer[]) TO authenticated;
COMMIT;
