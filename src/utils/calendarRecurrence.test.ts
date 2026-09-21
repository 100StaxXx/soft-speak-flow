import { expect, it } from "vitest";
import { nativeCalendarRecurrence } from "./calendarRecurrence";
const task = { recurrence_pattern: null, recurrence_days: null, recurrence_month_days: null, recurrence_custom_period: null };
it("supports native monthly multi-date recurrence", () => expect(nativeCalendarRecurrence({ ...task, recurrence_pattern: "custom", recurrence_custom_period: "month", recurrence_month_days: [1,15] })).toEqual({ frequency:"monthly", monthDays:[1,15] }));
it("keeps weekdays out of weekends", () => expect(nativeCalendarRecurrence({ ...task, recurrence_pattern:"weekdays" })).toEqual({frequency:"weekly",weekdays:[1,2,3,4,5]}));
it("does not silently convert unknown patterns", () => expect(()=>nativeCalendarRecurrence({ ...task, recurrence_pattern:"unknown" })).toThrow());
it("does not create a series for a one-off quest", () => expect(nativeCalendarRecurrence(task)).toBeUndefined());
