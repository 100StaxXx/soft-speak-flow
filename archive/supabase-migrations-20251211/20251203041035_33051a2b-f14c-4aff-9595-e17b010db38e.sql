-- Prevent duplicate epic memberships
ALTER TABLE public.epic_members 
ADD CONSTRAINT epic_members_user_epic_unique UNIQUE (epic_id, user_id);

-- Function to count user's total epics (owned + joined)
CREATE OR REPLACE FUNCTION public.count_user_epics(p_user_id uuid)
RETURNS integer
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT (
    -- Epics they own
    (SELECT COUNT(*)::integer FROM epics WHERE user_id = p_user_id AND status = 'active')
    +
    -- Epics they've joined (not owned)
    (SELECT COUNT(*)::integer FROM epic_members em 
     JOIN epics e ON e.id = em.epic_id 
     WHERE em.user_id = p_user_id AND e.user_id != p_user_id AND e.status = 'active')
  );
$$;

-- Trigger function to enforce 2-epic limit on epic creation
CREATE OR REPLACE FUNCTION public.check_epic_limit_on_create()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF count_user_epics(NEW.user_id) >= 2 THEN
    RAISE EXCEPTION 'User can only have 2 active epics at a time';
  END IF;
  RETURN NEW;
END;
$$;

-- Trigger function to enforce 2-epic limit on joining
CREATE OR REPLACE FUNCTION public.check_epic_limit_on_join()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  epic_owner_id uuid;
BEGIN
  -- Get the epic owner
  SELECT user_id INTO epic_owner_id FROM epics WHERE id = NEW.epic_id;
  
  -- Skip if user is the epic owner (they already counted when creating)
  IF epic_owner_id = NEW.user_id THEN
    RETURN NEW;
  END IF;
  
  IF count_user_epics(NEW.user_id) >= 2 THEN
    RAISE EXCEPTION 'User can only have 2 active epics at a time';
  END IF;
  RETURN NEW;
END;
$$;

-- Create triggers
CREATE TRIGGER enforce_epic_limit_on_create
  BEFORE INSERT ON public.epics
  FOR EACH ROW
  EXECUTE FUNCTION public.check_epic_limit_on_create();

CREATE TRIGGER enforce_epic_limit_on_join
  BEFORE INSERT ON public.epic_members
  FOR EACH ROW
  EXECUTE FUNCTION public.check_epic_limit_on_join();