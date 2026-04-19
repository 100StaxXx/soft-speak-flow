CREATE TABLE IF NOT EXISTS public.companion_stat_analyses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  companion_id UUID REFERENCES public.user_companion(id) ON DELETE CASCADE NOT NULL,
  mentor_id UUID REFERENCES public.mentors(id) ON DELETE SET NULL,
  analysis_date DATE NOT NULL,
  payload JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT companion_stat_analyses_user_analysis_date_key UNIQUE (user_id, analysis_date)
);

CREATE INDEX IF NOT EXISTS idx_companion_stat_analyses_user_date
  ON public.companion_stat_analyses(user_id, analysis_date DESC);

ALTER TABLE public.companion_stat_analyses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own companion stat analyses" ON public.companion_stat_analyses;
CREATE POLICY "Users can view own companion stat analyses"
  ON public.companion_stat_analyses
  FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own companion stat analyses" ON public.companion_stat_analyses;
CREATE POLICY "Users can insert own companion stat analyses"
  ON public.companion_stat_analyses
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own companion stat analyses" ON public.companion_stat_analyses;
CREATE POLICY "Users can update own companion stat analyses"
  ON public.companion_stat_analyses
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

REVOKE ALL ON public.companion_stat_analyses FROM PUBLIC, anon;
GRANT SELECT, INSERT, UPDATE ON public.companion_stat_analyses TO authenticated;

