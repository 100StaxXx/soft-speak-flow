import { assert } from "https://deno.land/std@0.168.0/testing/asserts.ts";
Deno.test("wellbeing migration isolates ownership and serializes worker claims", async () => {
  const sql = await Deno.readTextFile(new URL("../../migrations/20260920010000_cosmiq_wellbeing_videos.sql", import.meta.url));
  assert(sql.includes("ENABLE ROW LEVEL SECURITY"));
  assert(sql.includes("REVOKE ALL ON public.cosmiq_wellbeing_videos FROM anon, authenticated"));
  assert(sql.includes("USING (user_id = auth.uid())"));
  assert(sql.includes("FOR UPDATE SKIP LOCKED"));
  assert(sql.includes("UNIQUE (companion_id, stage, category, source_key, prompt_version)"));
  assert(sql.includes("REVOKE ALL ON FUNCTION public.claim_cosmiq_wellbeing_video() FROM PUBLIC, anon, authenticated"));
  assert(sql.includes("invoke_edge_function_with_internal_secret('companion-wellbeing-video'"));
  assert(!sql.includes("ALTER TABLE public.companion_animation_jobs"));
  assert(!sql.includes("INSERT INTO public.cosmiq_wellbeing_videos"));
});
