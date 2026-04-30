function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(message);
  }
}

Deno.test("habit task conflict index migration replaces the partial index with a full arbiter", async () => {
  const source = await Deno.readTextFile(
    new URL("../migrations/20260430120000_replace_partial_habit_task_conflict_index.sql", import.meta.url),
  );

  assert(
    source.includes("DELETE FROM public.daily_tasks"),
    "Expected migration to delete duplicate daily task rows before recreating the index",
  );
  assert(
    source.includes("PARTITION BY user_id, task_date, habit_source_id"),
    "Expected duplicate cleanup to partition by (user_id, task_date, habit_source_id)",
  );
  assert(
    source.includes("ORDER BY created_at ASC NULLS LAST, id ASC"),
    "Expected duplicate cleanup to keep the earliest row",
  );
  assert(
    source.includes("WHERE habit_source_id IS NOT NULL"),
    "Expected duplicate cleanup to be scoped to habit-linked rows",
  );
  assert(
    source.includes("DROP INDEX IF EXISTS public.idx_daily_tasks_habit_date_unique"),
    "Expected migration to drop the legacy partial index",
  );
  assert(
    source.includes("CREATE UNIQUE INDEX IF NOT EXISTS idx_daily_tasks_habit_date_unique") &&
      source.includes("ON public.daily_tasks (user_id, task_date, habit_source_id)"),
    "Expected migration to create a non-partial unique index",
  );
  assert(
    !/CREATE UNIQUE INDEX[\s\S]*idx_daily_tasks_habit_date_unique[\s\S]*WHERE\s+habit_source_id\s+IS\s+NOT\s+NULL/i.test(source),
    "Expected the new index to be non-partial (no WHERE habit_source_id IS NOT NULL clause)",
  );
});
