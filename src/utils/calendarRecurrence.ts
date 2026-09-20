import type { NativeCalendarEventOptions } from "@/plugins/NativeCalendarTypes";
export function nativeCalendarRecurrence(task: { recurrence_pattern: string | null; recurrence_days: number[] | null; recurrence_month_days: number[] | null; recurrence_custom_period: "week" | "month" | null }): NativeCalendarEventOptions["recurrence"] {
  const pattern = task.recurrence_pattern;
  if (!pattern || pattern === "none") return undefined;
  if (pattern === "daily") return { frequency: "daily" };
  if (pattern === "weekly") return { frequency: "weekly", weekdays: task.recurrence_days ?? undefined };
  if (pattern === "weekdays") return { frequency: "weekly", weekdays: [1,2,3,4,5] };
  if (pattern === "monthly") return { frequency: "monthly", monthDays: task.recurrence_month_days ?? undefined };
  if (pattern === "yearly") return { frequency: "yearly" };
  if (pattern === "custom") return task.recurrence_custom_period === "month"
    ? { frequency: "monthly", monthDays: task.recurrence_month_days ?? undefined }
    : { frequency: "weekly", weekdays: task.recurrence_days ?? undefined };
  throw new Error("This repeat pattern cannot be exported safely yet.");
}
