function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

Deno.test("daily Guide threads are private, persistent, and user-owned", async () => {
  const source = await Deno.readTextFile(
    new URL("../../migrations/20260810090000_daily_guide_threads.sql", import.meta.url),
  );

  assert(
    source.includes("CONSTRAINT daily_guide_threads_user_date_key UNIQUE (user_id, thread_date)"),
    "Expected one durable Guide thread per user and local day",
  );
  assert(
    source.includes("ALTER TABLE public.daily_guide_threads ENABLE ROW LEVEL SECURITY") &&
      source.includes("(SELECT auth.uid()) = user_id"),
    "Expected authenticated users to access only their own daily threads",
  );
  assert(
    source.includes("focus_category IS NULL OR focus_category IN") &&
      source.includes("'Faith', 'Mind', 'Body', 'Relationships', 'Stewardship', 'Service', 'Rest'"),
    "Expected Guide focus answers to stay inside reviewed formation categories",
  );
});

Deno.test("Guide-aligned Faithful Steps preserve ownership and completed work", async () => {
  const source = await Deno.readTextFile(
    new URL("../../migrations/20260810090000_daily_guide_threads.sql", import.meta.url),
  );

  assert(
    source.includes("SECURITY DEFINER") &&
      source.includes("v_user_id uuid := auth.uid()") &&
      source.includes("assignment.user_id = v_user_id"),
    "Expected the alignment RPC to enforce assignment ownership",
  );
  assert(
    source.includes("IF v_assignment.completed_at IS NULL THEN") &&
      source.includes("AND task.completed = false"),
    "Expected alignment to leave completed assignments and tasks unchanged",
  );
  assert(
    !/UPDATE public\.daily_tasks[\s\S]*?updated_at\s*=/.test(source),
    "daily_tasks has no updated_at column and must not be written as if it does",
  );
});
