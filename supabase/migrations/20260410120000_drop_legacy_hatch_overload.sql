-- The original hatch_companion_with_preset migration created a 9-parameter overload.
-- A later migration (20260403124500) added a 13-parameter overload that supports
-- focal-point fields and allows preset-locked eggs to hatch. Because CREATE OR REPLACE
-- with a different signature creates a NEW overload rather than replacing the old one,
-- both overloads coexist. PostgREST can resolve to the old overload when focal params
-- are null, which causes it to hit the legacy guard:
--
--   IF v_companion.preset_id IS NOT NULL THEN
--     RAISE EXCEPTION 'Companion already has a preset';
--   END IF;
--
-- This makes hatching fail for every preset-locked egg. Drop the old overload so only
-- the current 13-parameter version remains.

DROP FUNCTION IF EXISTS public.hatch_companion_with_preset(
  uuid,   -- p_companion_id
  text,   -- p_preset_id
  text,   -- p_spirit_animal
  text,   -- p_favorite_color
  text,   -- p_core_element
  text,   -- p_story_tone
  text,   -- p_initial_image_url
  text,   -- p_current_image_url
  integer -- p_xp_at_evolution
);
