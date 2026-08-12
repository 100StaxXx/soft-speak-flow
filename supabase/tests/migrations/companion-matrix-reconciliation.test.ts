import { assertEquals } from "https://deno.land/std@0.168.0/testing/asserts.ts";

const migrationPath = new URL(
  "../../migrations/20260812090000_reconcile_companion_matrix_and_animation_endpoints.sql",
  import.meta.url,
);

Deno.test("companion matrix migration keeps only verified asset rows and locks selection", async () => {
  const sql = await Deno.readTextFile(migrationPath);

  assertEquals(
    sql.includes("DELETE FROM public.companion_preset_assets\nWHERE preset_id IN"),
    true,
  );
  assertEquals(sql.includes("'buttercat', 'raven'"), false);
  assertEquals(sql.includes("Keep its\n-- existing registry rows untouched"), true);
  assertEquals(sql.includes("('fox'), ('phoenix'), ('leviathan')"), true);
  assertEquals(sql.includes("('fire'), ('ice'), ('nature')"), true);
  assertEquals(
    sql.includes("enforce_supported_cosmiq_companion_selection"),
    true,
  );
  assertEquals(sql.includes("legacy_evolution_endpoints_unverified"), true);
  assertEquals(sql.includes("start_image_url = COALESCE"), true);
});
