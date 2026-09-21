-- One private thread carries the user's Guide-led intention through a local day.
-- It connects the daily encouragement, Faithful Step, companion acknowledgement,
-- and evening reflection without treating any of them as a measure of faith.

BEGIN;

CREATE TABLE public.daily_guide_threads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  thread_date date NOT NULL,
  mentor_id uuid REFERENCES public.mentors(id) ON DELETE SET NULL,
  mentor_name text,
  daily_pep_talk_id uuid REFERENCES public.daily_pep_talks(id) ON DELETE SET NULL,
  encouragement_title text,
  encouragement_completed_at timestamptz,
  guide_question_id text,
  guide_question text,
  focus_option_id text,
  focus_label text,
  focus_category text,
  focus_answered_at timestamptz,
  companion_response text,
  companion_acknowledged_at timestamptz,
  practice_assignment_id uuid REFERENCES public.daily_formation_assignments(id) ON DELETE SET NULL,
  practice_key text,
  practice_completed_at timestamptz,
  evening_reflection_id uuid REFERENCES public.evening_reflections(id) ON DELETE SET NULL,
  evening_reflected_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT daily_guide_threads_user_date_key UNIQUE (user_id, thread_date),
  CONSTRAINT daily_guide_threads_mentor_name_length CHECK (
    mentor_name IS NULL OR length(mentor_name) BETWEEN 1 AND 80
  ),
  CONSTRAINT daily_guide_threads_focus_category_check CHECK (
    focus_category IS NULL OR focus_category IN (
      'Faith', 'Mind', 'Body', 'Relationships', 'Stewardship', 'Service', 'Rest'
    )
  ),
  CONSTRAINT daily_guide_threads_focus_answer_check CHECK (
    (focus_option_id IS NULL AND focus_label IS NULL AND focus_answered_at IS NULL)
    OR
    (focus_option_id IS NOT NULL AND focus_label IS NOT NULL AND focus_answered_at IS NOT NULL)
  )
);

CREATE INDEX daily_guide_threads_user_recent_idx
  ON public.daily_guide_threads (user_id, thread_date DESC);

ALTER TABLE public.daily_guide_threads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own daily Guide threads"
  ON public.daily_guide_threads FOR SELECT TO authenticated
  USING ((SELECT auth.uid()) = user_id);

CREATE POLICY "Users can create their own daily Guide threads"
  ON public.daily_guide_threads FOR INSERT TO authenticated
  WITH CHECK ((SELECT auth.uid()) = user_id);

CREATE POLICY "Users can update their own daily Guide threads"
  ON public.daily_guide_threads FOR UPDATE TO authenticated
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);

GRANT SELECT, INSERT, UPDATE ON public.daily_guide_threads TO authenticated;

CREATE TRIGGER set_daily_guide_threads_updated_at
  BEFORE UPDATE ON public.daily_guide_threads
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

COMMENT ON TABLE public.daily_guide_threads IS
  'Private daily continuity shared by a user''s Guide, companion, Faithful Step, and evening reflection.';

