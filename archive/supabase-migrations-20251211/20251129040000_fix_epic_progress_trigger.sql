-- FIX: Epic progress trigger had wrong field check
-- habit_completions table doesn't have a 'completed' field, only 'date' and timestamps
-- The trigger should fire on INSERT only, not UPDATE, since completions are insert-only

DROP TRIGGER IF EXISTS update_epic_progress_on_habit_completion ON public.habit_completions;

CREATE OR REPLACE FUNCTION public.update_epic_progress()
RETURNS TRIGGER AS $$
DECLARE
  epic_record RECORD;
  total_habits INTEGER;
  completed_today INTEGER;
  days_completed INTEGER;
  new_progress INTEGER;
BEGIN
  -- Trigger fires on INSERT to habit_completions
  -- Find all epics this habit belongs to
  FOR epic_record IN 
    SELECT e.id, e.user_id, e.target_days, e.start_date, e.end_date
    FROM public.epics e
    INNER JOIN public.epic_habits eh ON eh.epic_id = e.id
    WHERE eh.habit_id = NEW.habit_id
      AND e.status = 'active'
      AND e.user_id = NEW.user_id
  LOOP
    -- Count total habits linked to this epic
    SELECT COUNT(*) INTO total_habits
    FROM public.epic_habits
    WHERE epic_id = epic_record.id;
    
    -- Skip if epic has no habits
    IF total_habits = 0 THEN
      CONTINUE;
    END IF;
    
    -- Count completed habits for this epic today
    SELECT COUNT(DISTINCT hc.habit_id) INTO completed_today
    FROM public.habit_completions hc
    INNER JOIN public.epic_habits eh ON eh.habit_id = hc.habit_id
    WHERE eh.epic_id = epic_record.id
      AND hc.date = NEW.date
      AND hc.user_id = epic_record.user_id;
    
    -- Upsert daily progress log
    INSERT INTO public.epic_progress_log (epic_id, user_id, date, habits_completed, habits_total)
    VALUES (epic_record.id, epic_record.user_id, NEW.date, completed_today, total_habits)
    ON CONFLICT (epic_id, date)
    DO UPDATE SET
      habits_completed = completed_today,
      habits_total = total_habits;
    
    -- Calculate overall epic progress (days with at least 1 habit completed / target days)
    SELECT COUNT(DISTINCT date) INTO days_completed
    FROM public.epic_progress_log
    WHERE epic_id = epic_record.id
      AND habits_completed > 0
      AND date >= epic_record.start_date
      AND date <= epic_record.end_date;
    
    new_progress := LEAST(100, (days_completed * 100) / NULLIF(epic_record.target_days, 0));
    
    -- Update epic progress (don't auto-complete, let user claim completion manually)
    UPDATE public.epics
    SET 
      progress_percentage = new_progress,
      updated_at = now()
    WHERE id = epic_record.id;
  END LOOP;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public';

-- Re-create trigger - only on INSERT (habit completions are insert-only)
CREATE TRIGGER update_epic_progress_on_habit_completion
  AFTER INSERT ON public.habit_completions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_epic_progress();

COMMENT ON FUNCTION public.update_epic_progress IS 'Updates epic progress when habits are completed. Fixed: removed invalid completed field check.';
