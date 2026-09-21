import { describe, it, expect } from "vitest";
import { dedupeExternalCalendarEvents, externalEventsForDay, findEventConflicts, normalizeExternalCalendarEvent } from "./externalCalendar";
const allDay = normalizeExternalCalendarEvent({ id: "holiday", title: "Trip", startDate: "2026-09-19", endDate: "2026-09-22", isAllDay: true }, "google", "Personal")!;
describe("external event day intersections", () => {
  it("does not merge equal IDs from different calendars or connections", () => {
    expect(dedupeExternalCalendarEvents([{ ...allDay, calendarId: 'personal' }, { ...allDay, calendarId: 'work' }, { ...allDay, calendarId: 'work', connectionId: 'other-account' }])).toHaveLength(3);
  });
  it("includes every day but not the exclusive end", () => {
    for (const day of [19,20,21]) expect(externalEventsForDay([allDay], new Date(2026,8,day))).toHaveLength(1);
    expect(externalEventsForDay([allDay], new Date(2026,8,22))).toHaveLength(0);
  });
  it("clips an overnight event without losing its source identity", () => {
    const event = normalizeExternalCalendarEvent({ id: "overnight", startDate: new Date(2026,8,19,23).toISOString(), endDate: new Date(2026,8,20,2).toISOString() }, "apple", "Personal")!;
    expect(externalEventsForDay([event], new Date(2026,8,20))[0]).toMatchObject({ id: "overnight", scheduledTime: "00:00", estimatedDuration: 120, startDate: event.startDate });
  });
  it("rejects unsafe provider links", () => expect(normalizeExternalCalendarEvent({ ...allDay, htmlLink: "javascript:alert(1)" }, "google", "Calendar")?.htmlLink).toBeNull());
  it("does not treat free events or adjacent events as conflicts", () => {
    const event = normalizeExternalCalendarEvent({ id: "a", startDate: "2026-09-19T10:00Z", endDate: "2026-09-19T11:00Z" }, "google", "Work")!;
    expect(findEventConflicts(event, [{ ...event, id: "b", availability: "free" }, { ...event, id: "c", startDate: event.endDate, endDate: "2026-09-19T12:00Z" }])).toEqual([]);
  });
});
