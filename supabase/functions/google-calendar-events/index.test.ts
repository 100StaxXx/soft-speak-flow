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

Deno.test("google-calendar-events maps live range events into read-only planner context", () => {
  const event = moduleUnderTest.mapGoogleRangeEvent(
    {
      id: "event-1",
      summary: "Design review",
      start: { dateTime: "2026-05-11T17:00:00-07:00" },
      end: { dateTime: "2026-05-11T17:45:00-07:00" },
      location: "Studio",
    },
    "connection-1",
  );
  assertEquals(event?.title, "Design review", "Expected the event title");
  assertEquals(event?.source, "google", "Expected Google attribution");
  assertEquals(event?.read_only, true, "Expected external events to stay read-only");
});

Deno.test("google-calendar-events exposes read-only events for the agenda", () => {
  const event = moduleUnderTest.toGoogleExternalCalendarEvent(
    {
      id: "event-1",
      summary: "Team sync",
      start: { dateTime: "2026-05-11T13:00:00.000Z" },
      end: { dateTime: "2026-05-11T13:30:00.000Z" },
      location: "Zoom",
      htmlLink: "https://calendar.google.com/event?eid=1",
    },
    "primary",
    "Work",
  );

  assertEquals(event?.title, "Team sync", "Expected the provider title");
  assertEquals(event?.calendarName, "Work", "Expected the selected calendar label");
  assertEquals(event?.isAllDay, false, "Expected a timed event");
});
