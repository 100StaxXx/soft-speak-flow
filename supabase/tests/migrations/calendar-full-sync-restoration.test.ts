function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

Deno.test("calendar restoration migration enables two-way sync and upgrades active cloud connections", async () => {
  const source = await Deno.readTextFile(
    new URL("../../migrations/20260813143000_restore_full_calendar_sync.sql", import.meta.url),
  );

  for (const table of [
    "user_calendar_connections",
    "quest_calendar_links",
    "quest_outlook_task_links",
  ]) {
    assert(
      source.includes(`ALTER TABLE public.${table}`),
      `Expected ${table} to receive a restored sync-mode constraint`,
    );
    assert(
      source.includes(`CHECK (sync_mode IN ('send_only', 'full_sync'))`),
      "Expected restored constraints to allow both supported sync modes",
    );
  }

  assert(
    source.includes("ALTER COLUMN sync_mode SET DEFAULT 'full_sync'"),
    "Expected new calendar records to default to two-way sync",
  );
  assert(
    source.includes("WHERE provider IN ('google', 'outlook')") &&
      source.includes("AND sync_enabled IS TRUE"),
    "Expected only active Google and Outlook connections to be upgraded",
  );
});
