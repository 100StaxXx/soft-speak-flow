import {
  assert,
  assertStringIncludes,
} from "https://deno.land/std@0.224.0/assert/mod.ts";

Deno.test("Cosmiq title card retry migration qualifies preserved image columns", async () => {
  const migration = await Deno.readTextFile(
    new URL(
      "../../migrations/20260506123000_reapply_cosmiq_title_card_retry_ambiguity_fix.sql",
      import.meta.url,
    ),
  );

  assertStringIncludes(
    migration,
    "ELSE companion_cosmiq_title_cards.image_url",
    "Expected preserved image_url to be table-qualified",
  );
  assertStringIncludes(
    migration,
    "ELSE companion_cosmiq_title_cards.image_urls",
    "Expected preserved image_urls to be table-qualified",
  );
  assertStringIncludes(
    migration,
    "NOTIFY pgrst, 'reload schema'",
    "Expected the migration to refresh PostgREST after replacing the RPC body",
  );
  assert(
    !migration.includes("ELSE image_url\n") &&
      !migration.includes("ELSE image_urls\n"),
    "Migration should not retain ambiguous unqualified retry columns",
  );
});
