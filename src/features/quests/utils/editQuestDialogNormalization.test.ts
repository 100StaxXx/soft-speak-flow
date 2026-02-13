import { describe, expect, it } from "vitest";
import {
  normalizeQuestDifficulty,
  normalizeScheduledTime,
  normalizeTaskDate,
  parseTaskDate,
} from "./editQuestDialogNormalization";

describe("editQuestDialogNormalization", () => {
  it("normalizes legacy difficulty values to supported values", () => {
    expect(normalizeQuestDifficulty("easy")).toBe("easy");
    expect(normalizeQuestDifficulty("challenging")).toBe("hard");
    expect(normalizeQuestDifficulty("beginner")).toBe("easy");
    expect(normalizeQuestDifficulty("unexpected")).toBe("medium");
  });

  it("normalizes supported scheduled time formats to HH:mm", () => {
    expect(normalizeScheduledTime("09:30")).toBe("09:30");
    expect(normalizeScheduledTime("09:30:00")).toBe("09:30");
    expect(normalizeScheduledTime("9:30 AM")).toBe("09:30");
    expect(normalizeScheduledTime("2026-02-13T16:45:00.000Z")).toMatch(/^\d{2}:\d{2}$/);
  });

  it("returns null for invalid scheduled time strings", () => {
    expect(normalizeScheduledTime("")).toBeNull();
    expect(normalizeScheduledTime("not-a-time")).toBeNull();
  });

  it("normalizes date-only and ISO date-time task dates", () => {
    expect(normalizeTaskDate("2026-02-13")).toBe("2026-02-13");
    expect(normalizeTaskDate("2026-02-13T08:00:00.000Z")).toBe("2026-02-13");
    expect(normalizeTaskDate("02/13/2026")).toBeNull();
  });

  it("parses normalized task dates safely", () => {
    const parsed = parseTaskDate("2026-02-13T08:00:00.000Z");
    expect(parsed).not.toBeNull();
    expect(parsed?.toISOString().startsWith("2026-02-13")).toBe(true);
    expect(parseTaskDate("bad")).toBeNull();
  });
});
