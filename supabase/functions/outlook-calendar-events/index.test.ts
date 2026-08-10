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

Deno.test("outlook-calendar-events normalizes Graph UTC event times for the agenda", () => {
  const event = moduleUnderTest.toOutlookExternalCalendarEvent(
    {
      id: "event-1",
      subject: "Team sync",
      start: { dateTime: "2026-05-11T13:00:00.0000000", timeZone: "UTC" },
      end: { dateTime: "2026-05-11T13:30:00.0000000", timeZone: "UTC" },
      isAllDay: false,
      location: { displayName: "Teams" },
      webLink: "https://outlook.office.com/calendar/item/1",
    },
    "calendar-1",
    "Work",
  );

  assertEquals(event?.startDate.endsWith("Z"), true, "Expected UTC Graph timestamps to carry a zone");
  assertEquals(event?.calendarName, "Work", "Expected the selected calendar label");
  assertEquals(event?.location, "Teams", "Expected the event location");
});
