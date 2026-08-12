import { assert, assertMatch } from "https://deno.land/std@0.224.0/assert/mod.ts";

const migrationUrl = new URL(
  "../../migrations/20260810013000_create_cosmiq_living_narrative.sql",
  import.meta.url,
);
const sql = await Deno.readTextFile(migrationUrl);

Deno.test("living narrative tables use ownership RLS and constrained source types", () => {
  assertMatch(sql, /CREATE TABLE IF NOT EXISTS public\.companion_narrative_choices/);
  assertMatch(sql, /CREATE TABLE IF NOT EXISTS public\.companion_narrative_memories/);
  assertMatch(sql, /source_type IN \('story', 'postcard'\)/);
  assertMatch(sql, /ALTER TABLE public\.companion_narrative_choices ENABLE ROW LEVEL SECURITY/);
  assertMatch(sql, /ALTER TABLE public\.companion_narrative_memories ENABLE ROW LEVEL SECURITY/);
  assertMatch(sql, /auth\.uid\(\) = user_id/);
  assertMatch(sql, /postcard\.epic_id IS NOT DISTINCT FROM epic_id/);
  assertMatch(sql, /member\.epic_id = epic\.id AND member\.user_id = auth\.uid\(\)/);
});

Deno.test("choice recording is atomic, source-bound, and unavailable to anonymous callers", () => {
  assertMatch(sql, /CREATE OR REPLACE FUNCTION public\.record_companion_narrative_choice/);
  assertMatch(sql, /SECURITY INVOKER/);
  assertMatch(sql, /Story source not found/);
  assertMatch(sql, /Postcard source not found/);
  assertMatch(sql, /Epic not found/);
  assertMatch(sql, /postcard\.epic_id IS NOT DISTINCT FROM p_epic_id/);
  assertMatch(sql, /INSERT INTO public\.companion_narrative_memories/);
  assertMatch(sql, /ON CONFLICT \(user_id, companion_id, memory_key\)/);
  assertMatch(sql, /REVOKE ALL ON FUNCTION public\.record_companion_narrative_choice[\s\S]*FROM PUBLIC, anon/);
  assert(!/SECURITY DEFINER/.test(sql));
});
