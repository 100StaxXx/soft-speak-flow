BEGIN;

-- Restore the repeatable-XP balance that the client and economy tests expose.
-- Later progression migrations accidentally carried forward the older 220/20%
-- values when they wrapped the award function for manual evolution claims.
DO $migration$
DECLARE
  function_definition text;
BEGIN
  SELECT pg_get_functiondef(
    'public.award_xp_v2_unsafe_base(text,integer,jsonb,text)'::regprocedure
  )
  INTO function_definition;

  IF function_definition LIKE '%v_today_xp >= 220%'
    AND function_definition LIKE '%ROUND(v_effective_xp * 0.2)%'
  THEN
    function_definition := replace(function_definition, 'v_today_xp >= 220', 'v_today_xp >= 260');
    function_definition := replace(function_definition, 'v_today_xp + v_effective_xp > 220', 'v_today_xp + v_effective_xp > 260');
    function_definition := replace(function_definition, '220 - v_today_xp', '260 - v_today_xp');
    function_definition := replace(function_definition, 'ROUND(v_effective_xp * 0.2)', 'ROUND(v_effective_xp * 0.35)');
    function_definition := replace(function_definition, 'ROUND(v_post_cap_xp_portion * 0.2)', 'ROUND(v_post_cap_xp_portion * 0.35)');
    EXECUTE function_definition;
  ELSIF function_definition NOT LIKE '%v_today_xp >= 260%'
    OR function_definition NOT LIKE '%ROUND(v_effective_xp * 0.35)%'
  THEN
    RAISE EXCEPTION 'award_xp_v2_unsafe_base has an unknown repeatable-XP cap implementation';
  END IF;
END;
$migration$;

-- A Daily Chapter remembers the exact opening the recommendation found.
ALTER TABLE public.daily_mission_threads
  ADD COLUMN IF NOT EXISTS suggested_window_label text
  CHECK (
    suggested_window_label IS NULL
    OR char_length(suggested_window_label) BETWEEN 1 AND 120
  );

-- Reflections shape Wisdom without granting XP. Extend the existing
-- idempotent attribute writer rather than introducing another currency.
DO $migration$
DECLARE
  function_definition text;
BEGIN
  SELECT pg_get_functiondef(
    'public.award_companion_attribute(text,text,text,integer,boolean)'::regprocedure
  )
  INTO function_definition;

  IF function_definition NOT LIKE '%daily_chapter_reflection%'
  THEN
    function_definition := replace(
      function_definition,
      $$v_source_event NOT IN ('habit_complete_learning')$$,
      $$v_source_event NOT IN ('habit_complete_learning', 'daily_chapter_reflection')$$
    );

    IF function_definition NOT LIKE '%daily_chapter_reflection%'
    THEN
      RAISE EXCEPTION 'award_companion_attribute Wisdom allowlist could not be extended';
    END IF;

    EXECUTE function_definition;
  END IF;
END;
$migration$;

-- Completed Daily Chapters are narrative evidence. They may move once from
-- completed to reflected, but their plan and outcome cannot be rewritten or
-- deleted afterward.
CREATE OR REPLACE FUNCTION public.protect_completed_daily_mission_thread()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $function$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.status <> 'active' THEN
      RAISE EXCEPTION 'Completed Daily Chapters are permanent memories';
    END IF;
    RETURN OLD;
  END IF;

  IF OLD.status = 'reflected' THEN
    RAISE EXCEPTION 'Reflected Daily Chapters are immutable';
  END IF;

  IF OLD.status = 'completed' THEN
    IF NEW.status <> 'reflected'
      OR NEW.user_id IS DISTINCT FROM OLD.user_id
      OR NEW.mission_date IS DISTINCT FROM OLD.mission_date
      OR NEW.intention_key IS DISTINCT FROM OLD.intention_key
      OR NEW.intention_label IS DISTINCT FROM OLD.intention_label
      OR NEW.primary_task_id IS DISTINCT FROM OLD.primary_task_id
      OR NEW.primary_task_title IS DISTINCT FROM OLD.primary_task_title
      OR NEW.primary_task_duration_minutes IS DISTINCT FROM OLD.primary_task_duration_minutes
      OR NEW.optional_task_ids IS DISTINCT FROM OLD.optional_task_ids
      OR NEW.optional_task_titles IS DISTINCT FROM OLD.optional_task_titles
      OR NEW.companion_ack IS DISTINCT FROM OLD.companion_ack
      OR NEW.calendar_summary IS DISTINCT FROM OLD.calendar_summary
      OR NEW.calendar_evidence IS DISTINCT FROM OLD.calendar_evidence
      OR NEW.suggested_window_label IS DISTINCT FROM OLD.suggested_window_label
      OR NEW.completed_at IS DISTINCT FROM OLD.completed_at
    THEN
      RAISE EXCEPTION 'Completed Daily Chapters may only add their reflection';
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS protect_completed_daily_mission_thread
  ON public.daily_mission_threads;
CREATE TRIGGER protect_completed_daily_mission_thread
  BEFORE UPDATE OR DELETE ON public.daily_mission_threads
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_completed_daily_mission_thread();

DROP POLICY IF EXISTS "Users can delete own daily mission threads"
  ON public.daily_mission_threads;
CREATE POLICY "Users can delete own active daily mission threads"
  ON public.daily_mission_threads FOR DELETE
  USING (auth.uid() = user_id AND status = 'active');

-- Remove old punishment state. Time away can still be remembered for a warm
-- return, but it no longer makes a companion sick, dead, locked, or dormant.
UPDATE public.user_companion
SET
  is_alive = TRUE,
  dormant_since = NULL,
  dormancy_recovery_days = 0,
  current_mood = CASE
    WHEN COALESCE(inactive_days, 0) >= 2 THEN 'content'
    ELSE COALESCE(NULLIF(current_mood, ''), 'content')
  END,
  body = GREATEST(COALESCE(body, 100), 100),
  mind = GREATEST(COALESCE(mind, 100), 100),
  soul = GREATEST(COALESCE(soul, 100), 100),
  hunger = GREATEST(COALESCE(hunger, 100), 100),
  happiness = GREATEST(COALESCE(happiness, 100), 100),
  care_score = GREATEST(COALESCE(care_score, 100), 100),
  recovery_progress = 100,
  evolution_path_locked = FALSE,
  updated_at = now()
WHERE
  COALESCE(is_alive, TRUE) = FALSE
  OR dormant_since IS NOT NULL
  OR current_mood IN ('worried', 'sad', 'sick', 'dormant', 'dead')
  OR COALESCE(body, 100) < 100
  OR COALESCE(mind, 100) < 100
  OR COALESCE(soul, 100) < 100
  OR COALESCE(hunger, 100) < 100
  OR COALESCE(happiness, 100) < 100
  OR COALESCE(care_score, 100) < 100
  OR COALESCE(recovery_progress, 100) < 100;

DELETE FROM public.companion_pending_consequences
WHERE processed = FALSE
  AND consequence_type IN ('mood_shift', 'dialogue_change', 'dormancy_warning');

DELETE FROM public.cost_guardrail_config
WHERE scope_type = 'endpoint'
  AND scope_key IN (
    'generate-dormant-companion-image',
    'generate-neglected-companion-image',
    'generate-memorial-image'
  );

COMMIT;
