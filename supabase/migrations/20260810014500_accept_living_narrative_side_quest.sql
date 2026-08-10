BEGIN;

ALTER TABLE public.daily_tasks
  DROP CONSTRAINT IF EXISTS daily_tasks_source_check;

ALTER TABLE public.daily_tasks
  ADD CONSTRAINT daily_tasks_source_check
  CHECK (
    source = ANY (
      ARRAY[
        'manual',
        'voice',
        'nlp',
        'inbox',
        'recurring',
        'onboarding',
        'plan_my_day',
        'outlook_sync',
        'companion'
      ]
    )
  );

CREATE OR REPLACE FUNCTION public.accept_companion_narrative_side_quest(
  p_choice_id uuid
)
RETURNS public.daily_tasks
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_choice public.companion_narrative_choices;
  v_task public.daily_tasks;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501';
  END IF;

  SELECT choice.*
  INTO v_choice
  FROM public.companion_narrative_choices choice
  WHERE choice.id = p_choice_id
    AND choice.user_id = v_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Narrative choice not found' USING ERRCODE = '42501';
  END IF;

  IF v_choice.side_quest_status = 'dismissed' THEN
    RAISE EXCEPTION 'This side quest was dismissed' USING ERRCODE = '22023';
  END IF;

  IF v_choice.side_quest_title IS NULL OR trim(v_choice.side_quest_title) = '' THEN
    RAISE EXCEPTION 'This choice has no side quest' USING ERRCODE = '22023';
  END IF;

  IF v_choice.side_quest_task_id IS NOT NULL THEN
    SELECT task.*
    INTO v_task
    FROM public.daily_tasks task
    WHERE task.id = v_choice.side_quest_task_id
      AND task.user_id = v_user_id;

    IF FOUND THEN
      RETURN v_task;
    END IF;
  END IF;

  INSERT INTO public.daily_tasks (
    user_id,
    task_text,
    task_date,
    scheduled_time,
    difficulty,
    xp_reward,
    completed,
    is_main_quest,
    source,
    notes
  )
  VALUES (
    v_user_id,
    left(trim(v_choice.side_quest_title), 180),
    NULL,
    NULL,
    'easy',
    12,
    false,
    false,
    'companion',
    'Suggested by your Cosmiq companion after a story choice.'
  )
  RETURNING * INTO v_task;

  UPDATE public.companion_narrative_choices
  SET
    side_quest_status = 'accepted',
    side_quest_task_id = v_task.id
  WHERE id = v_choice.id
    AND user_id = v_user_id;

  RETURN v_task;
END;
$$;

REVOKE ALL ON FUNCTION public.accept_companion_narrative_side_quest(uuid)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.accept_companion_narrative_side_quest(uuid)
  TO authenticated;

COMMIT;
