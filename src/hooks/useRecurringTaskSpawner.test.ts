import { describe, expect, it } from "vitest";
import { type RecurringTask, shouldSpawnToday, toAppDayIndex } from "./useRecurringTaskSpawner";

function buildTemplate(overrides: Partial<RecurringTask>): RecurringTask {
  return {
    id: "template-1",
    task_text: "Recurring quest",
    difficulty: "medium",
    task_date: "2026-02-02",
    created_at: "2026-02-02T12:00:00.000Z",
    scheduled_time: "09:00",
    estimated_duration: 30,
    category: null,
    recurrence_pattern: "daily",
    recurrence_days: null,
    recurrence_end_date: null,
    xp_reward: 50,
    epic_id: null,
    reminder_enabled: false,
    reminder_minutes_before: null,
    ...overrides,
  };
}

describe("useRecurringTaskSpawner recurrence matching", () => {
  it("converts JS day indexes to Monday-first indexes", () => {
    expect(toAppDayIndex(0)).toBe(6); // Sunday
    expect(toAppDayIndex(1)).toBe(0); // Monday
    expect(toAppDayIndex(6)).toBe(5); // Saturday
  });

  it("matches weekly by a single selected day", () => {
    const template = buildTemplate({
      recurrence_pattern: "weekly",
      recurrence_days: [2], // Wednesday
    });

    expect(shouldSpawnToday(template, 2, new Date("2026-02-11T09:00:00.000Z"))).toBe(true);
    expect(shouldSpawnToday(template, 1, new Date("2026-02-10T09:00:00.000Z"))).toBe(false);
  });

  it("matches custom with multiple selected days", () => {
    const template = buildTemplate({
      recurrence_pattern: "custom",
      recurrence_days: [0, 2, 4],
    });

    expect(shouldSpawnToday(template, 0, new Date("2026-02-09T09:00:00.000Z"))).toBe(true);
    expect(shouldSpawnToday(template, 3, new Date("2026-02-12T09:00:00.000Z"))).toBe(false);
  });

  it("matches weekdays on Monday-Friday only", () => {
    const template = buildTemplate({
      recurrence_pattern: "weekdays",
      recurrence_days: null,
    });

    expect(shouldSpawnToday(template, 0, new Date("2026-02-09T09:00:00.000Z"))).toBe(true); // Monday
    expect(shouldSpawnToday(template, 4, new Date("2026-02-13T09:00:00.000Z"))).toBe(true); // Friday
    expect(shouldSpawnToday(template, 5, new Date("2026-02-14T09:00:00.000Z"))).toBe(false); // Saturday
    expect(shouldSpawnToday(template, 6, new Date("2026-02-15T09:00:00.000Z"))).toBe(false); // Sunday
  });

  it("matches biweekly every 14 days from anchor date", () => {
    const template = buildTemplate({
      recurrence_pattern: "biweekly",
      task_date: "2026-02-02", // Monday
      recurrence_days: [0], // Monday
    });

    expect(shouldSpawnToday(template, 0, new Date("2026-02-16T09:00:00.000Z"))).toBe(true); // +14 days
    expect(shouldSpawnToday(template, 0, new Date("2026-02-09T09:00:00.000Z"))).toBe(false); // +7 days
    expect(shouldSpawnToday(template, 2, new Date("2026-02-18T09:00:00.000Z"))).toBe(false); // wrong weekday
  });

  it("matches monthly with month-end clamp for long months", () => {
    const template = buildTemplate({
      recurrence_pattern: "monthly",
      task_date: "2026-01-31",
      recurrence_days: null,
    });

    expect(shouldSpawnToday(template, 5, new Date("2026-02-28T09:00:00.000Z"))).toBe(true);
    expect(shouldSpawnToday(template, 4, new Date("2026-02-27T09:00:00.000Z"))).toBe(false);
  });
});
