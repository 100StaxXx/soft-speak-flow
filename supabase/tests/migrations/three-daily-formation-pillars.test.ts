function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

const migrationUrl = new URL(
  "../../migrations/20260811103000_three_daily_formation_pillars.sql",
  import.meta.url,
);

Deno.test("daily formation stores one independent assignment per pillar", async () => {
  const source = await Deno.readTextFile(migrationUrl);

  assert(
    source.includes("UNIQUE (user_id, practice_date, category)") &&
      source.includes("assignment.category = p_category"),
    "Expected Mind, Body, and Soul to use separate stable daily assignments",
  );
  assert(
    source.includes("task.category = v_task_category"),
    "Expected each assignment to reuse only a task from its own pillar",
  );
  assert(
    source.includes("SET category = lower(assignment.category)") &&
      source.includes("task.id = assignment.task_id"),
    "Expected legacy linked task categories to be repaired during migration",
  );
});

Deno.test("the database enforces the reviewed practice-to-pillar mapping", async () => {
  const source = await Deno.readTextFile(migrationUrl);

  assert(
    source.includes("daily_formation_assignments_practice_category_check"),
    "Expected a database constraint that prevents cross-pillar practice reuse",
  );
  assert(
    source.includes("p_category = 'Mind' AND p_practice_key NOT IN") &&
      source.includes("p_category = 'Body' AND p_practice_key NOT IN") &&
      source.includes("p_category = 'Soul' AND p_practice_key NOT IN"),
    "Expected the preparation RPC to reject a practice assigned to the wrong pillar",
  );
});
