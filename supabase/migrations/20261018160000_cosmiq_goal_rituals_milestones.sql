BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

ALTER TABLE public.habits ADD COLUMN IF NOT EXISTS ritual_settings jsonb NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE public.habits ADD CONSTRAINT habits_ritual_settings_object CHECK (jsonb_typeof(ritual_settings) = 'object');
ALTER TABLE public.epics ADD COLUMN IF NOT EXISTS milestone_progress_mode text NOT NULL DEFAULT 'legacy_checkpoint'
  CHECK (milestone_progress_mode IN ('legacy_checkpoint','weighted'));
ALTER TABLE public.epic_milestones
  ADD COLUMN IF NOT EXISTS done_when text,
  ADD COLUMN IF NOT EXISTS target_value numeric CHECK (target_value > 0 AND target_value <= 1000000000000),
  ADD COLUMN IF NOT EXISTS current_value numeric NOT NULL DEFAULT 0 CHECK (current_value >= 0 AND current_value <= 1000000000000),
  ADD COLUMN IF NOT EXISTS unit text,
  ADD COLUMN IF NOT EXISTS linked_habit_ids uuid[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS auto_complete boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS measure_kind text NOT NULL DEFAULT 'manual' CHECK (measure_kind IN ('manual','ritual_completions')),
  ADD COLUMN IF NOT EXISTS progress_weight numeric NOT NULL DEFAULT 1 CHECK (progress_weight > 0 AND progress_weight <= 100),
  ADD COLUMN IF NOT EXISTS sort_order integer;

CREATE FUNCTION public.default_cosmiq_milestone_progress() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF NEW.planning_mode IS DISTINCT FROM 'manual' AND EXISTS(SELECT 1 FROM public.user_companion WHERE user_id=NEW.user_id AND product_mode='cosmiq') THEN NEW.milestone_progress_mode := 'weighted'; END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.default_cosmiq_milestone_progress() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER default_cosmiq_milestone_progress BEFORE INSERT ON public.epics FOR EACH ROW EXECUTE FUNCTION public.default_cosmiq_milestone_progress();

-- Existing plans retain checkpoint progress until the owner explicitly previews and adopts weighted progress.
CREATE OR REPLACE FUNCTION public.update_epic_progress_on_milestone()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_epic_id uuid := COALESCE(NEW.epic_id, OLD.epic_id); v_user_id uuid := COALESCE(NEW.user_id, OLD.user_id); v_new_progress integer; v_mode text;
BEGIN
  IF v_epic_id IS NULL OR v_user_id IS NULL THEN RETURN COALESCE(NEW,OLD); END IF;
  SELECT milestone_progress_mode INTO v_mode FROM public.epics WHERE id=v_epic_id FOR UPDATE;
  IF v_mode='weighted' THEN
    SELECT COALESCE(round(100 * COALESCE(sum(progress_weight) FILTER (WHERE completed_at IS NOT NULL),0) / NULLIF(sum(progress_weight),0)),0)::integer
      INTO v_new_progress FROM public.epic_milestones WHERE epic_id=v_epic_id AND user_id=v_user_id;
    IF EXISTS(SELECT 1 FROM public.epic_milestones WHERE epic_id=v_epic_id AND user_id=v_user_id AND completed_at IS NULL) THEN v_new_progress:=LEAST(99,v_new_progress); END IF;
  ELSE
    SELECT COALESCE(MAX(milestone_percent) FILTER (WHERE completed_at IS NOT NULL),0)::integer
      INTO v_new_progress FROM public.epic_milestones WHERE epic_id=v_epic_id AND user_id=v_user_id;
  END IF;
  v_new_progress := LEAST(100,GREATEST(0,COALESCE(v_new_progress,0)));
  UPDATE public.epics SET progress_percentage=v_new_progress,updated_at=now() WHERE id=v_epic_id AND user_id=v_user_id AND planning_mode IS DISTINCT FROM 'manual';
  UPDATE public.epic_members SET total_contribution=v_new_progress,last_activity_at=now() WHERE epic_id=v_epic_id AND user_id=v_user_id;
  RETURN COALESCE(NEW,OLD);
END;
$$;
DROP TRIGGER IF EXISTS trigger_update_epic_progress ON public.epic_milestones;
CREATE TRIGGER trigger_update_epic_progress AFTER INSERT OR UPDATE OF completed_at,progress_weight OR DELETE ON public.epic_milestones
FOR EACH ROW EXECUTE FUNCTION public.update_epic_progress_on_milestone();

CREATE FUNCTION public.save_cosmiq_goal_milestone(p_epic_id uuid, p_milestone_id uuid, p_details jsonb, p_request_id uuid DEFAULT NULL)
RETURNS public.epic_milestones LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE v_row public.epic_milestones; v_percent integer; v_links uuid[]; v_target numeric; v_current numeric; v_auto boolean; v_kind text;
BEGIN
  IF auth.uid() IS NULL OR NOT EXISTS (SELECT 1 FROM public.user_companion WHERE user_id=auth.uid() AND product_mode='cosmiq') THEN RAISE EXCEPTION 'Cosmiq sign-in required'; END IF;
  PERFORM 1 FROM public.epics WHERE id=p_epic_id AND (user_id=auth.uid() OR EXISTS (SELECT 1 FROM public.epic_members WHERE epic_id=p_epic_id AND user_id=auth.uid()));
  IF NOT FOUND THEN RAISE EXCEPTION 'Goal not found'; END IF;
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_epic_id::text,0));
  IF trim(COALESCE(p_details->>'title',''))='' THEN RAISE EXCEPTION 'A milestone name is required'; END IF;
  SELECT COALESCE(array_agg(value::uuid),'{}') INTO v_links FROM jsonb_array_elements_text(COALESCE(p_details->'linked_habit_ids','[]'));
  IF EXISTS (SELECT 1 FROM unnest(v_links) h(id) WHERE NOT EXISTS (SELECT 1 FROM public.habits h2 JOIN public.epic_habits eh ON eh.habit_id=h2.id WHERE h2.id=h.id AND h2.user_id=auth.uid() AND eh.epic_id=p_epic_id)) THEN RAISE EXCEPTION 'Linked rituals must belong to this goal and account'; END IF;
  v_target := NULLIF(p_details->>'target_value','')::numeric;
  v_current := COALESCE((p_details->>'current_value')::numeric,0);
  v_auto := COALESCE((p_details->>'auto_complete')::boolean,false);
  v_kind := COALESCE(p_details->>'measure_kind','manual');
  IF v_auto AND v_target IS NULL THEN RAISE EXCEPTION 'Automatic completion requires a target'; END IF;
  IF v_kind='ritual_completions' THEN
    IF cardinality(v_links)=0 THEN RAISE EXCEPTION 'Choose a supporting ritual'; END IF;
    SELECT count(DISTINCT (hc.habit_id,hc.date)) INTO v_current FROM public.habit_completions hc JOIN public.epics e ON e.id=p_epic_id
      WHERE hc.user_id=auth.uid() AND hc.habit_id=ANY(v_links) AND hc.completed_at IS NOT NULL AND hc.date >= e.start_date::date;
  END IF;
  IF p_milestone_id IS NULL AND p_request_id IS NOT NULL THEN
    SELECT * INTO v_row FROM public.epic_milestones WHERE id=p_request_id AND epic_id=p_epic_id AND user_id=auth.uid();
    IF FOUND THEN p_milestone_id := v_row.id; END IF;
  END IF;
  IF p_milestone_id IS NULL THEN
    SELECT n INTO v_percent FROM generate_series(1,100) n WHERE NOT EXISTS(SELECT 1 FROM public.epic_milestones WHERE epic_id=p_epic_id AND user_id=auth.uid() AND milestone_percent=n) ORDER BY n LIMIT 1;
    IF v_percent IS NULL THEN RAISE EXCEPTION 'This goal already has 100 milestones'; END IF;
    INSERT INTO public.epic_milestones(id,epic_id,user_id,title,milestone_percent,sort_order,is_postcard_milestone)
      VALUES(COALESCE(p_request_id,gen_random_uuid()),p_epic_id,auth.uid(),trim(p_details->>'title'),v_percent,COALESCE((SELECT max(COALESCE(sort_order,phase_order,milestone_percent))+1 FROM public.epic_milestones WHERE epic_id=p_epic_id AND user_id=auth.uid()),0),false)
      RETURNING * INTO v_row;
  ELSE
    SELECT * INTO v_row FROM public.epic_milestones WHERE id=p_milestone_id AND epic_id=p_epic_id AND user_id=auth.uid() FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Milestone not found'; END IF;
  END IF;
  UPDATE public.epic_milestones SET title=trim(p_details->>'title'), description=NULLIF(trim(p_details->>'description'),''),
    target_date=NULLIF(p_details->>'target_date','')::date, done_when=NULLIF(trim(p_details->>'done_when'),''),
    target_value=v_target,current_value=v_current,unit=NULLIF(trim(p_details->>'unit'),''),linked_habit_ids=v_links,
    auto_complete=v_auto,measure_kind=v_kind,progress_weight=COALESCE((p_details->>'progress_weight')::numeric,1),
    completed_at=CASE WHEN v_row.completed_at IS NULL AND v_auto AND v_current>=v_target THEN now() ELSE v_row.completed_at END,updated_at=now()
    WHERE id=v_row.id AND user_id=auth.uid() RETURNING * INTO v_row;
  RETURN v_row;
