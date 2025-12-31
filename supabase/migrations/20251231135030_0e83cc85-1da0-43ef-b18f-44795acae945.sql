-- Create function to update epic progress when milestones are completed
CREATE OR REPLACE FUNCTION public.update_epic_progress_on_milestone()
RETURNS TRIGGER AS $$
DECLARE
  total_milestones INTEGER;
  completed_milestones INTEGER;
  new_progress INTEGER;
BEGIN
  -- Count total and completed milestones for this epic
  SELECT 
    COUNT(*),
    COUNT(*) FILTER (WHERE completed_at IS NOT NULL)
  INTO total_milestones, completed_milestones
  FROM public.epic_milestones
  WHERE epic_id = COALESCE(NEW.epic_id, OLD.epic_id);

  -- Calculate new progress percentage
  IF total_milestones > 0 THEN
    new_progress := ROUND((completed_milestones::NUMERIC / total_milestones::NUMERIC) * 100);
  ELSE
    new_progress := 0;
  END IF;

  -- Update the epic's progress_percentage
  UPDATE public.epics
  SET 
    progress_percentage = new_progress,
    updated_at = now()
  WHERE id = COALESCE(NEW.epic_id, OLD.epic_id);

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create trigger for milestone completion updates
DROP TRIGGER IF EXISTS trigger_update_epic_progress ON public.epic_milestones;
CREATE TRIGGER trigger_update_epic_progress
AFTER INSERT OR UPDATE OF completed_at OR DELETE ON public.epic_milestones
FOR EACH ROW
EXECUTE FUNCTION public.update_epic_progress_on_milestone();