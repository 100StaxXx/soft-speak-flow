-- daily_plans: persisted draft/committed plans built by Cosmiq's Plan-my-day flow.
-- One row per (user, plan_date). Blocks live as JSONB so the shape can evolve
-- without migrations.

CREATE TABLE IF NOT EXISTS public.daily_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  plan_date date NOT NULL,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'committed')),
  blocks jsonb NOT NULL DEFAULT '[]'::jsonb,
  source text NOT NULL DEFAULT 'companion-planner',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  committed_at timestamptz
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_daily_plans_user_date
  ON public.daily_plans (user_id, plan_date);

CREATE INDEX IF NOT EXISTS idx_daily_plans_user_status
  ON public.daily_plans (user_id, status);

ALTER TABLE public.daily_plans ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own daily plans" ON public.daily_plans;
CREATE POLICY "Users can view own daily plans"
  ON public.daily_plans
  FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own daily plans" ON public.daily_plans;
CREATE POLICY "Users can insert own daily plans"
  ON public.daily_plans
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own daily plans" ON public.daily_plans;
CREATE POLICY "Users can update own daily plans"
  ON public.daily_plans
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own daily plans" ON public.daily_plans;
CREATE POLICY "Users can delete own daily plans"
  ON public.daily_plans
  FOR DELETE
  USING (auth.uid() = user_id);

-- Trigger keeps updated_at fresh on edits.
CREATE OR REPLACE FUNCTION public.touch_daily_plans_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS daily_plans_touch_updated_at ON public.daily_plans;
CREATE TRIGGER daily_plans_touch_updated_at
  BEFORE UPDATE ON public.daily_plans
  FOR EACH ROW
  EXECUTE FUNCTION public.touch_daily_plans_updated_at();

-- upsert_day_plan_draft: persist the in-memory DayPlan returned by the planner
-- as a draft row (one per user/date). Refuses to overwrite a row that has
-- already been committed.
CREATE OR REPLACE FUNCTION public.upsert_day_plan_draft(
  p_plan_date date,
  p_blocks jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_id uuid := auth.uid();
  v_existing public.daily_plans%ROWTYPE;
  v_id uuid;
BEGIN
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'upsert_day_plan_draft requires an authenticated caller'
      USING ERRCODE = '42501';
  END IF;

  IF jsonb_typeof(p_blocks) <> 'array' THEN
    RAISE EXCEPTION 'blocks must be a JSON array'
      USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_existing
  FROM public.daily_plans
  WHERE user_id = v_caller_id AND plan_date = p_plan_date
  FOR UPDATE;

  IF FOUND AND v_existing.status = 'committed' THEN
    RAISE EXCEPTION 'plan for that date is already committed'
      USING ERRCODE = '22023';
  END IF;

  IF FOUND THEN
    UPDATE public.daily_plans
    SET blocks = p_blocks
    WHERE id = v_existing.id
    RETURNING id INTO v_id;
  ELSE
    INSERT INTO public.daily_plans (user_id, plan_date, blocks, status)
    VALUES (v_caller_id, p_plan_date, p_blocks, 'draft')
    RETURNING id INTO v_id;
  END IF;

  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.upsert_day_plan_draft(date, jsonb) FROM public;
GRANT EXECUTE ON FUNCTION public.upsert_day_plan_draft(date, jsonb) TO authenticated;

-- apply_day_plan: transactional commit path the UI calls when the user taps
-- "Lock in plan". For each block in the draft, insert a daily_tasks row, mirror
-- the new task id back into blocks[*].questId, then mark the plan committed.
CREATE OR REPLACE FUNCTION public.apply_day_plan(p_plan_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_id uuid := auth.uid();
  v_plan public.daily_plans%ROWTYPE;
  v_block jsonb;
  v_block_index int := 0;
  v_new_task_id uuid;
  v_updated_blocks jsonb := '[]'::jsonb;
  v_inserted_ids uuid[] := ARRAY[]::uuid[];
  v_title text;
  v_start_time time;
  v_duration int;
  v_energy_type text;
  v_epic_id uuid;
  v_epic_id_text text;
  v_habit_source_id uuid;
  v_habit_source_id_text text;
  v_uuid_pattern text := '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';
BEGIN
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'apply_day_plan requires an authenticated caller'
      USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_plan
  FROM public.daily_plans
  WHERE id = p_plan_id AND user_id = v_caller_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'plan not found'
      USING ERRCODE = 'P0002';
  END IF;

  IF v_plan.status = 'committed' THEN
    RAISE EXCEPTION 'plan already committed'
      USING ERRCODE = '22023';
  END IF;

  FOR v_block IN SELECT * FROM jsonb_array_elements(v_plan.blocks)
  LOOP
    v_title := COALESCE(NULLIF(v_block ->> 'title', ''), 'Untitled');
    v_start_time := CASE
      WHEN v_block ->> 'startTime' ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
        THEN (v_block ->> 'startTime')::time
      ELSE NULL
    END;
    v_duration := COALESCE((v_block ->> 'durationMinutes')::int, 30);
    v_energy_type := NULLIF(v_block ->> 'energyType', '');
    v_epic_id_text := NULLIF(v_block ->> 'epicId', '');
    v_epic_id := CASE
      WHEN v_epic_id_text IS NULL THEN NULL
      WHEN v_epic_id_text ~* v_uuid_pattern THEN v_epic_id_text::uuid
      ELSE NULL
    END;
    v_habit_source_id_text := NULLIF(v_block ->> 'habitSourceId', '');
    v_habit_source_id := CASE
      WHEN v_habit_source_id_text IS NULL THEN NULL
      WHEN v_habit_source_id_text ~* v_uuid_pattern
        THEN v_habit_source_id_text::uuid
      ELSE NULL
    END;

    -- Flexible blocks (no startTime) land in inbox so they don't violate
    -- daily_tasks_regular_requires_time_or_inbox. Habit-linked blocks
    -- automatically satisfy the constraint via habit_source_id.
    INSERT INTO public.daily_tasks (
      user_id,
      task_text,
      task_date,
      scheduled_time,
      estimated_duration,
      energy_type,
      source,
      epic_id,
      habit_source_id
    )
    VALUES (
      v_caller_id,
      v_title,
      CASE WHEN v_start_time IS NULL THEN NULL ELSE v_plan.plan_date END,
      v_start_time,
      v_duration,
      v_energy_type,
      'plan_my_day',
      v_epic_id,
      v_habit_source_id
    )
    RETURNING id INTO v_new_task_id;

    v_inserted_ids := array_append(v_inserted_ids, v_new_task_id);
    v_updated_blocks := v_updated_blocks ||
      jsonb_build_object(
        'index', v_block_index,
        'questId', v_new_task_id,
        'block', v_block || jsonb_build_object('questId', v_new_task_id::text)
      );
    v_block_index := v_block_index + 1;
  END LOOP;

  UPDATE public.daily_plans
  SET
    status = 'committed',
    committed_at = now(),
    blocks = (
      SELECT COALESCE(jsonb_agg(elem -> 'block'), '[]'::jsonb)
      FROM jsonb_array_elements(v_updated_blocks) AS elem
    )
  WHERE id = p_plan_id;

  RETURN jsonb_build_object(
    'planId', p_plan_id,
    'committedTaskIds', to_jsonb(v_inserted_ids)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.apply_day_plan(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.apply_day_plan(uuid) TO authenticated;

NOTIFY pgrst, 'reload schema';
