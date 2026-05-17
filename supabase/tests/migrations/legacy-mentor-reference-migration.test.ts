import { assert } from "https://deno.land/std@0.224.0/assert/mod.ts";

Deno.test("legacy mentor reference migration remaps active surfaces to canonical mentors", async () => {
  const source = await Deno.readTextFile(
    new URL("../../migrations/20260517162000_migrate_legacy_mentor_references.sql", import.meta.url),
  );

  for (
    const [oldSlug, newSlug] of [
      ["atlas", "sage"],
      ["carmen", "icon"],
      ["solace", "charles"],
      ["elizabeth", "charles"],
      ["sienna", "princess"],
      ["stryker", "operator"],
      ["eli", "rival"],
    ]
  ) {
    assert(
      source.includes(`('${oldSlug}', '${newSlug}')`),
      `Expected migration to map ${oldSlug} to ${newSlug}`,
    );
  }

  assert(
    source.includes("UPDATE public.profiles AS profile") &&
      source.includes("selected_mentor_id = mentor_ids.new_id") &&
      source.includes("profile.selected_mentor_id = mentor_ids.old_id"),
    "Expected profiles.selected_mentor_id to move from legacy IDs to canonical IDs",
  );

  assert(
    source.includes("profile.onboarding_data->>'mentorId' = mentor_ids.old_id::text") &&
      source.includes("jsonb_set("),
    "Expected onboarding mentorId references to be rewritten",
  );

  assert(
    source.includes("UPDATE public.daily_pep_talks AS daily") &&
      source.includes("daily.mentor_slug = legacy_mentor_map.old_slug") &&
      source.includes("canonical_daily.for_date = daily.for_date"),
    "Expected historical daily pep talks to be remapped with date-conflict protection",
  );

  assert(
    source.includes("UPDATE public.pep_talks AS pep") &&
      source.includes("mentor_slug = mentor_ids.new_slug") &&
      source.includes("mentor_id = mentor_ids.new_id"),
    "Expected library pep talks to be remapped to canonical mentor slug and ID",
  );
});
