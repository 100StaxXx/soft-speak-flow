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

Deno.test("outlook-calendar-events builds planner cache rows without linked duplicates", () => {
  const { rows, plannerEvents } = moduleUnderTest.buildPlannerEventCacheRows({
    events: [
      {
        id: "event-linked",
        subject: "Already linked quest",
        start: { dateTime: "2026-04-19T09:00:00" },
        end: { dateTime: "2026-04-19T09:30:00" },
        isAllDay: false,
      },
      {
        id: "event-free-busy",
        subject: "Team sync",
        body: { content: "Availability block" },
        start: { dateTime: "2026-04-19T11:00:00" },
        end: { dateTime: "2026-04-19T12:00:00" },
        isAllDay: false,
        location: { displayName: "Zoom" },
      },
      {
        id: "event-cancelled",
        subject: "Cancelled",
        start: { dateTime: "2026-04-19T13:00:00" },
        end: { dateTime: "2026-04-19T14:00:00" },
        isCancelled: true,
      },
    ],
    linkedEventIds: new Set(["event-linked"]),
    userId: "user-1",
    connectionId: "conn-1",
    syncedAt: "2026-04-19T08:00:00.000Z",
  });

  assertEquals(rows.length, 1, "Expected only non-linked active events to be cached");
  assertEquals(plannerEvents.length, 1, "Expected only non-linked active events in planner response");
  assertEquals(String(rows[0]?.external_event_id), "event-free-busy", "Expected cache row to match external event id");
  assertEquals(String(rows[0]?.source), "outlook", "Expected Outlook cache source");
  assertEquals(plannerEvents[0]?.provider, "outlook", "Expected planner event provider");
  assertEquals(plannerEvents[0]?.title, "Team sync", "Expected planner title from Outlook subject");
});

Deno.test("outlook-calendar-events narrows custom weekly recurrence to week", () => {
  const fields = moduleUnderTest.toTaskRecurrenceFields({
    recurrence: {
      pattern: {
        type: "weekly",
        interval: 1,
        daysOfWeek: ["monday", "wednesday"],
      },
      range: {
        type: "endDate",
        endDate: "2026-05-01",
      },
    },
  });

  assertEquals(fields.recurrence_pattern, "custom", "Expected multi-day weekly recurrence to map to custom");
  assertEquals(fields.recurrence_custom_period, "week", "Expected custom weekly recurrence period");
  assert(Array.isArray(fields.recurrence_days), "Expected recurrence days array");
  assertEquals(fields.recurrence_days?.length ?? 0, 2, "Expected 2 mapped recurrence days");
});

Deno.test("outlook-calendar-events builds timed payloads in the user's timezone", () => {
  const payload = moduleUnderTest.toOutlookEventPayload(
    {
      id: "task-1",
      user_id: "user-1",
      task_text: "Daily Cardio",
      task_date: "2026-05-11",
      scheduled_time: "06:00",
      estimated_duration: 30,
      reminder_enabled: false,
      reminder_minutes_before: null,
      recurrence_pattern: null,
      recurrence_days: null,
      recurrence_month_days: null,
      recurrence_custom_period: null,
      recurrence_end_date: null,
      location: null,
      notes: null,
    },
    "America/Los_Angeles",
  );

  assertEquals(
    payload.start.dateTime,
    "2026-05-11T13:00:00.000",
    "Expected 6:00 AM Los Angeles time to be sent as the matching UTC instant",
  );
  assertEquals(payload.start.timeZone, "UTC", "Expected Outlook payload timezone to remain UTC");
  assertEquals(
    payload.end.dateTime,
    "2026-05-11T13:30:00.000",
    "Expected duration to be applied after timezone conversion",
  );
});

Deno.test("outlook-calendar-events maps synced UTC instants back to local quest time", () => {
  const patch = moduleUnderTest.mapOutlookEventToTaskUpdate(
    {
      subject: "Daily Cardio",
      start: { dateTime: "2026-05-11T13:00:00.000Z" },
      end: { dateTime: "2026-05-11T13:30:00.000Z" },
      isAllDay: false,
    },
    "America/Los_Angeles",
  );

  assertEquals(patch.task_date, "2026-05-11", "Expected provider pull to preserve local date");
  assertEquals(patch.scheduled_time, "06:00", "Expected provider pull to preserve local time");
  assertEquals(patch.estimated_duration, 30, "Expected provider pull to preserve duration");
});
