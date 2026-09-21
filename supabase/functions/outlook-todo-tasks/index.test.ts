function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(message);
  }
}

function assertEquals<T>(actual: T, expected: T, message: string): void {
  if (actual !== expected) {
    throw new Error(`${message} (expected ${expected}, got ${actual})`);
  }
}

const moduleUnderTest = await import("./index.ts");

Deno.test("outlook-todo-tasks maps due-date tasks into planner-visible date-only quests", () => {
  const patch = moduleUnderTest.mapOutlookTaskToTaskUpdate({
    title: "Pay rent",
    dueDateTime: {
      dateTime: "2026-04-19T23:59:00",
      timeZone: "UTC",
    },
    importance: "high",
    status: "notStarted",
  });

  assertEquals(patch.task_date, "2026-04-19", "Expected due date to map into task_date");
  assertEquals(patch.scheduled_time, null, "Expected due-only Outlook tasks to stay date-only");
  assertEquals(patch.difficulty, "hard", "Expected high importance to map to hard difficulty");
});

Deno.test("outlook-todo-tasks imports remote tasks as outlook_sync rows", () => {
  const insertPayload = moduleUnderTest.buildImportedTaskInsert("user-1", {
    title: "Inbox follow-up",
    body: { content: "Ping the team" },
    status: "completed",
    completedDateTime: {
      dateTime: "2026-04-19T18:00:00",
      timeZone: "UTC",
    },
  });

  assertEquals(String(insertPayload.user_id), "user-1", "Expected imported row to target the user");
  assertEquals(String(insertPayload.source), "outlook_sync", "Expected imported tasks to use outlook_sync source");
  assertEquals(Boolean(insertPayload.completed), true, "Expected completed remote tasks to stay completed locally");
  assertEquals(String(insertPayload.task_text), "Inbox follow-up", "Expected task title to round-trip");
});

Deno.test("outlook-todo-tasks prefers the newer provider edit when app sync is older", () => {
  assertEquals(
    moduleUnderTest.shouldProviderWin("2026-04-19T12:00:00.000Z", "2026-04-19T11:00:00.000Z"),
    true,
    "Expected newer provider timestamp to win",
  );
  assertEquals(
    moduleUnderTest.shouldProviderWin("2026-04-19T10:00:00.000Z", "2026-04-19T11:00:00.000Z"),
    false,
    "Expected older provider timestamp to lose",
  );
  assert(
    moduleUnderTest.shouldProviderWin(null, null),
    "Expected missing timestamps to default to provider win for initial hydration",
  );
});
