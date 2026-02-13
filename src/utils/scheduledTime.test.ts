import { describe, expect, it } from "vitest";
import { getScheduledTimeParts, normalizeScheduledTime, parseScheduledTime } from "./scheduledTime";

describe("scheduledTime utils", () => {
  it("normalizes HH:mm and HH:mm:ss values", () => {
    expect(normalizeScheduledTime("09:30")).toBe("09:30");
    expect(normalizeScheduledTime("9:30")).toBe("09:30");
    expect(normalizeScheduledTime("09:30:00")).toBe("09:30");
  });

  it("normalizes 12-hour and ISO datetime values", () => {
    expect(normalizeScheduledTime("9:30 AM")).toBe("09:30");
    expect(normalizeScheduledTime("2026-02-13T16:45:00.000Z")).toMatch(/^\d{2}:\d{2}$/);
  });

  it("extracts hour and minute parts", () => {
    expect(getScheduledTimeParts("18:05:00")).toEqual({
      hour: 18,
      minute: 5,
      normalized: "18:05",
    });
  });

  it("parses normalized values onto a base date", () => {
    const base = new Date("2000-01-01T00:00:00");
    const parsed = parseScheduledTime("18:05:00", base);
    expect(parsed).not.toBeNull();
    expect(parsed?.getHours()).toBe(18);
    expect(parsed?.getMinutes()).toBe(5);
  });

  it("returns null for invalid values", () => {
    expect(normalizeScheduledTime("not-a-time")).toBeNull();
    expect(parseScheduledTime("bad")).toBeNull();
    expect(getScheduledTimeParts("")).toBeNull();
  });
});
