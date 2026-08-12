import {
  assertStringIncludes,
} from "https://deno.land/std@0.168.0/testing/asserts.ts";

const migrationUrl = new URL(
  "../../migrations/20260811210000_hatch_animation_first_last_frames.sql",
  import.meta.url,
);

Deno.test("hatch animation jobs preserve a dedicated egg first frame", async () => {
  const source = await Deno.readTextFile(migrationUrl);

  assertStringIncludes(
    source,
    "ADD COLUMN IF NOT EXISTS start_image_url TEXT",
  );
  assertStringIncludes(source, "job.stage = 1");
  assertStringIncludes(source, "companion.initial_image_url");
  assertStringIncludes(source, "<> BTRIM(job.source_image_url)");
  assertStringIncludes(source, "legacy_hatch_endpoints_unverified");
  assertStringIncludes(source, "UPDATE public.companion_evolutions");
  assertStringIncludes(source, "animation_video_url = NULL");
  assertStringIncludes(source, "UPDATE public.companion_animation_jobs");
  assertStringIncludes(source, "video_url = NULL");
});
