import {
  assertEquals,
  assertStringIncludes,
} from "https://deno.land/std@0.224.0/assert/mod.ts";

const migrationUrl = new URL(
  "../../migrations/20260807000000_daily_way_christian_guidance_prompts.sql",
  import.meta.url,
);
const sql = await Deno.readTextFile(migrationUrl);

Deno.test("Christian guidance prompt migration uses the current Graceward brand", () => {
  assertStringIncludes(sql, "Graceward Reflection Assistant");
  assertStringIncludes(sql, "Graceward Small Practice Generator");
  assertStringIncludes(sql, "Graceward Morning Reflection");
  assertEquals(sql.includes("Daily Way"), false);
});