CREATE OR REPLACE FUNCTION public.award_companion_attribute(
  p_attribute TEXT,
  p_source_event TEXT,
  p_source_key TEXT,
  p_amount INTEGER,
  p_apply_echo_gains BOOLEAN DEFAULT TRUE
)
RETURNS TABLE(
  awarded_amount INTEGER,
  attribute_before INTEGER,
  attribute_after INTEGER,
  cap_applied BOOLEAN,
  was_duplicate BOOLEAN,
  echo_amount INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_attribute TEXT := LOWER(BTRIM(COALESCE(p_attribute, '')));
  v_source_event TEXT := LOWER(BTRIM(COALESCE(p_source_event, '')));
  v_source_key TEXT := BTRIM(COALESCE(p_source_key, ''));
  v_requested_amount INTEGER := COALESCE(p_amount, 0);
  v_apply_echo BOOLEAN := COALESCE(p_apply_echo_gains, TRUE);
  v_discipline_daily_cap CONSTANT INTEGER := 8;
  v_companion public.user_companion%ROWTYPE;
  v_existing public.companion_attribute_events%ROWTYPE;
  v_is_repeatable BOOLEAN := FALSE;
  v_today_awarded INTEGER := 0;
  v_awarded_amount INTEGER := 0;
  v_cap_applied BOOLEAN := FALSE;
  v_attribute_before INTEGER := 300;
  v_attribute_after INTEGER := 300;
  v_echo_amount INTEGER := 0;
  v_echo_targets TEXT[] := ARRAY[]::TEXT[];
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF v_attribute = '' THEN
    RAISE EXCEPTION 'attribute is required';
  END IF;

  IF v_source_event = '' THEN
    RAISE EXCEPTION 'source_event is required';
  END IF;

  IF v_source_key = '' THEN
    RAISE EXCEPTION 'source_key is required';
  END IF;

  IF v_requested_amount <= 0 THEN
    RAISE EXCEPTION 'amount must be positive';
  END IF;

  IF v_requested_amount > 100 THEN
    RAISE EXCEPTION 'amount exceeds allowed maximum';
  END IF;

  IF v_attribute NOT IN ('discipline', 'wisdom', 'alignment') THEN
    RAISE EXCEPTION 'Unsupported attribute: %', v_attribute;
  END IF;

  IF v_attribute = 'discipline' AND v_source_event NOT IN ('habit_complete', 'planned_task_on_time', 'streak_milestone') THEN
    RAISE EXCEPTION 'Unsupported source_event: %', v_source_event;
  ELSIF v_attribute = 'wisdom' AND v_source_event NOT IN ('habit_complete_learning') THEN
    RAISE EXCEPTION 'Unsupported source_event: %', v_source_event;
  ELSIF v_attribute = 'alignment' AND v_source_event NOT IN ('morning_check_in', 'evening_reflection') THEN
    RAISE EXCEPTION 'Unsupported source_event: %', v_source_event;
  END IF;

  SELECT *
  INTO v_companion
  FROM public.user_companion
  WHERE user_id = v_user_id
  ORDER BY created_at DESC
  LIMIT 1
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Companion not found';
  END IF;

  SELECT *
  INTO v_existing
  FROM public.companion_attribute_events
  WHERE user_id = v_user_id
    AND attribute = v_attribute
    AND source_key = v_source_key
  LIMIT 1;

  IF FOUND THEN
    RETURN QUERY
    SELECT
      v_existing.amount_awarded,
      v_existing.attribute_before,
      v_existing.attribute_after,
      v_existing.cap_applied,
      TRUE,
      v_existing.echo_amount;
    RETURN;
  END IF;

  v_attribute_before := COALESCE(
    CASE v_attribute
      WHEN 'discipline' THEN v_companion.discipline
      WHEN 'wisdom' THEN v_companion.wisdom
      WHEN 'alignment' THEN v_companion.alignment
      ELSE 300
    END,
    300
  );
  v_attribute_after := v_attribute_before;
  v_awarded_amount := v_requested_amount;
  v_is_repeatable := v_attribute = 'discipline' AND v_source_event IN ('habit_complete', 'planned_task_on_time');

  IF v_is_repeatable THEN
    SELECT COALESCE(SUM(cae.amount_awarded), 0)
    INTO v_today_awarded
    FROM public.companion_attribute_events cae
    WHERE cae.user_id = v_user_id
      AND cae.attribute = v_attribute
      AND cae.source_event IN ('habit_complete', 'planned_task_on_time')
      AND cae.created_at::DATE = CURRENT_DATE;

    IF v_today_awarded >= v_discipline_daily_cap THEN
      v_awarded_amount := 0;
      v_cap_applied := TRUE;
    ELSIF v_today_awarded + v_awarded_amount > v_discipline_daily_cap THEN
      v_awarded_amount := GREATEST(0, v_discipline_daily_cap - v_today_awarded);
      v_cap_applied := TRUE;
    END IF;
  END IF;

  IF v_awarded_amount > 0 THEN
    v_attribute_after := LEAST(1000, GREATEST(100, v_attribute_before + v_awarded_amount));

    IF v_apply_echo THEN
      v_echo_amount := LEAST(20, GREATEST(1, FLOOR(v_awarded_amount * 0.2)::INTEGER));
      v_echo_targets := CASE v_attribute
        WHEN 'discipline' THEN ARRAY['resolve']
        WHEN 'wisdom' THEN ARRAY['creativity', 'alignment']
        WHEN 'alignment' THEN ARRAY['resolve']
        ELSE ARRAY[]::TEXT[]
      END;
    END IF;

    UPDATE public.user_companion
    SET
      discipline = CASE
        WHEN v_attribute = 'discipline' THEN v_attribute_after
        ELSE discipline
      END,
      wisdom = CASE
        WHEN v_attribute = 'wisdom' THEN v_attribute_after
        ELSE wisdom
      END,
      alignment = CASE
        WHEN v_attribute = 'alignment' THEN v_attribute_after
        WHEN v_echo_amount > 0 AND 'alignment' = ANY(v_echo_targets)
          THEN LEAST(1000, GREATEST(100, COALESCE(alignment, 300) + v_echo_amount))
        ELSE alignment
      END,
      creativity = CASE
        WHEN v_echo_amount > 0 AND 'creativity' = ANY(v_echo_targets)
          THEN LEAST(1000, GREATEST(100, COALESCE(creativity, 300) + v_echo_amount))
        ELSE creativity
      END,
      resolve = CASE
        WHEN v_echo_amount > 0 AND 'resolve' = ANY(v_echo_targets)
          THEN LEAST(1000, GREATEST(100, COALESCE(resolve, 300) + v_echo_amount))
        ELSE resolve
      END,
      last_energy_update = NOW()
    WHERE id = v_companion.id;
  END IF;

  INSERT INTO public.companion_attribute_events (
    user_id,
    companion_id,
    attribute,
    source_event,
    source_key,
    amount_requested,
    amount_awarded,
    attribute_before,
    attribute_after,
    apply_echo_gains,
    echo_amount,
    cap_applied
  )
  VALUES (
    v_user_id,
    v_companion.id,
    v_attribute,
    v_source_event,
    v_source_key,
    v_requested_amount,
    v_awarded_amount,
    v_attribute_before,
    v_attribute_after,
    v_apply_echo,
    v_echo_amount,
    v_cap_applied
  );

  RETURN QUERY
  SELECT
    v_awarded_amount,
    v_attribute_before,
    v_attribute_after,
    v_cap_applied,
    FALSE,
    v_echo_amount;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.award_companion_attribute(TEXT, TEXT, TEXT, INTEGER, BOOLEAN) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.award_companion_attribute(TEXT, TEXT, TEXT, INTEGER, BOOLEAN) TO authenticated;
