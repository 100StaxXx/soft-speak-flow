-- Fix the update_epic_progress function to not reference non-existent "completed" column
-- The habit_completions table uses row existence as the completion marker, not a completed column

CREATE OR REPLACE FUNCTION public.update_epic_progress()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  epic_record RECORD;
  total_habits INTEGER;
  completed_today INTEGER;
  days_completed INTEGER;
  new_progress INTEGER;
BEGIN
  -- Process on INSERT only - inserting a row IS the completion action
  -- No completed column exists; row presence = habit completed for the day
  
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
    
    -- Count completed habits for this epic today
    SELECT COUNT(DISTINCT hc.habit_id) INTO completed_today
    FROM public.habit_completions hc
    INNER JOIN public.epic_habits eh ON eh.habit_id = hc.habit_id
    WHERE eh.epic_id = epic_record.id
      AND hc.date = CURRENT_DATE
      AND hc.user_id = epic_record.user_id;
    
    -- Upsert daily progress log
    INSERT INTO public.epic_progress_log (epic_id, user_id, date, habits_completed, habits_total)
    VALUES (epic_record.id, epic_record.user_id, CURRENT_DATE, completed_today, total_habits)
    ON CONFLICT (epic_id, date)
    DO UPDATE SET
      habits_completed = completed_today,
      habits_total = total_habits;
    
    -- Calculate overall epic progress
    SELECT COUNT(DISTINCT date) INTO days_completed
    FROM public.epic_progress_log
    WHERE epic_id = epic_record.id
      AND habits_completed > 0
      AND date >= epic_record.start_date
      AND date <= epic_record.end_date;
    
    new_progress := LEAST(100, (days_completed * 100) / epic_record.target_days);
    
    -- Update epic progress
    UPDATE public.epics
    SET 
      progress_percentage = new_progress,
      status = CASE 
        WHEN new_progress >= 100 THEN 'completed'
        ELSE 'active'
      END,
      completed_at = CASE 
        WHEN new_progress >= 100 AND completed_at IS NULL THEN now()
        ELSE completed_at
      END,
      updated_at = now()
    WHERE id = epic_record.id;
  END LOOP;
  
  RETURN NEW;
END;
$function$;

-- Drop and recreate trigger to fire only on INSERT (not UPDATE)
DROP TRIGGER IF EXISTS update_epic_progress_on_habit_completion ON public.habit_completions;

CREATE TRIGGER update_epic_progress_on_habit_completion
  AFTER INSERT ON public.habit_completions
  FOR EACH ROW
  EXECUTE FUNCTION update_epic_progress();