END;
$$;
REVOKE ALL ON FUNCTION public.save_cosmiq_goal_milestone(uuid,uuid,jsonb,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.save_cosmiq_goal_milestone(uuid,uuid,jsonb,uuid) TO authenticated;

CREATE FUNCTION public.configure_cosmiq_goal_milestones(p_epic_id uuid,p_order uuid[] DEFAULT NULL,p_use_weighted boolean DEFAULT false)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_expected integer; v_actual integer; v_owner uuid;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.user_companion WHERE user_id=auth.uid() AND product_mode='cosmiq') THEN RAISE EXCEPTION 'Cosmiq sign-in required'; END IF;
  SELECT user_id INTO v_owner FROM public.epics WHERE id=p_epic_id FOR UPDATE;
  IF NOT FOUND OR (v_owner<>auth.uid() AND NOT EXISTS(SELECT 1 FROM public.epic_members WHERE epic_id=p_epic_id AND user_id=auth.uid())) THEN RAISE EXCEPTION 'Goal not found'; END IF;
  IF p_use_weighted AND v_owner<>auth.uid() THEN RAISE EXCEPTION 'Only the goal owner can change progress calculation'; END IF;
  IF p_order IS NOT NULL THEN
    SELECT count(*) INTO v_expected FROM public.epic_milestones WHERE epic_id=p_epic_id AND user_id=auth.uid();
    SELECT count(DISTINCT id) INTO v_actual FROM unnest(p_order) id WHERE id IN (SELECT id FROM public.epic_milestones WHERE epic_id=p_epic_id AND user_id=auth.uid());
    IF v_expected<>v_actual OR cardinality(p_order)<>v_actual THEN RAISE EXCEPTION 'Milestone order has changed. Reload and try again.'; END IF;
    UPDATE public.epic_milestones m SET sort_order=o.position-1 FROM unnest(p_order) WITH ORDINALITY o(id,position) WHERE m.id=o.id AND m.user_id=auth.uid();
  END IF;
  IF p_use_weighted THEN
    UPDATE public.epics SET milestone_progress_mode='weighted',updated_at=now() WHERE id=p_epic_id AND user_id=auth.uid();
    -- Recompute progress through the same trigger; rewards only fire on first completion.
    UPDATE public.epic_milestones SET progress_weight=progress_weight WHERE epic_id=p_epic_id;
  END IF;
