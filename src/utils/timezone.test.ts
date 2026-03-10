import { afterEach, describe, expect, it, vi } from "vitest";
import { getEffectiveMissionDate } from "./timezone";

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
});
