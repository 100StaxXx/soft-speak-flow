import { describe, expect, it } from "vitest";
import { getTodayIfDateStale, shouldResetJourneysDate } from "@/pages/journeysDateSync";

describe("journeysDateSync", () => {
  it("resets to today when entering /journeys from another tab", () => {
    const shouldReset = shouldResetJourneysDate("/inbox", "/journeys");
    expect(shouldReset).toBe(true);

    const staleDate = new Date("2026-02-10T12:00:00.000Z");
    const today = new Date("2026-02-13T09:30:00.000Z");
    const synced = getTodayIfDateStale(staleDate, today);

    expect(synced).toBe(today);
  });

  it("resets stale selection on foreground sync while journeys is active", () => {
    const selectedDate = new Date("2026-02-11T08:00:00.000Z");
    const now = new Date("2026-02-13T18:00:00.000Z");

    const synced = getTodayIfDateStale(selectedDate, now);
    expect(synced).toBe(now);
  });

  it("keeps selected date unchanged when already on today", () => {
    const selectedDate = new Date("2026-02-13T08:00:00.000Z");
    const now = new Date("2026-02-13T18:00:00.000Z");

    const synced = getTodayIfDateStale(selectedDate, now);
    expect(synced).toBe(selectedDate);
    expect(shouldResetJourneysDate("/journeys", "/journeys")).toBe(false);
  });
});
