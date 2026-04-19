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
