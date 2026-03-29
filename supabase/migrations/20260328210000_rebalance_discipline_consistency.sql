-- Rebalance discipline to represent consistency rather than generic activity.
-- Adds a server-side award path with idempotency and a daily repeatable cap,
-- then compresses existing inflated discipline scores.

CREATE TABLE IF NOT EXISTS public.companion_attribute_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  companion_id UUID REFERENCES public.user_companion(id) ON DELETE CASCADE NOT NULL,
  attribute TEXT NOT NULL CHECK (attribute IN ('vitality', 'wisdom', 'discipline', 'resolve', 'creativity', 'alignment')),
  source_event TEXT NOT NULL,
  source_key TEXT NOT NULL,
  amount_requested INTEGER NOT NULL,
  amount_awarded INTEGER NOT NULL,
  attribute_before INTEGER NOT NULL,
  attribute_after INTEGER NOT NULL,
  apply_echo_gains BOOLEAN NOT NULL DEFAULT TRUE,
  echo_amount INTEGER NOT NULL DEFAULT 0,
  cap_applied BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT companion_attribute_events_user_attribute_source_key_key UNIQUE (user_id, attribute, source_key)
);

CREATE INDEX IF NOT EXISTS idx_companion_attribute_events_user_created_at
  ON public.companion_attribute_events(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_companion_attribute_events_user_attribute_created_at
  ON public.companion_attribute_events(user_id, attribute, created_at DESC);

ALTER TABLE public.companion_attribute_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own companion attribute events" ON public.companion_attribute_events;
CREATE POLICY "Users can view own companion attribute events"
  ON public.companion_attribute_events
  FOR SELECT
  USING (auth.uid() = user_id);

REVOKE ALL ON public.companion_attribute_events FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.companion_attribute_events TO authenticated;

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
  v_resolve_before INTEGER := 300;
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

  IF v_attribute <> 'discipline' THEN
    RAISE EXCEPTION 'Unsupported attribute: %', v_attribute;
  END IF;

  IF v_source_event NOT IN ('habit_complete', 'planned_task_on_time', 'streak_milestone') THEN
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

  v_attribute_before := COALESCE(v_companion.discipline, 300);
  v_attribute_after := v_attribute_before;
  v_awarded_amount := v_requested_amount;
  v_is_repeatable := v_source_event IN ('habit_complete', 'planned_task_on_time');

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
      v_resolve_before := COALESCE(v_companion.resolve, 300);
    END IF;

    UPDATE public.user_companion
    SET
      discipline = v_attribute_after,
      resolve = CASE
        WHEN v_echo_amount > 0 THEN LEAST(1000, GREATEST(100, v_resolve_before + v_echo_amount))
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

UPDATE public.user_companion
SET discipline = CASE
  WHEN discipline > 300 THEN LEAST(
    1000,
    GREATEST(100, ROUND(300 + ((discipline - 300) * 0.45))::INTEGER)
  )
  ELSE discipline
END
WHERE discipline IS NOT NULL;
