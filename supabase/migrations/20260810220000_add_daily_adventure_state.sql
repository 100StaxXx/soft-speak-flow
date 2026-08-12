BEGIN;

ALTER TABLE public.daily_mission_threads
  ADD COLUMN IF NOT EXISTS adventure_state jsonb NOT NULL DEFAULT '{}'::jsonb
  CHECK (jsonb_typeof(adventure_state) = 'object');

COMMENT ON COLUMN public.daily_mission_threads.adventure_state IS
  'Versioned Daily Adventure story state: opening, branching decisions, and outcome.';

-- Completed chapters may add only their closing decision and reflection. The
-- rest of the recorded route remains permanent narrative evidence.
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
      OR (
        OLD.adventure_state <> '{}'::jsonb
        AND NEW.adventure_state - 'eveningChoice' - 'outcome'
          IS DISTINCT FROM OLD.adventure_state - 'eveningChoice' - 'outcome'
      )
    THEN
      RAISE EXCEPTION 'Completed Daily Chapters may only add their reflection';
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;

COMMIT;
