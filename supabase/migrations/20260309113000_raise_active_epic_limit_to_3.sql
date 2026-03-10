-- Raise active epic limit from 2 to 3 for create and join flows.

CREATE OR REPLACE FUNCTION public.check_epic_limit_on_create()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF count_user_epics(NEW.user_id) >= 3 THEN
    RAISE EXCEPTION 'User can only have 3 active epics at a time';
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.check_epic_limit_on_join()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  epic_owner_id uuid;
BEGIN
  -- Get the epic owner.
  SELECT user_id INTO epic_owner_id FROM epics WHERE id = NEW.epic_id;

  -- Skip if user is the epic owner (already counted on create).
  IF epic_owner_id = NEW.user_id THEN
    RETURN NEW;
  END IF;

  IF count_user_epics(NEW.user_id) >= 3 THEN
    RAISE EXCEPTION 'User can only have 3 active epics at a time';
  END IF;
  RETURN NEW;
END;
$$;
