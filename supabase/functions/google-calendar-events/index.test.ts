function assertEquals<T>(actual: T, expected: T, message: string): void {
  if (actual !== expected) {
    throw new Error(`${message} (expected ${expected}, got ${actual})`);
  }
}

const moduleUnderTest = await import("./index.ts");

Deno.test("google-calendar-events builds timed payloads in the user's timezone", () => {
  const payload = moduleUnderTest.toGoogleEventPayload(
    {
      id: "task-1",
      user_id: "user-1",
      task_text: "Daily Cardio",
      task_date: "2026-05-11",
      scheduled_time: "06:00",
      estimated_duration: 30,
      location: null,
      notes: null,
    },
    "America/Los_Angeles",
  );

  assertEquals(
    payload.start.dateTime,
    "2026-05-11T13:00:00.000Z",
    "Expected 6:00 AM Los Angeles time to be sent as the matching UTC instant",
  );
  assertEquals(
    payload.end.dateTime,
    "2026-05-11T13:30:00.000Z",
    "Expected duration to be applied after timezone conversion",
  );
});

Deno.test("google-calendar-events maps synced UTC instants back to local quest time", () => {
  const patch = moduleUnderTest.mapGoogleEventToTaskUpdate(
    {
      summary: "Daily Cardio",
      start: { dateTime: "2026-05-11T13:00:00.000Z" },
      end: { dateTime: "2026-05-11T13:30:00.000Z" },
    },
    "America/Los_Angeles",
  );

  assertEquals(patch.task_date, "2026-05-11", "Expected provider pull to preserve local date");
  assertEquals(patch.scheduled_time, "06:00", "Expected provider pull to preserve local time");
  assertEquals(patch.estimated_duration, 30, "Expected provider pull to preserve duration");
});
