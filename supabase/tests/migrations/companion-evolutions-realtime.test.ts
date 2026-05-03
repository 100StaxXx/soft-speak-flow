function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(message);
  }
}

Deno.test("companion evolutions realtime migration guards publication membership", async () => {
  const source = await Deno.readTextFile(
    new URL(
      "../../migrations/20260503123000_add_companion_evolutions_realtime.sql",
      import.meta.url,
    ),
  );

  assert(
    source.includes(
      "ALTER PUBLICATION supabase_realtime ADD TABLE public.companion_evolutions",
    ),
    "Expected companion_evolutions to be added to the Supabase realtime publication",
  );
  assert(
    source.includes("pg_publication_tables") &&
      source.includes("tablename = 'companion_evolutions'") &&
      source.includes("duplicate_object"),
    "Expected realtime publication migration to be duplicate-safe",
  );
});
