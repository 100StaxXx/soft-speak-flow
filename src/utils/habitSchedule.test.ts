import { describe, expect, it } from "vitest";
import { parseISO } from "date-fns";
import { estimateOccurrencesPerWeek, getClampedMonthDays, isHabitScheduledForDate } from "./habitSchedule";

describe("habitSchedule", () => {
  it("clamps long month-day selections to the last day of short months", () => {
    expect(getClampedMonthDays([15, 30, 31], parseISO("2026-02-01"))).toEqual([15, 28]);
  });

  it("matches monthly schedules on the selected day of month", () => {
    const habit = { frequency: "monthly", custom_month_days: [15] };

    expect(isHabitScheduledForDate(habit, parseISO("2026-03-15"), 6)).toBe(true);
    expect(isHabitScheduledForDate(habit, parseISO("2026-03-14"), 5)).toBe(false);
  });

  it("matches custom month schedules with multiple dates", () => {
    const habit = { frequency: "custom", custom_month_days: [1, 15, 31], customPeriod: "month" as const };

    expect(isHabitScheduledForDate(habit, parseISO("2026-01-31"), 5)).toBe(true);
    expect(isHabitScheduledForDate(habit, parseISO("2026-02-28"), 5)).toBe(true);
    expect(isHabitScheduledForDate(habit, parseISO("2026-02-27"), 4)).toBe(false);
  });

  it("estimates monthly schedules as fractional weekly work", () => {
    expect(estimateOccurrencesPerWeek({ frequency: "monthly", custom_month_days: [1, 15] })).toBeCloseTo(2 / 4.33, 5);
  });
});
