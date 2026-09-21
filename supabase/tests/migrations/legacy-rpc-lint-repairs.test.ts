import { assert, assertEquals } from "jsr:@std/assert";

const migrationPath = new URL(
  "../../migrations/20260819123000_repair_legacy_rpc_lint.sql",
  import.meta.url,
);
const sql = await Deno.readTextFile(migrationPath);

Deno.test("legacy RPC repair follows the current XP schema and removes ambiguous updates", () => {
  assert(sql.includes("xp_earned"));
  assert(!sql.includes("xp_amount,\n    event_type"));
  assert(sql.includes("UPDATE public.profiles AS profile"));
  assert(sql.includes("COALESCE(profile.referral_count, 0) + 1"));
  assert(sql.includes("RETURNING profile.referral_count"));
});

Deno.test("legacy RPC repair enforces ownership and least-privilege grants", () => {
  assert(sql.includes("auth.uid() IS DISTINCT FROM p_user_id"));
  assert(sql.includes("REVOKE ALL ON FUNCTION public.complete_quest_with_xp"));
  assert(sql.includes("REVOKE ALL ON FUNCTION public.increment_referral_count"));
  assertEquals(
    (sql.match(/TO authenticated, service_role;/g) ?? []).length,
    2,
  );
});
