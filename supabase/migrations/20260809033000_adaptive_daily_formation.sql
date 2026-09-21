-- Graceward prepares one reviewed Faithful Step per local day. The client may
-- choose from the reviewed library using private user signals, while these
-- tables keep the assignment stable and make its Formation XP idempotent.

CREATE TABLE public.daily_formation_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  practice_date date NOT NULL,
  practice_key text NOT NULL,
  category text NOT NULL,
  title text NOT NULL,
  action text NOT NULL,
  benefit text NOT NULL,
  minutes integer NOT NULL,
  xp_reward integer NOT NULL DEFAULT 10,
  selection_reason text NOT NULL DEFAULT 'Prepared for today',
  task_id uuid REFERENCES public.daily_tasks(id) ON DELETE SET NULL,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT daily_formation_assignments_user_date_key UNIQUE (user_id, practice_date),
  CONSTRAINT daily_formation_assignments_practice_key_check
    CHECK (practice_key ~ '^formation-[0-9]{2}$'),
  CONSTRAINT daily_formation_assignments_category_check
    CHECK (category IN ('Faith', 'Mind', 'Body', 'Relationships', 'Stewardship', 'Service', 'Rest')),
  CONSTRAINT daily_formation_assignments_minutes_check CHECK (minutes BETWEEN 1 AND 15),
  CONSTRAINT daily_formation_assignments_xp_check CHECK (xp_reward = 10)
);

CREATE INDEX daily_formation_assignments_user_history_idx
  ON public.daily_formation_assignments (user_id, practice_date DESC);

CREATE TABLE public.formation_progress (
  user_id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  total_xp integer NOT NULL DEFAULT 0 CHECK (total_xp >= 0),
  practices_completed integer NOT NULL DEFAULT 0 CHECK (practices_completed >= 0),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.formation_xp_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  assignment_id uuid NOT NULL REFERENCES public.daily_formation_assignments(id) ON DELETE CASCADE,
  xp_awarded integer NOT NULL CHECK (xp_awarded = 10),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT formation_xp_events_assignment_key UNIQUE (assignment_id)
);

CREATE INDEX formation_xp_events_user_created_idx
  ON public.formation_xp_events (user_id, created_at DESC);

ALTER TABLE public.daily_formation_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.formation_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.formation_xp_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their daily formation assignments"
  ON public.daily_formation_assignments FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can view their formation progress"
  ON public.formation_progress FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can view their formation XP events"
  ON public.formation_xp_events FOR SELECT
  USING (auth.uid() = user_id);

GRANT SELECT ON public.daily_formation_assignments TO authenticated;
GRANT SELECT ON public.formation_progress TO authenticated;
GRANT SELECT ON public.formation_xp_events TO authenticated;

