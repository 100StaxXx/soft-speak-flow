import { assertEquals } from "https://deno.land/std@0.168.0/testing/asserts.ts";

const migrationPath = new URL(
  "../../migrations/20260812100000_add_explicit_companion_product_mode.sql",
  import.meta.url,
);

Deno.test("companion product mode migration separates Graceward from Cosmiq selection rules", async () => {
  const sql = await Deno.readTextFile(migrationPath);

  assertEquals(sql.includes("ADD COLUMN IF NOT EXISTS product_mode TEXT"), true);
  assertEquals(sql.includes("WHERE onboarding_data ->> 'product_mode' = 'christian'"), true);
  assertEquals(sql.includes("CHECK (product_mode IN ('graceward', 'cosmiq'))"), true);
  assertEquals(sql.includes("NEW.product_mode <> 'cosmiq'"), true);
  assertEquals(sql.includes("('fox', 'phoenix', 'leviathan')"), true);
  assertEquals(sql.includes("('fire', 'ice', 'nature')"), true);
  assertEquals(sql.includes("hatch_infant_endpoint_unverified"), true);
  assertEquals(sql.includes("approvedForReveal"), true);
});
