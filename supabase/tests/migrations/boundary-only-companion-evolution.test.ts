import { assert, assertStringIncludes } from "https://deno.land/std@0.224.0/assert/mod.ts";

Deno.test("boundary-only companion evolution migration rewires XP and repair helpers", async () => {
  const migration = await Deno.readTextFile(
    new URL("../../migrations/20260506120000_boundary_only_companion_evolution.sql", import.meta.url),
  );

  assertStringIncludes(
    migration,
    "CREATE OR REPLACE FUNCTION public.is_companion_visual_boundary_stage",
    "Expected a helper that identifies visual-boundary stages",
  );
  assertStringIncludes(
    migration,
    "CREATE OR REPLACE FUNCTION public.get_next_visual_evolution_stage",
    "Expected next evolution to target the next visual boundary",
  );
  assertStringIncludes(
    migration,
    "CREATE OR REPLACE FUNCTION public.resolve_companion_visual_stage_from_xp",
    "Expected repair logic to resolve XP to visual stages",
  );
  assertStringIncludes(
    migration,
    "CREATE OR REPLACE FUNCTION public.get_pending_visual_evolution_count",
    "Expected a helper that counts all pending visual-boundary claims",
  );
  assertStringIncludes(
    migration,
    "CREATE OR REPLACE FUNCTION public.normalize_companion_xp_visual_evolution_metadata",
    "Expected XP event metadata to be normalized for boundary-only evolution",
  );
  assertStringIncludes(
    migration,
    "AND public.is_companion_visual_boundary_stage(et.stage)",
    "Expected legacy backfill to create only visual-boundary evolution rows",
  );
  assertStringIncludes(
    migration,
    "public.get_pending_visual_evolution_count(",
    "Expected award_xp_v2 and XP metadata to report every pending visual evolution",
  );
  assert(
    !migration.includes("THEN 1\n      ELSE 0\n    END AS pending_evolution_count"),
    "Migration should not booleanize pending visual evolutions",
  );
  assert(
    !migration.includes("GREATEST(v_last_real_stage + 1, 1)..v_restore_stage LOOP"),
    "Migration should not retain contiguous intermediate-stage backfill",
  );
});
