import { describe, expect, it } from "vitest";
import {
  dedupeExternalCalendarEvents,
  externalCalendarEventToCalendarTask,
  normalizeExternalCalendarEvent,
} from "./externalCalendar";

describe("external calendar event normalization", () => {
  it("maps timed provider events into the device-local agenda time", () => {
    const event = normalizeExternalCalendarEvent({
      id: "meeting-1",
      title: "Project review",
      startDate: "2026-08-09T17:30:00.000Z",
      endDate: "2026-08-09T18:15:00.000Z",
      isAllDay: false,
      calendarName: "Work",
    }, "google", "Google Calendar");

    expect(event).not.toBeNull();
    expect(event?.estimatedDuration).toBe(45);
    expect(event?.calendarName).toBe("Work");
    expect(event?.scheduledTime).toMatch(/^\d{2}:\d{2}$/);
  });

  it("preserves the provider date for all-day events", () => {
    const event = normalizeExternalCalendarEvent({
      id: "holiday-1",
      title: "Holiday",
      startDate: "2026-08-10",
      endDate: "2026-08-11",
      isAllDay: true,
    }, "outlook", "Outlook Calendar");

    expect(event).toMatchObject({
      taskDate: "2026-08-10",
      scheduledTime: null,
      estimatedDuration: 1440,
    });
  });

  it("drops malformed events and deduplicates provider event IDs", () => {
    expect(normalizeExternalCalendarEvent({ id: "bad" }, "google", "Google")).toBeNull();
    expect(normalizeExternalCalendarEvent({
      id: "backwards",
      startDate: "2026-08-09T18:30:00.000Z",
      endDate: "2026-08-09T18:00:00.000Z",
    }, "google", "Google")).toBeNull();

    const event = normalizeExternalCalendarEvent({
      id: "meeting-1",
      startDate: "2026-08-09T17:30:00.000Z",
      endDate: "2026-08-09T18:00:00.000Z",
    }, "google", "Google")!;

    expect(dedupeExternalCalendarEvents([event, { ...event, title: "Updated" }])).toHaveLength(1);
    expect(dedupeExternalCalendarEvents([event, { ...event, title: "Updated" }])[0].title).toBe("Updated");
  });

  it("only keeps safe web links from calendar providers", () => {
    const event = normalizeExternalCalendarEvent({
      id: "meeting-safe-link",
      startDate: "2026-08-09T17:30:00.000Z",
      endDate: "2026-08-09T18:00:00.000Z",
      htmlLink: "javascript:alert(document.domain)",
    }, "google", "Google")!;

    expect(event.htmlLink).toBeNull();
  });

  it("creates read-only month-calendar markers", () => {
    const event = normalizeExternalCalendarEvent({
      id: "meeting-1",
      title: "Project review",
      startDate: "2026-08-09T17:30:00.000Z",
      endDate: "2026-08-09T18:00:00.000Z",
    }, "google", "Work")!;

    expect(externalCalendarEventToCalendarTask(event)).toMatchObject({
      id: "external:google:meeting-1",
      source: "external_calendar",
      completed: false,
      xp_reward: 0,
    });
  });
});
