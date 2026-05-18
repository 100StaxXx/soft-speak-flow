-- Shared campaign path markers expose display-safe companion bubbles for all
-- campaign members while keeping each user's copied planner rows private.

DROP POLICY IF EXISTS "Members can view joined epics" ON public.epics;
DROP POLICY IF EXISTS "Users can view own epic habits" ON public.epic_habits;
DROP POLICY IF EXISTS "Users can insert own epic habits" ON public.epic_habits;
DROP POLICY IF EXISTS "Users can delete own epic habits" ON public.epic_habits;

CREATE POLICY "Members can view joined epics"
  ON public.epics FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.epic_members em
      WHERE em.epic_id = epics.id
        AND em.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can view own epic habits"
  ON public.epic_habits FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.habits h
      WHERE h.id = epic_habits.habit_id
        AND h.user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1
      FROM public.epics e
      WHERE e.id = epic_habits.epic_id
        AND e.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert own epic habits"
  ON public.epic_habits FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.habits h
      WHERE h.id = epic_habits.habit_id
        AND h.user_id = auth.uid()
    )
    AND (
      EXISTS (
        SELECT 1
        FROM public.epics e
        WHERE e.id = epic_habits.epic_id
          AND e.user_id = auth.uid()
      )
      OR EXISTS (
        SELECT 1
        FROM public.epic_members em
        WHERE em.epic_id = epic_habits.epic_id
          AND em.user_id = auth.uid()
      )
    )
  );

CREATE POLICY "Users can delete own epic habits"
  ON public.epic_habits FOR DELETE
  USING (
    EXISTS (
      SELECT 1
      FROM public.habits h
      WHERE h.id = epic_habits.habit_id
        AND h.user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1
      FROM public.epics e
      WHERE e.id = epic_habits.epic_id
        AND e.user_id = auth.uid()
    )
  );