END;
$$;
REVOKE ALL ON FUNCTION public.configure_cosmiq_goal_milestones(uuid,uuid[],boolean) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.configure_cosmiq_goal_milestones(uuid,uuid[],boolean) TO authenticated;

CREATE FUNCTION public.refresh_cosmiq_ritual_milestone_counts()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_user uuid:=COALESCE(NEW.user_id,OLD.user_id); v_habits uuid[]:=ARRAY[NEW.habit_id,OLD.habit_id]; m record; v_count integer;
BEGIN
  IF auth.uid() IS DISTINCT FROM v_user OR NOT EXISTS(SELECT 1 FROM public.user_companion WHERE user_id=v_user AND product_mode='cosmiq') THEN RETURN COALESCE(NEW,OLD); END IF;
  FOR m IN SELECT em.* FROM public.epic_milestones em WHERE em.user_id=v_user AND em.measure_kind='ritual_completions' AND em.linked_habit_ids && v_habits ORDER BY em.id FOR UPDATE LOOP
    SELECT count(DISTINCT(hc.habit_id,hc.date)) INTO v_count FROM public.habit_completions hc JOIN public.epics e ON e.id=m.epic_id
      WHERE hc.user_id=v_user AND hc.habit_id=ANY(m.linked_habit_ids) AND hc.completed_at IS NOT NULL AND hc.date>=e.start_date::date;
    UPDATE public.epic_milestones SET current_value=v_count,
      completed_at=CASE WHEN m.completed_at IS NULL AND m.auto_complete AND v_count>=m.target_value THEN now() ELSE m.completed_at END,
      updated_at=now() WHERE id=m.id AND user_id=v_user;
  END LOOP;
  RETURN COALESCE(NEW,OLD);
END;
$$;
REVOKE ALL ON FUNCTION public.refresh_cosmiq_ritual_milestone_counts() FROM PUBLIC,anon,authenticated,service_role;
CREATE TRIGGER refresh_cosmiq_ritual_milestone_counts AFTER INSERT OR UPDATE OR DELETE ON public.habit_completions
  FOR EACH ROW EXECUTE FUNCTION public.refresh_cosmiq_ritual_milestone_counts();

-- Copy outcome criteria and weights into new shared plans. Personal counts and automation start fresh.
CREATE OR REPLACE FUNCTION public.copy_shared_epic_planner_structure(p_epic_id uuid, p_source_user_id uuid, p_target_user_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
    updated_at, done_when, target_value, unit, progress_weight, sort_order
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
    now(), source_milestone.done_when, source_milestone.target_value, source_milestone.unit, source_milestone.progress_weight, source_milestone.sort_order
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
$function$;

REVOKE ALL ON FUNCTION public.copy_shared_epic_planner_structure(uuid,uuid,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.copy_shared_epic_planner_structure(uuid,uuid,uuid) TO service_role;
COMMIT;