CREATE TRIGGER set_daily_formation_assignments_updated_at
  BEFORE UPDATE ON public.daily_formation_assignments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.prepare_daily_formation_practice(
  p_practice_date date,
  p_practice_key text,
  p_category text,
  p_title text,
  p_action text,
  p_benefit text,
  p_minutes integer,
  p_selection_reason text DEFAULT 'Prepared for today'
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
SET search_path = public
AS $function$
DECLARE
  v_user_id uuid := auth.uid();
  v_assignment public.daily_formation_assignments%ROWTYPE;
  v_task_id uuid;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '42501';
  END IF;

  IF p_practice_date IS NULL
    OR p_practice_date < current_date - 1
    OR p_practice_date > current_date + 1 THEN
    RAISE EXCEPTION 'Practice date must be the user''s current local day';
  END IF;
  IF p_practice_key IS NULL OR p_practice_key !~ '^formation-[0-9]{2}$' THEN
    RAISE EXCEPTION 'Unknown formation practice';
  END IF;
  IF p_category NOT IN ('Faith', 'Mind', 'Body', 'Relationships', 'Stewardship', 'Service', 'Rest') THEN
    RAISE EXCEPTION 'Unknown formation category';
  END IF;
  IF p_minutes IS NULL OR p_minutes NOT BETWEEN 1 AND 15 THEN
    RAISE EXCEPTION 'Practice duration is invalid';
  END IF;
  IF length(btrim(COALESCE(p_title, ''))) NOT BETWEEN 1 AND 120
    OR length(btrim(COALESCE(p_action, ''))) NOT BETWEEN 1 AND 600
    OR length(btrim(COALESCE(p_benefit, ''))) NOT BETWEEN 1 AND 600 THEN
    RAISE EXCEPTION 'Practice copy is invalid';
  END IF;

  INSERT INTO public.daily_formation_assignments (
    user_id,
    practice_date,
    practice_key,
    category,
    title,
    action,
    benefit,
    minutes,
    xp_reward,
    selection_reason
  ) VALUES (
    v_user_id,
    p_practice_date,
    p_practice_key,
    p_category,
    btrim(p_title),
    btrim(p_action),
    btrim(p_benefit),
    p_minutes,
    10,
    left(btrim(COALESCE(NULLIF(p_selection_reason, ''), 'Prepared for today')), 160)
  )
  ON CONFLICT ON CONSTRAINT daily_formation_assignments_user_date_key DO NOTHING;

  SELECT * INTO v_assignment
  FROM public.daily_formation_assignments AS assignment
  WHERE assignment.user_id = v_user_id
    AND assignment.practice_date = p_practice_date
  FOR UPDATE;

  IF v_assignment.task_id IS NULL THEN
    SELECT task.id INTO v_task_id
    FROM public.daily_tasks AS task
    WHERE task.user_id = v_user_id
      AND task.task_date = p_practice_date
      AND task.source = 'faithful_step'
    ORDER BY task.created_at ASC NULLS LAST
    LIMIT 1;

    IF v_task_id IS NULL THEN
      INSERT INTO public.daily_tasks (
        user_id,
        task_text,
        difficulty,
        xp_reward,
        task_date,
        completed,
        is_main_quest,
        scheduled_time,
        reminder_enabled,
        category,
        notes,
        source,
        ai_generated
      ) VALUES (
        v_user_id,
        v_assignment.action,
        'easy',
        10,
        v_assignment.practice_date,
        false,
        true,
        NULL,
        false,
        CASE
          WHEN v_assignment.category = 'Body' THEN 'body'
          WHEN v_assignment.category = 'Mind' THEN 'mind'
          ELSE 'soul'
        END,
        v_assignment.title || ' · ' || v_assignment.benefit,
        'faithful_step',
        true
      )
      RETURNING id INTO v_task_id;
    END IF;

    UPDATE public.daily_formation_assignments
    SET task_id = v_task_id
    WHERE id = v_assignment.id
    RETURNING * INTO v_assignment;
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

CREATE OR REPLACE FUNCTION public.complete_daily_formation_practice(
  p_assignment_id uuid
)
RETURNS TABLE (
  status text,
  assignment_id uuid,
  task_id uuid,
  completed_at timestamptz,
  xp_awarded integer,
  total_xp integer,
  practices_completed integer,
  level_after integer,
  xp_into_level integer,
  xp_to_next_level integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_user_id uuid := auth.uid();
  v_assignment public.daily_formation_assignments%ROWTYPE;
  v_progress public.formation_progress%ROWTYPE;
  v_completed_at timestamptz;
  v_awarded integer := 0;
  v_status text := 'already_completed';
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_assignment
  FROM public.daily_formation_assignments AS assignment
  WHERE assignment.id = p_assignment_id
    AND assignment.user_id = v_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Formation practice not found';
  END IF;

  INSERT INTO public.formation_progress (user_id)
  VALUES (v_user_id)
  ON CONFLICT (user_id) DO NOTHING;

  IF v_assignment.completed_at IS NULL THEN
    v_completed_at := now();

    UPDATE public.daily_tasks
    SET completed = true, completed_at = v_completed_at
    WHERE id = v_assignment.task_id
      AND user_id = v_user_id;

    INSERT INTO public.formation_xp_events (user_id, assignment_id, xp_awarded)
    VALUES (v_user_id, v_assignment.id, v_assignment.xp_reward)
    ON CONFLICT ON CONSTRAINT formation_xp_events_assignment_key DO NOTHING;

    IF FOUND THEN
      UPDATE public.formation_progress AS progress
      SET
        total_xp = progress.total_xp + v_assignment.xp_reward,
        practices_completed = progress.practices_completed + 1,
        updated_at = v_completed_at
      WHERE progress.user_id = v_user_id;
      v_awarded := v_assignment.xp_reward;
      v_status := 'completed';
    END IF;

    UPDATE public.daily_formation_assignments
    SET completed_at = v_completed_at
    WHERE id = v_assignment.id;
  ELSE
    v_completed_at := v_assignment.completed_at;
  END IF;

  SELECT * INTO v_progress
  FROM public.formation_progress AS progress
  WHERE progress.user_id = v_user_id;

  RETURN QUERY SELECT
    v_status,
    v_assignment.id,
    v_assignment.task_id,
    v_completed_at,
    v_awarded,
    v_progress.total_xp,
    v_progress.practices_completed,
    floor(v_progress.total_xp / 100.0)::integer + 1,
    mod(v_progress.total_xp, 100),
    100 - mod(v_progress.total_xp, 100);
END;
$function$;

REVOKE ALL ON FUNCTION public.prepare_daily_formation_practice(date, text, text, text, text, text, integer, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.complete_daily_formation_practice(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.prepare_daily_formation_practice(date, text, text, text, text, text, integer, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.prepare_daily_formation_practice(date, text, text, text, text, text, integer, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.complete_daily_formation_practice(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.complete_daily_formation_practice(uuid) TO service_role;

COMMENT ON TABLE public.daily_formation_assignments IS
  'One stable, reviewed Faithful Step automatically prepared for each Graceward user day.';
COMMENT ON TABLE public.formation_progress IS
  'Graceward Formation XP, intentionally independent from legacy companion progression.';
COMMENT ON FUNCTION public.complete_daily_formation_practice(uuid) IS
  'Atomically completes a Faithful Step and awards its Formation XP exactly once.';
