function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(message);
  }
}

Deno.test("remaining-today badge count ignores cleared planner rows", async () => {
  const source = await Deno.readTextFile(
    new URL("../../migrations/20260511143000_remaining_today_badge_count.sql", import.meta.url),
  );

  assert(
    source.includes("CREATE OR REPLACE FUNCTION public.get_remaining_today_badge_count"),
    "Expected migration to define the remaining-today badge count RPC",
  );
  assert(
    source.includes("task.excluded_from_planner_at IS NULL"),
    "Expected direct daily task count to ignore cleared planner rows",
  );
  assert(
    source.includes("template.excluded_from_planner_at IS NULL"),
    "Expected recurring templates excluded from the planner to stay out of the badge count",
  );
  assert(
    source.includes("EXTRACT(hour FROM v_local_time)::integer < 2"),
    "Expected the RPC to use the 2 AM effective-day reset",
  );
});
