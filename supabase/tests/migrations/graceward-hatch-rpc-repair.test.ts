import {
  assert,
  assertStringIncludes,
} from "https://deno.land/std@0.168.0/testing/asserts.ts";

const migrationUrl = new URL(
  "../../migrations/20260819101500_repair_graceward_hatch_rpc.sql",
  import.meta.url,
);

Deno.test("Graceward hatch RPC does not roll back on animation job schema drift", async () => {
  const source = await Deno.readTextFile(migrationUrl);

  assertStringIncludes(
    source,
    "CREATE OR REPLACE FUNCTION public.hatch_companion_with_preset",
  );
  assertStringIncludes(source, "current_stage = 1");
  assertStringIncludes(source, "'hatchPrewarmPromotedAt'");
  assert(
    !source.includes("INSERT INTO public.companion_animation_jobs"),
    "Hatching must not depend on the best-effort animation job pipeline",
  );
});
