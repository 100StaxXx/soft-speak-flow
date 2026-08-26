-- Graceward's primary daily loop is one reviewed quest in each formation pillar:
-- Mind, Body, and Soul. Assignments remain stable for the user's local day and
-- every completion remains independently idempotent.

BEGIN;

-- Remove the legacy one-step constraints before translating existing rows to
-- the new Soul category; the old category check does not recognize that value.
ALTER TABLE public.daily_formation_assignments
  DROP CONSTRAINT IF EXISTS daily_formation_assignments_category_check,
  DROP CONSTRAINT IF EXISTS daily_formation_assignments_practice_category_check,
  DROP CONSTRAINT IF EXISTS daily_formation_assignments_user_date_key;

UPDATE public.daily_formation_assignments
SET category = CASE
  WHEN practice_key IN (
    'formation-02', 'formation-05', 'formation-09', 'formation-12',
    'formation-16', 'formation-19', 'formation-23', 'formation-26'
  ) THEN 'Mind'
  WHEN practice_key IN (
    'formation-03', 'formation-07', 'formation-10', 'formation-14',
    'formation-17', 'formation-21', 'formation-24', 'formation-28'
  ) THEN 'Body'
  ELSE 'Soul'
END;

-- The old one-step routine could create a linked task with a different pillar
-- from its reviewed practice. Repair that denormalized category at the same time.
UPDATE public.daily_tasks AS task
SET category = lower(assignment.category)
FROM public.daily_formation_assignments AS assignment
WHERE task.id = assignment.task_id
  AND task.user_id = assignment.user_id
  AND task.source = 'faithful_step';

ALTER TABLE public.daily_formation_assignments
  ADD CONSTRAINT daily_formation_assignments_category_check
    CHECK (category IN ('Mind', 'Body', 'Soul')),
  ADD CONSTRAINT daily_formation_assignments_practice_category_check CHECK (
    (
      category = 'Mind'
      AND practice_key IN (
        'formation-02', 'formation-05', 'formation-09', 'formation-12',
        'formation-16', 'formation-19', 'formation-23', 'formation-26'
      )
    ) OR (
      category = 'Body'
      AND practice_key IN (
        'formation-03', 'formation-07', 'formation-10', 'formation-14',
        'formation-17', 'formation-21', 'formation-24', 'formation-28'
      )
    ) OR (
      category = 'Soul'
      AND practice_key IN (
        'formation-01', 'formation-04', 'formation-06', 'formation-08',
        'formation-11', 'formation-13', 'formation-15', 'formation-18',
        'formation-20', 'formation-22', 'formation-25', 'formation-27'
      )
    )
  ),
  ADD CONSTRAINT daily_formation_assignments_user_date_category_key
    UNIQUE (user_id, practice_date, category);

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
  v_task_category text;
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
  IF p_category NOT IN ('Mind', 'Body', 'Soul') THEN
    RAISE EXCEPTION 'Unknown formation category';
  END IF;
  IF (p_category = 'Mind' AND p_practice_key NOT IN (
      'formation-02', 'formation-05', 'formation-09', 'formation-12',
      'formation-16', 'formation-19', 'formation-23', 'formation-26'
    )) OR (p_category = 'Body' AND p_practice_key NOT IN (
      'formation-03', 'formation-07', 'formation-10', 'formation-14',
      'formation-17', 'formation-21', 'formation-24', 'formation-28'
    )) OR (p_category = 'Soul' AND p_practice_key NOT IN (
      'formation-01', 'formation-04', 'formation-06', 'formation-08',
      'formation-11', 'formation-13', 'formation-15', 'formation-18',
      'formation-20', 'formation-22', 'formation-25', 'formation-27'
    )) THEN
    RAISE EXCEPTION 'Formation practice does not belong to the requested category';
  END IF;
  IF p_minutes IS NULL OR p_minutes NOT BETWEEN 1 AND 15 THEN
    RAISE EXCEPTION 'Practice duration is invalid';
  END IF;
  IF length(btrim(COALESCE(p_title, ''))) NOT BETWEEN 1 AND 120
    OR length(btrim(COALESCE(p_action, ''))) NOT BETWEEN 1 AND 600
    OR length(btrim(COALESCE(p_benefit, ''))) NOT BETWEEN 1 AND 600 THEN
    RAISE EXCEPTION 'Practice copy is invalid';
  END IF;

  v_task_category := lower(p_category);

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
  ON CONFLICT ON CONSTRAINT daily_formation_assignments_user_date_category_key DO NOTHING;

  SELECT assignment.* INTO v_assignment
  FROM public.daily_formation_assignments AS assignment
  WHERE assignment.user_id = v_user_id
    AND assignment.practice_date = p_practice_date
    AND assignment.category = p_category
  FOR UPDATE;

  IF v_assignment.task_id IS NULL THEN
    SELECT task.id INTO v_task_id
    FROM public.daily_tasks AS task
    WHERE task.user_id = v_user_id
      AND task.task_date = p_practice_date
      AND task.source = 'faithful_step'
      AND task.category = v_task_category
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
        v_task_category,
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
SET search_path = public
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
  IF p_category NOT IN ('Mind', 'Body', 'Soul') THEN
    RAISE EXCEPTION 'Unknown formation category' USING ERRCODE = '22023';
  END IF;
  IF (p_category = 'Mind' AND p_practice_key NOT IN (
      'formation-02', 'formation-05', 'formation-09', 'formation-12',
      'formation-16', 'formation-19', 'formation-23', 'formation-26'
    )) OR (p_category = 'Body' AND p_practice_key NOT IN (
      'formation-03', 'formation-07', 'formation-10', 'formation-14',
      'formation-17', 'formation-21', 'formation-24', 'formation-28'
    )) OR (p_category = 'Soul' AND p_practice_key NOT IN (
      'formation-01', 'formation-04', 'formation-06', 'formation-08',
      'formation-11', 'formation-13', 'formation-15', 'formation-18',
      'formation-20', 'formation-22', 'formation-25', 'formation-27'
    )) THEN
    RAISE EXCEPTION 'Formation practice does not belong to the requested category' USING ERRCODE = '22023';
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
  IF v_assignment.category <> p_category THEN
    RAISE EXCEPTION 'Faithful Steps can only be aligned within their existing pillar' USING ERRCODE = '22023';
  END IF;

  IF v_assignment.completed_at IS NULL THEN
    UPDATE public.daily_formation_assignments AS assignment
    SET
      practice_key = p_practice_key,
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
        category = lower(v_assignment.category),
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
) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.align_daily_formation_practice(
  uuid, text, text, text, text, text, integer, text
) TO authenticated, service_role;

COMMENT ON TABLE public.daily_formation_assignments IS
  'One stable reviewed Mind, Body, and Soul quest per Graceward user day.';
COMMENT ON FUNCTION public.prepare_daily_formation_practice(date, text, text, text, text, text, integer, text) IS
  'Prepares one idempotent reviewed daily quest for the requested Mind, Body, or Soul pillar.';

COMMIT;
