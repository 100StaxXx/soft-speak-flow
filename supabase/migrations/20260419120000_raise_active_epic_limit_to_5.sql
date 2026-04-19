-- Raise the active epic limit from 3 to 5 across create and join flows.

CREATE OR REPLACE FUNCTION public.check_epic_limit_on_create()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF count_user_epics(NEW.user_id) >= 5 THEN
    RAISE EXCEPTION 'User can only have 5 active epics at a time';
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

  IF count_user_epics(NEW.user_id) >= 5 THEN
    RAISE EXCEPTION 'User can only have 5 active epics at a time';
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.join_epic_by_invite_code(p_invite_code TEXT)
RETURNS TABLE(
  success BOOLEAN,
  code TEXT,
  message TEXT,
  epic_id UUID,
  epic_title TEXT,
  copied_habit_count INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_code TEXT := UPPER(TRIM(COALESCE(p_invite_code, '')));
  v_epic public.epics%ROWTYPE;
  v_existing_member BOOLEAN;
  v_inserted_count INTEGER := 0;
  v_request_id UUID := gen_random_uuid();
  v_request_ip TEXT := public.get_request_ip_address();
  v_abuse RECORD;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN QUERY SELECT false, 'unauthorized'::TEXT, 'Not authenticated'::TEXT, NULL::UUID, NULL::TEXT, 0;
    RETURN;
  END IF;

  SELECT *
  INTO v_abuse
  FROM public.consume_abuse_protection(
    p_profile_key => 'invite',
    p_endpoint_name => 'join_epic_by_invite_code',
    p_user_id => v_user_id,
    p_ip_address => v_request_ip,
    p_request_id => v_request_id,
    p_metadata => jsonb_build_object('flow', 'join_epic_by_invite_code')
  );

  IF NOT COALESCE(v_abuse.allowed, true) THEN
    RETURN QUERY SELECT false, 'rate_limited'::TEXT, 'Too many invite attempts. Please try again later.'::TEXT, NULL::UUID, NULL::TEXT, 0;
    RETURN;
  END IF;

  IF v_code = '' THEN
    RETURN QUERY SELECT false, 'invalid'::TEXT, 'Invite code is required'::TEXT, NULL::UUID, NULL::TEXT, 0;
    RETURN;
  END IF;

  IF v_code NOT LIKE 'EPIC-%' THEN
    v_code := 'EPIC-' || regexp_replace(v_code, '^EPIC-', '', 'i');
  END IF;

  SELECT *
  INTO v_epic
  FROM public.epics
  WHERE invite_code = v_code
    AND is_public = true
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN QUERY SELECT false, 'invalid'::TEXT, 'Epic not found'::TEXT, NULL::UUID, NULL::TEXT, 0;
    RETURN;
  END IF;

  IF v_epic.user_id = v_user_id THEN
    RETURN QUERY SELECT false, 'already_member'::TEXT, 'You already own this epic'::TEXT, v_epic.id, v_epic.title, 0;
    RETURN;
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM public.epic_members
    WHERE epic_id = v_epic.id
      AND user_id = v_user_id
  )
  INTO v_existing_member;

  IF v_existing_member THEN
    RETURN QUERY SELECT false, 'already_member'::TEXT, 'You are already in this guild'::TEXT, v_epic.id, v_epic.title, 0;
    RETURN;
  END IF;

  IF public.count_user_epics(v_user_id) >= 5 THEN
    RETURN QUERY SELECT false, 'epic_limit_reached'::TEXT, 'You can only have 5 active epics at a time'::TEXT, v_epic.id, v_epic.title, 0;
    RETURN;
  END IF;

  INSERT INTO public.epic_members (epic_id, user_id)
  VALUES (v_epic.id, v_user_id);

  WITH source_habits AS (
    SELECT h.*
    FROM public.epic_habits eh
    JOIN public.habits h ON h.id = eh.habit_id
    WHERE eh.epic_id = v_epic.id
  ),
  inserted_habits AS (
    INSERT INTO public.habits (
      user_id,
      title,
      difficulty,
      frequency,
      custom_days,
      custom_month_days,
      category,
      description,
      estimated_minutes,
      preferred_time,
      reminder_enabled,
      reminder_minutes_before,
      reminder_sent_today,
      is_active,
      sort_order,
      current_streak,
      longest_streak
    )
    SELECT
      v_user_id,
      sh.title,
      sh.difficulty,
      sh.frequency,
      sh.custom_days,
      sh.custom_month_days,
      sh.category,
      sh.description,
      sh.estimated_minutes,
      sh.preferred_time,
      sh.reminder_enabled,
      sh.reminder_minutes_before,
      false,
      COALESCE(sh.is_active, true),
      sh.sort_order,
      0,
      0
    FROM source_habits sh
    RETURNING id
  ),
  inserted_links AS (
    INSERT INTO public.epic_habits (epic_id, habit_id)
    SELECT v_epic.id, ih.id
    FROM inserted_habits ih
    RETURNING habit_id
  )
  SELECT count(*) INTO v_inserted_count FROM inserted_links;

  RETURN QUERY SELECT true, 'joined'::TEXT, 'Joined epic successfully'::TEXT, v_epic.id, v_epic.title, COALESCE(v_inserted_count, 0);
END;
$$;

NOTIFY pgrst, 'reload schema';
