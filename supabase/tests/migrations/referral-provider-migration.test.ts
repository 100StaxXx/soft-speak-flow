import {
  assert,
  assertEquals,
  assertStringIncludes,
} from "https://deno.land/std@0.224.0/assert/mod.ts";

const migrationUrl = new URL(
  "../../migrations/20260529195000_remove_winwinkit_referral_dependency.sql",
  import.meta.url,
);
const sql = await Deno.readTextFile(migrationUrl);

Deno.test("referral provider migration removes rejecting constraints before conversion", () => {
  const normalized = sql.toLowerCase();
  const dropReferralConstraint = normalized.indexOf(
    "drop constraint if exists referral_codes_affiliate_provider_check",
  );
  const updateReferralRows = normalized.indexOf("update public.referral_codes");
  const addReferralConstraint = normalized.indexOf(
    "add constraint referral_codes_affiliate_provider_check",
  );

  assert(dropReferralConstraint >= 0);
  assert(updateReferralRows > dropReferralConstraint);
  assert(addReferralConstraint > updateReferralRows);
  assertStringIncludes(
    normalized,
    "affiliate_provider in ('tolt', 'supabase')",
  );
  assertStringIncludes(normalized, "provider in ('tolt', 'supabase')");
  assertEquals(normalized.includes("provider in ('tolt', 'winwinkit')"), false);
});
