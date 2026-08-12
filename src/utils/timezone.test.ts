import { afterEach, describe, expect, it, vi } from "vitest";
import {
  getEffectiveDailyDate,
  getEffectiveDayOfWeek,
  getEffectiveMissionDate,
  getLocalCalendarDate,
  getLocalHour,
  getUserTimezone,
} from "./timezone";

describe("getEffectiveMissionDate", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns strict YYYY-MM-DD format without locale separators", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-10T15:30:00Z"));

    const missionDate = getEffectiveMissionDate("UTC");
    expect(missionDate).toBe("2026-03-10");
    expect(missionDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(missionDate).not.toContain("/");
  });

  it("returns the previous day before the 2 AM reset", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-10T01:30:00Z"));

    expect(getEffectiveMissionDate("UTC")).toBe("2026-03-09");
  });

  it("returns the same day at or after the 2 AM reset", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-10T02:00:00Z"));

    expect(getEffectiveMissionDate("UTC")).toBe("2026-03-10");
  });

  it("allows explicit timezone overrides", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-10T08:30:00Z"));

    expect(getEffectiveDailyDate("America/Los_Angeles")).toBe("2026-03-09");
    expect(getEffectiveDailyDate("UTC")).toBe("2026-03-10");
  });

  it("subtracts from the target timezone calendar date before reset", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-29T22:00:00Z"));

    expect(getEffectiveDailyDate("Europe/Berlin")).toBe("2026-03-29");
    expect(getEffectiveDayOfWeek("Europe/Berlin")).toBe(0);
  });

  it("handles offset-boundary dates without using the device timezone", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-11-01T15:00:00Z"));

    expect(getEffectiveDailyDate("Asia/Tokyo")).toBe("2026-11-01");
  });

  it("falls back to the device timezone when no timezone is provided", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-10T08:30:00Z"));

    expect(getEffectiveDailyDate()).toBe(getEffectiveDailyDate(getUserTimezone()));
  });

  it("uses the device timezone for mission helpers when no timezone is provided", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-10T08:30:00Z"));

    expect(getEffectiveMissionDate()).toBe(getEffectiveDailyDate(getUserTimezone()));
  });

  it("still exposes the device timezone for profile bootstrapping", () => {
    expect(getUserTimezone()).toBe(Intl.DateTimeFormat().resolvedOptions().timeZone);
  });

  it("returns calendar date and hour in the requested local timezone", () => {
    const instant = new Date("2026-03-10T02:30:00Z");

    expect(getLocalCalendarDate("America/Los_Angeles", instant)).toBe("2026-03-09");
    expect(getLocalHour("America/Los_Angeles", instant)).toBe(19);
    expect(getLocalCalendarDate("Asia/Tokyo", instant)).toBe("2026-03-10");
    expect(getLocalHour("Asia/Tokyo", instant)).toBe(11);
  });
});
