BEGIN;

DO $setup$
DECLARE
  v_user_id uuid;
  v_total_xp integer;
  v_practices_completed integer;
BEGIN
  SELECT profile.id,
    COALESCE(progress.total_xp, 0),
    COALESCE(progress.practices_completed, 0)
  INTO v_user_id, v_total_xp, v_practices_completed
  FROM public.profiles AS profile
  LEFT JOIN public.formation_progress AS progress ON progress.user_id = profile.id
  LEFT JOIN public.daily_formation_assignments AS assignment
    ON assignment.user_id = profile.id
    AND assignment.practice_date = current_date
  WHERE assignment.id IS NULL
  LIMIT 1;

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'No existing profile is available for the transactional smoke test';
  END IF;

  PERFORM set_config('request.jwt.claim.sub', v_user_id::text, true);
  PERFORM set_config('formation.smoke.baseline_xp', v_total_xp::text, true);
  PERFORM set_config('formation.smoke.baseline_completions', v_practices_completed::text, true);
END;
$setup$;
SET LOCAL ROLE authenticated;

DO $test$
DECLARE
  v_mind record;
  v_body record;
  v_soul record;
  v_first_completion record;
  v_second_completion record;
  v_task_count integer;
  v_baseline_xp integer := current_setting('formation.smoke.baseline_xp')::integer;
  v_baseline_completions integer := current_setting('formation.smoke.baseline_completions')::integer;
BEGIN
  SELECT * INTO v_mind
  FROM public.prepare_daily_formation_practice(
    current_date,
    'formation-02',
    'Mind',
    'Learn one new thing',
    'Read one page about a subject you want to understand, then write down one new fact.',
    'Practices active learning by turning reading into knowledge you can recall.',
    5,
    'Prepared for today'
  );

  SELECT * INTO v_body
  FROM public.prepare_daily_formation_practice(
    current_date,
    'formation-03',
    'Body',
    'Wake your joints',
    'Gently circle your shoulders, hips, and ankles through a comfortable range.',
    'Practices simple mobility that helps the body feel ready to move.',
    2,
    'Prepared for today'
  );

  SELECT * INTO v_soul
  FROM public.prepare_daily_formation_practice(
    current_date,
    'formation-04',
    'Soul',
    'Read one Psalm',
    'Read eight lines from a Psalm slowly, then choose one phrase to carry today.',
    'Practices receiving Scripture attentively and remembering truth from God''s Word.',
    4,
    'Prepared for today'
  );

  IF v_mind.assignment_id IS NULL OR v_mind.task_id IS NULL
    OR v_body.assignment_id IS NULL OR v_body.task_id IS NULL
    OR v_soul.assignment_id IS NULL OR v_soul.task_id IS NULL THEN
    RAISE EXCEPTION 'Pillar preparation did not create and link all six records';
  END IF;

  IF v_mind.assignment_id = v_body.assignment_id
    OR v_mind.assignment_id = v_soul.assignment_id
    OR v_body.assignment_id = v_soul.assignment_id THEN
    RAISE EXCEPTION 'Mind, Body, and Soul unexpectedly shared an assignment';
  END IF;

  SELECT count(*) INTO v_task_count
  FROM public.daily_tasks
  WHERE user_id = auth.uid()
    AND task_date = current_date
    AND source = 'faithful_step';

  IF v_task_count <> 3 THEN
    RAISE EXCEPTION 'Expected three pillar tasks, found %', v_task_count;
  END IF;

  SELECT * INTO v_first_completion
  FROM public.complete_daily_formation_practice(v_soul.assignment_id);

  SELECT * INTO v_second_completion
  FROM public.complete_daily_formation_practice(v_soul.assignment_id);

  IF v_first_completion.status <> 'completed'
    OR v_first_completion.xp_awarded <> 10
    OR v_first_completion.total_xp <> v_baseline_xp + 10
    OR v_first_completion.practices_completed <> v_baseline_completions + 1 THEN
    RAISE EXCEPTION 'First completion result was incorrect: %', row_to_json(v_first_completion);
  END IF;

  IF v_second_completion.status <> 'already_completed'
    OR v_second_completion.xp_awarded <> 0
    OR v_second_completion.total_xp <> v_baseline_xp + 10
    OR v_second_completion.practices_completed <> v_baseline_completions + 1 THEN
    RAISE EXCEPTION 'Repeated completion was not idempotent: %', row_to_json(v_second_completion);
  END IF;
END;
$test$;

RESET ROLE;
ROLLBACK;
