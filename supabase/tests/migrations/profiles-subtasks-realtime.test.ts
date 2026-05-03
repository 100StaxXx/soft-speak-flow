function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(message);
  }
}

Deno.test("profiles and subtasks realtime migration guards publication membership", async () => {
  const source = await Deno.readTextFile(
    new URL(
      "../../migrations/20260503134500_add_profiles_subtasks_realtime.sql",
      import.meta.url,
    ),
  );

  for (const tableName of ["profiles", "subtasks"]) {
    assert(
      source.includes(
        `ALTER PUBLICATION supabase_realtime ADD TABLE public.${tableName}`,
      ),
      `Expected ${tableName} to be added to the Supabase realtime publication`,
    );
    assert(
      source.includes(`to_regclass('public.${tableName}')`) &&
        source.includes(`tablename = '${tableName}'`),
      `Expected ${tableName} publication membership to be guarded`,
    );
  }

  assert(
    source.includes("pg_publication_tables") &&
      source.includes("duplicate_object") &&
      source.includes("undefined_table"),
    "Expected realtime publication migration to be duplicate-safe",
  );
});