-- A Guide-focus answer may realign an incomplete Faithful Step. The reviewed
-- client library still supplies the copy; this function validates and updates
-- the existing assignment and its linked task atomically.
CREATE OR REPLACE FUNCTION public.align_daily_formation_practice(
  p_assignment_id uuid,
  p_practice_key text,
  p_category text,
  p_title text,
  p_action text,
  p_benefit text,
  p_minutes integer,
  p_selection_reason text
)
RETURNS TABLE (
  assignment_id uuid,
  practice_date date,
  practice_key text,
  category text,
  title text,
  action text,
  benefit text,
  minutes integer,
  xp_reward integer,
  selection_reason text,
  task_id uuid,
  completed_at timestamptz,
  total_xp integer,
  practices_completed integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_user_id uuid := auth.uid();
  v_assignment public.daily_formation_assignments%ROWTYPE;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '42501';
  END IF;

  IF p_practice_key IS NULL OR p_practice_key !~ '^formation-[0-9]{2}$' THEN
    RAISE EXCEPTION 'Unknown formation practice' USING ERRCODE = '22023';
  END IF;
  IF p_category NOT IN ('Faith', 'Mind', 'Body', 'Relationships', 'Stewardship', 'Service', 'Rest') THEN
    RAISE EXCEPTION 'Unknown formation category' USING ERRCODE = '22023';
  END IF;
  IF p_minutes IS NULL OR p_minutes NOT BETWEEN 1 AND 15 THEN
    RAISE EXCEPTION 'Practice duration is invalid' USING ERRCODE = '22023';
  END IF;
  IF length(btrim(COALESCE(p_title, ''))) NOT BETWEEN 1 AND 120
    OR length(btrim(COALESCE(p_action, ''))) NOT BETWEEN 1 AND 600
    OR length(btrim(COALESCE(p_benefit, ''))) NOT BETWEEN 1 AND 600 THEN
    RAISE EXCEPTION 'Practice copy is invalid' USING ERRCODE = '22023';
  END IF;

  SELECT assignment.* INTO v_assignment
  FROM public.daily_formation_assignments AS assignment
  WHERE assignment.id = p_assignment_id
    AND assignment.user_id = v_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Faithful Step not found' USING ERRCODE = 'P0002';
  END IF;

  IF v_assignment.completed_at IS NULL THEN
    UPDATE public.daily_formation_assignments AS assignment
    SET
      practice_key = p_practice_key,
      category = p_category,
      title = btrim(p_title),
      action = btrim(p_action),
      benefit = btrim(p_benefit),
      minutes = p_minutes,
      selection_reason = left(btrim(COALESCE(NULLIF(p_selection_reason, ''), 'Connected to today''s Guide reflection')), 160),
      updated_at = now()
    WHERE assignment.id = v_assignment.id
    RETURNING assignment.* INTO v_assignment;

    IF v_assignment.task_id IS NOT NULL THEN
      UPDATE public.daily_tasks AS task
      SET
        task_text = v_assignment.action,
        category = CASE
          WHEN v_assignment.category = 'Body' THEN 'body'
          WHEN v_assignment.category = 'Mind' THEN 'mind'
          ELSE 'soul'
        END,
        notes = v_assignment.title || ' · ' || v_assignment.benefit
      WHERE task.id = v_assignment.task_id
        AND task.user_id = v_user_id
        AND task.completed = false;
    END IF;
  END IF;

  INSERT INTO public.formation_progress (user_id)
  VALUES (v_user_id)
  ON CONFLICT (user_id) DO NOTHING;

  RETURN QUERY
  SELECT
    v_assignment.id,
    v_assignment.practice_date,
    v_assignment.practice_key,
    v_assignment.category,
    v_assignment.title,
    v_assignment.action,
    v_assignment.benefit,
    v_assignment.minutes,
    v_assignment.xp_reward,
    v_assignment.selection_reason,
    v_assignment.task_id,
    v_assignment.completed_at,
    progress.total_xp,
    progress.practices_completed
  FROM public.formation_progress AS progress
  WHERE progress.user_id = v_user_id;
END;
$function$;

REVOKE ALL ON FUNCTION public.align_daily_formation_practice(
  uuid, text, text, text, text, text, integer, text
) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.align_daily_formation_practice(
  uuid, text, text, text, text, text, integer, text
) FROM anon;
GRANT EXECUTE ON FUNCTION public.align_daily_formation_practice(
  uuid, text, text, text, text, text, integer, text
) TO authenticated;
GRANT EXECUTE ON FUNCTION public.align_daily_formation_practice(
  uuid, text, text, text, text, text, integer, text
) TO service_role;

COMMENT ON FUNCTION public.align_daily_formation_practice(
  uuid, text, text, text, text, text, integer, text
) IS 'Realigns an authenticated user''s incomplete Faithful Step with today''s Guide-focus answer.';

COMMIT;
