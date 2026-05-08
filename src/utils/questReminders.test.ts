import { describe, expect, it } from "vitest";
import {
  parseQuestReminderDateTime,
  resolveCustomQuestReminderOffset,
} from "./questReminders";

describe("quest reminder date/time helpers", () => {
  it("parses a quest date and scheduled time as a local Date", () => {
    const parsed = parseQuestReminderDateTime("2026-02-13", "09:30");

    expect(parsed).toBeInstanceOf(Date);
    expect(parsed?.getFullYear()).toBe(2026);
    expect(parsed?.getMonth()).toBe(1);
    expect(parsed?.getDate()).toBe(13);
    expect(parsed?.getHours()).toBe(9);
    expect(parsed?.getMinutes()).toBe(30);
  });

  it("converts a valid custom reminder date/time into minutes before the quest", () => {
    expect(resolveCustomQuestReminderOffset({
      questDate: "2026-02-13",
      questTime: "09:30",
      reminderDate: "2026-02-13",
      reminderTime: "08:00",
    })).toBe(90);
  });

  it("rejects custom reminders at or after the quest start", () => {
    expect(resolveCustomQuestReminderOffset({
      questDate: "2026-02-13",
      questTime: "09:30",
      reminderDate: "2026-02-13",
      reminderTime: "09:30",
    })).toBeNull();

    expect(resolveCustomQuestReminderOffset({
      questDate: "2026-02-13",
      questTime: "09:30",
      reminderDate: "2026-02-13",
      reminderTime: "10:00",
    })).toBeNull();
  });

  it("rejects custom reminders more than one week before the quest", () => {
    expect(resolveCustomQuestReminderOffset({
      questDate: "2026-02-13",
      questTime: "09:30",
      reminderDate: "2026-02-06",
      reminderTime: "09:29",
    })).toBeNull();
  });

  it("rejects invalid date/time values", () => {
    expect(parseQuestReminderDateTime("2026-02-31", "09:30")).toBeNull();
    expect(resolveCustomQuestReminderOffset({
      questDate: "2026-02-13",
      questTime: "not-a-time",
      reminderDate: "2026-02-13",
      reminderTime: "08:00",
    })).toBeNull();
  });
});
