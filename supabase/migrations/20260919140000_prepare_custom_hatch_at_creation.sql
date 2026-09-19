-- Apply after the deployed cinema-engine migrations. Preserve its lease,
-- idempotency and spending safeguards while admitting the first boundary.
BEGIN;
DO $migration$
DECLARE
  definition text;
BEGIN
  SELECT pg_get_functiondef('public.enqueue_cosmiq_cinema_event_internal(uuid,uuid)'::regprocedure)
  INTO definition;
  IF position('ARRAY[1, 5, 13, 21, 36, 56, 81]' in definition) = 0 THEN
    IF position('ARRAY[5, 13, 21, 36, 56, 81]' in definition) = 0
      OR position('Companion must hatch before cinematic prebuilds begin' in definition) = 0 THEN
      RAISE EXCEPTION 'Unexpected cinema queue definition; review before applying hatch repair';
    END IF;
    definition := replace(definition,
      E'  IF COALESCE(v_companion.current_stage, 0) < 1 THEN\n    RAISE EXCEPTION ''Companion must hatch before cinematic prebuilds begin'';\n  END IF;',
      E'  IF COALESCE(v_companion.current_stage, 0) < 0 THEN\n    RAISE EXCEPTION ''Invalid companion stage'';\n  END IF;');
    IF position('Companion must hatch before cinematic prebuilds begin' in definition) > 0 THEN
      RAISE EXCEPTION 'Unable to remove obsolete hatch precondition';
    END IF;
    definition := replace(definition, 'ARRAY[5, 13, 21, 36, 56, 81]', 'ARRAY[1, 5, 13, 21, 36, 56, 81]');
    definition := replace(definition, 'WHEN v_next_boundary = 5 THEN 200', 'WHEN v_next_boundary IN (1, 5) THEN 200');
    EXECUTE definition;
  END IF;
END;
$migration$;

-- Match the shipped Cosmiq selection catalog. Graceward is untouched.
CREATE OR REPLACE FUNCTION public.enforce_supported_cosmiq_companion_selection()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $function$
BEGIN
  IF NEW.product_mode IS DISTINCT FROM 'cosmiq' THEN RETURN NEW; END IF;
  IF TG_OP = 'UPDATE' THEN
    IF NEW.product_mode IS NOT DISTINCT FROM OLD.product_mode
      AND NEW.preset_id IS NOT DISTINCT FROM OLD.preset_id
      AND NEW.core_element IS NOT DISTINCT FROM OLD.core_element THEN
      RETURN NEW;
    END IF;
  END IF;
  IF NEW.core_element IS NULL OR public.normalize_companion_element_slug(NEW.core_element) NOT IN ('fire','ice','storm','nature','void','light') THEN
    RAISE EXCEPTION 'Unsupported Cosmiq element';
  END IF;
  IF NEW.preset_id IS NOT NULL AND public.normalize_companion_preset_slug(NEW.preset_id) NOT IN
    ('dragon','wolf','fox','owl','lion','phoenix','pegasus','griffin','sphinx','leviathan','mechanicaldragon','tanuki','raven','buttercat') THEN
    RAISE EXCEPTION 'Unsupported Cosmiq companion';
  END IF;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.prepare_cosmiq_first_hatch()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $function$
BEGIN
  IF NEW.product_mode = 'cosmiq' AND NEW.current_stage = 0
    AND lower(coalesce(NEW.spirit_animal, 'egg')) <> 'egg' THEN
    -- Only enqueue once. Repeated creation/prewarm requests must not restart
    -- failed paid work; explicit retries remain a separate user action.
    IF NOT EXISTS (SELECT 1 FROM public.companion_cinema_events
      WHERE companion_id = NEW.id AND event_type = 'evolution' AND event_key = 'level_1'
      AND lineage_revision = greatest(coalesce(NEW.cinema_lineage_revision, 1), 1)) THEN
      PERFORM public.enqueue_cosmiq_cinema_event_internal(NEW.user_id, NEW.id);
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;
REVOKE ALL ON FUNCTION public.prepare_cosmiq_first_hatch() FROM PUBLIC;
DROP TRIGGER IF EXISTS companion_prepare_first_hatch ON public.user_companion;
CREATE TRIGGER companion_prepare_first_hatch
AFTER INSERT OR UPDATE OF product_mode, preset_id ON public.user_companion
FOR EACH ROW EXECUTE FUNCTION public.prepare_cosmiq_first_hatch();

-- Backwards compatibility for installed clients: their preset-hatch RPC now
-- requests the custom reveal instead of prematurely promoting a stock image.
DO $migration$
DECLARE
  definition text;
  marker text := E'  SELECT public.companion_evolutions.id\n  INTO v_evolution_id';
  custom_path text := $path$
  IF v_companion.product_mode = 'cosmiq' THEN
    IF v_stage_one_threshold IS NULL OR v_companion.current_xp < v_stage_one_threshold THEN
      RAISE EXCEPTION 'Earn enough XP before hatching your companion';
    END IF;
    -- The locked selection is authoritative. Only legacy unassigned eggs may
    -- choose a form here, before their first preparation job is enqueued.
    IF v_locked_preset_id IS NULL THEN
      UPDATE public.user_companion SET preset_id = v_resolved_preset_id,
        spirit_animal = p_spirit_animal, favorite_color = p_favorite_color,
        core_element = p_core_element, story_tone = p_story_tone
      WHERE public.user_companion.id = p_companion_id;
    END IF;
    PERFORM public.enqueue_cosmiq_cinema_event_internal(v_user_id, p_companion_id);
    PERFORM public.request_companion_evolution_job();
    RETURN QUERY SELECT c.id, c.preset_id, c.spirit_animal, c.favorite_color,
      c.core_element, c.story_tone, c.current_stage, c.current_image_url,
      c.current_image_focal_x, c.current_image_focal_y, c.initial_image_url,
      c.initial_image_focal_x, c.initial_image_focal_y, NULL::uuid
    FROM public.user_companion c WHERE c.id = p_companion_id AND c.user_id = v_user_id;
    RETURN;
  END IF;

$path$;
BEGIN
  SELECT pg_get_functiondef(oid) INTO STRICT definition FROM pg_proc
    WHERE pronamespace = 'public'::regnamespace AND proname = 'hatch_companion_with_preset';
  IF position('PERFORM public.request_companion_evolution_job();' in definition) = 0 THEN
    IF position(marker in definition) = 0 THEN
      RAISE EXCEPTION 'Unexpected preset hatch definition; review before applying';
    END IF;
    EXECUTE replace(definition, marker, custom_path || marker);
  END IF;
END;
$migration$;
COMMIT;