CREATE OR REPLACE FUNCTION public.copy_shared_epic_planner_structure(
  p_epic_id uuid,
  p_source_user_id uuid,
  p_target_user_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_epic_id IS NULL
    OR p_source_user_id IS NULL
    OR p_target_user_id IS NULL
    OR p_source_user_id = p_target_user_id
  THEN
    RETURN;
  END IF;

  INSERT INTO public.journey_phases (
    epic_id,
    user_id,
    name,
    description,
    start_date,
    end_date,
    phase_order,
    is_active,
    created_at,
    updated_at
  )
  SELECT
    source_phase.epic_id,
    p_target_user_id,
    source_phase.name,
    source_phase.description,
    source_phase.start_date,
    source_phase.end_date,
    source_phase.phase_order,
    source_phase.is_active,
    now(),
    now()
  FROM public.journey_phases source_phase
  WHERE source_phase.epic_id = p_epic_id
    AND source_phase.user_id = p_source_user_id
    AND NOT EXISTS (
      SELECT 1
      FROM public.journey_phases existing_phase
      WHERE existing_phase.epic_id = p_epic_id
        AND existing_phase.user_id = p_target_user_id
        AND COALESCE(existing_phase.phase_order, -1) = COALESCE(source_phase.phase_order, -1)
        AND existing_phase.name = source_phase.name
    );

  INSERT INTO public.epic_milestones (
    epic_id,
    user_id,
    title,
    description,
    milestone_percent,
    target_date,
    phase_name,
    phase_order,
    is_postcard_milestone,
    chapter_number,
    completed_at,
    is_surfaced,
    surfaced_at,
    task_id,
    created_at,
    updated_at
  )
  SELECT
    source_milestone.epic_id,
    p_target_user_id,
    source_milestone.title,
    source_milestone.description,
    source_milestone.milestone_percent,
    source_milestone.target_date,
    source_milestone.phase_name,
    source_milestone.phase_order,
    source_milestone.is_postcard_milestone,
    source_milestone.chapter_number,
    NULL,
    false,
    NULL,
    NULL,
    now(),
    now()
  FROM public.epic_milestones source_milestone
  WHERE source_milestone.epic_id = p_epic_id
    AND source_milestone.user_id = p_source_user_id
    AND NOT EXISTS (
      SELECT 1
      FROM public.epic_milestones existing_milestone
      WHERE existing_milestone.epic_id = p_epic_id
        AND existing_milestone.user_id = p_target_user_id
        AND existing_milestone.title = source_milestone.title
        AND existing_milestone.milestone_percent = source_milestone.milestone_percent
        AND COALESCE(existing_milestone.phase_order, -1) = COALESCE(source_milestone.phase_order, -1)
    );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.copy_shared_epic_planner_structure(uuid, uuid, uuid) FROM PUBLIC, anon, authenticated;

DO $$
DECLARE
  member_record RECORD;
BEGIN
  FOR member_record IN
    SELECT
      e.id AS epic_id,
      e.user_id AS owner_user_id,
      em.user_id AS member_user_id
    FROM public.epics e
    JOIN public.epic_members em ON em.epic_id = e.id
    WHERE em.user_id <> e.user_id
  LOOP
    PERFORM public.copy_shared_epic_planner_structure(
      member_record.epic_id,
      member_record.owner_user_id,
      member_record.member_user_id
    );
  END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_epic_progress_on_milestone()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_epic_id uuid;
  v_user_id uuid;
  v_new_progress integer;
BEGIN
  v_epic_id := COALESCE(NEW.epic_id, OLD.epic_id);
  v_user_id := COALESCE(NEW.user_id, OLD.user_id);

  IF v_epic_id IS NULL OR v_user_id IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  SELECT COALESCE(MAX(milestone_percent) FILTER (WHERE completed_at IS NOT NULL), 0)::integer
  INTO v_new_progress
  FROM public.epic_milestones
  WHERE epic_id = v_epic_id
    AND user_id = v_user_id;

  v_new_progress := LEAST(100, GREATEST(0, COALESCE(v_new_progress, 0)));

  UPDATE public.epics
  SET
    progress_percentage = v_new_progress,
    updated_at = now()
  WHERE id = v_epic_id
    AND user_id = v_user_id;

  UPDATE public.epic_members
  SET
    total_contribution = v_new_progress,
    last_activity_at = now()
  WHERE epic_id = v_epic_id
    AND user_id = v_user_id;

  RETURN COALESCE(NEW, OLD);
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
    WHERE epic_members.epic_id = v_epic.id
      AND epic_members.user_id = v_user_id
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
      AND h.user_id = v_epic.user_id
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

  PERFORM public.copy_shared_epic_planner_structure(v_epic.id, v_epic.user_id, v_user_id);

  RETURN QUERY SELECT true, 'joined'::TEXT, 'Joined epic successfully'::TEXT, v_epic.id, v_epic.title, COALESCE(v_inserted_count, 0);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.join_epic_by_invite_code(TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.join_epic_by_invite_code(TEXT) TO authenticated;

CREATE OR REPLACE FUNCTION public.get_shared_epic_path_markers(p_epic_id uuid)
RETURNS TABLE(
  user_id uuid,
  display_name text,
  progress_percentage numeric,
  is_current_user boolean,
  is_owner boolean,
  companion_image_url text,
  companion_image_focal_x numeric,
  companion_image_focal_y numeric,
  companion_mood text,
  joined_at timestamptz,
  last_activity_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller uuid := auth.uid();
  v_epic public.epics%ROWTYPE;
BEGIN
  IF v_caller IS NULL OR p_epic_id IS NULL THEN
    RETURN;
  END IF;

  SELECT *
  INTO v_epic
  FROM public.epics
  WHERE epics.id = p_epic_id
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  IF v_epic.user_id <> v_caller
    AND NOT EXISTS (
      SELECT 1
      FROM public.epic_members em
      WHERE em.epic_id = p_epic_id
        AND em.user_id = v_caller
    )
  THEN
    RETURN;
  END IF;

  RETURN QUERY
  WITH raw_members AS (
    SELECT
      v_epic.user_id AS member_user_id,
      NULL::timestamptz AS member_joined_at,
      v_epic.updated_at::timestamptz AS member_last_activity_at,
      true AS member_is_owner
    UNION ALL
    SELECT
      em.user_id AS member_user_id,
      em.joined_at AS member_joined_at,
      em.last_activity_at AS member_last_activity_at,
      false AS member_is_owner
    FROM public.epic_members em
    WHERE em.epic_id = p_epic_id
  ),
  members AS (
    SELECT DISTINCT ON (raw_members.member_user_id)
      raw_members.member_user_id,
      raw_members.member_joined_at,
      raw_members.member_last_activity_at,
      raw_members.member_is_owner
    FROM raw_members
    ORDER BY raw_members.member_user_id, raw_members.member_is_owner DESC
  ),
  member_progress AS (
    SELECT
      members.member_user_id,
      members.member_joined_at,
      members.member_last_activity_at,
      members.member_is_owner,
      COALESCE(
        (
          SELECT MAX(milestone.milestone_percent)::numeric
          FROM public.epic_milestones milestone
          WHERE milestone.epic_id = p_epic_id
            AND milestone.user_id = members.member_user_id
            AND milestone.completed_at IS NOT NULL
        ),
        (
          SELECT
            CASE
              WHEN COUNT(DISTINCT progress_log.date) > 0 AND COALESCE(v_epic.target_days, 0) > 0
                THEN LEAST(100, ROUND((COUNT(DISTINCT progress_log.date)::numeric * 100) / v_epic.target_days))
              ELSE NULL
            END
          FROM public.epic_progress_log progress_log
          WHERE progress_log.epic_id = p_epic_id
            AND progress_log.user_id = members.member_user_id
            AND COALESCE(progress_log.habits_completed, 0) > 0
        ),
        CASE
          WHEN members.member_is_owner THEN COALESCE(v_epic.progress_percentage, 0)::numeric
          ELSE (
            SELECT COALESCE(member_row.total_contribution, 0)::numeric
            FROM public.epic_members member_row
            WHERE member_row.epic_id = p_epic_id
              AND member_row.user_id = members.member_user_id
            LIMIT 1
          )
        END,
        0
      ) AS raw_progress
    FROM members
  ),
  companion_display AS (
    SELECT
      member_progress.member_user_id,
      member_progress.member_joined_at,
      member_progress.member_last_activity_at,
      member_progress.member_is_owner,
      LEAST(100, GREATEST(0, member_progress.raw_progress)) AS clamped_progress,
      COALESCE(
        NULLIF(BTRIM(profile.onboarding_data->>'userName'), ''),
        NULLIF(BTRIM(profile.onboarding_data->>'name'), ''),
        'Adventurer'
      ) AS safe_display_name,
      COALESCE(
        companion.current_image_url,
        companion.initial_image_url,
        companion.dormant_image_url,
        companion.neglected_image_url
      ) AS safe_companion_image_url,
      CASE
        WHEN companion.current_image_url IS NOT NULL THEN companion.current_image_focal_x
        WHEN companion.initial_image_url IS NOT NULL THEN companion.initial_image_focal_x
        WHEN companion.dormant_image_url IS NOT NULL THEN companion.dormant_image_focal_x
        WHEN companion.neglected_image_url IS NOT NULL THEN companion.neglected_image_focal_x
        ELSE NULL
      END AS safe_companion_image_focal_x,
      CASE
        WHEN companion.current_image_url IS NOT NULL THEN companion.current_image_focal_y
        WHEN companion.initial_image_url IS NOT NULL THEN companion.initial_image_focal_y
        WHEN companion.dormant_image_url IS NOT NULL THEN companion.dormant_image_focal_y
        WHEN companion.neglected_image_url IS NOT NULL THEN companion.neglected_image_focal_y
        ELSE NULL
      END AS safe_companion_image_focal_y,
      companion.current_mood AS safe_companion_mood
    FROM member_progress
    LEFT JOIN public.profiles profile ON profile.id = member_progress.member_user_id
    LEFT JOIN public.user_companion companion ON companion.user_id = member_progress.member_user_id
  )
  SELECT
    companion_display.member_user_id AS user_id,
    companion_display.safe_display_name AS display_name,
    companion_display.clamped_progress AS progress_percentage,
    companion_display.member_user_id = v_caller AS is_current_user,
    companion_display.member_is_owner AS is_owner,
    companion_display.safe_companion_image_url AS companion_image_url,
    companion_display.safe_companion_image_focal_x AS companion_image_focal_x,
    companion_display.safe_companion_image_focal_y AS companion_image_focal_y,
    companion_display.safe_companion_mood AS companion_mood,
    companion_display.member_joined_at AS joined_at,
    companion_display.member_last_activity_at AS last_activity_at
  FROM companion_display
  ORDER BY companion_display.member_is_owner DESC,
    companion_display.member_joined_at ASC NULLS FIRST,
    companion_display.member_user_id ASC;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_shared_epic_path_markers(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_shared_epic_path_markers(uuid) TO authenticated;

NOTIFY pgrst, 'reload schema';
