import { getDate, lastDayOfMonth } from "date-fns";

export type HabitFrequency =
  | "daily"
  | "5x_week"
  | "3x_week"
  | "weekly"
  | "monthly"
  | "custom";

export type HabitCustomPeriod = "week" | "month";

export interface HabitSchedule {
  frequency?: string | null;
  custom_days?: number[] | null;
  custom_month_days?: number[] | null;
  customPeriod?: HabitCustomPeriod | null;
}

const WEEKDAY_SHORT = ["M", "T", "W", "T", "F", "S", "S"];
const MONTHLY_APPROX_WEEKS = 4.33;

function normalizeNumberList(values: number[] | null | undefined): number[] {
  if (!values || values.length === 0) return [];
  return [...new Set(values)].sort((a, b) => a - b);
}

export function inferCustomPeriod(schedule: HabitSchedule): HabitCustomPeriod {
  if (schedule.customPeriod === "month") return "month";
  if (schedule.customPeriod === "week") return "week";
  if ((schedule.custom_month_days?.length ?? 0) > 0) return "month";
  return "week";
}

export function getDefaultWeekdaysForFrequency(frequency: string | null | undefined): number[] {
  switch (frequency) {
    case "daily":
      return [0, 1, 2, 3, 4, 5, 6];
    case "weekdays":
    case "5x_week":
      return [0, 1, 2, 3, 4];
    case "3x_week":
      return [0, 2, 4];
    case "weekly":
      return [0];
    default:
      return [];
  }
}

export function getDefaultMonthDaysForFrequency(frequency: string | null | undefined): number[] {
  if (frequency === "monthly") return [1];
  return [];
}

export function estimateOccurrencesPerWeek(schedule: HabitSchedule): number {
  const frequency = schedule.frequency?.toLowerCase();
  const customDays = normalizeNumberList(schedule.custom_days);
  const customMonthDays = normalizeNumberList(schedule.custom_month_days);
  const customPeriod = inferCustomPeriod(schedule);

  switch (frequency) {
    case "daily":
      return 7;
    case "weekdays":
    case "5x_week":
      return 5;
    case "3x_week":
      return customDays.length || 3;
    case "weekly":
      return 1;
    case "monthly":
      return (customMonthDays.length || 1) / MONTHLY_APPROX_WEEKS;
    case "custom":
      if (customPeriod === "month") {
        return (customMonthDays.length || 1) / MONTHLY_APPROX_WEEKS;
      }
      return customDays.length || 1;
    default:
      return 3;
  }
}

export function getClampedMonthDays(monthDays: number[] | null | undefined, targetDate: Date): number[] {
  const lastDay = getDate(lastDayOfMonth(targetDate));
  return normalizeNumberList(
    normalizeNumberList(monthDays).map((day) => Math.min(Math.max(day, 1), lastDay))
  );
}

export function isHabitScheduledForDate(schedule: HabitSchedule, targetDate: Date, weekdayIndex: number): boolean {
  const frequency = schedule.frequency?.toLowerCase();
  const customDays = normalizeNumberList(schedule.custom_days);
  const monthDays = getClampedMonthDays(schedule.custom_month_days, targetDate);
  const dayOfMonth = getDate(targetDate);
  const customPeriod = inferCustomPeriod(schedule);

  switch (frequency) {
    case "daily":
      return true;
    case "weekly":
      return (customDays[0] ?? 0) === weekdayIndex;
    case "weekdays":
    case "5x_week":
      return weekdayIndex >= 0 && weekdayIndex <= 4;
    case "weekends":
      return weekdayIndex === 5 || weekdayIndex === 6;
    case "3x_week":
      return (customDays.length > 0 ? customDays : [0, 2, 4]).includes(weekdayIndex);
    case "monthly":
      return (monthDays.length > 0 ? monthDays : [1]).includes(dayOfMonth);
    case "custom":
      if (customPeriod === "month") {
        return (monthDays.length > 0 ? monthDays : [1]).includes(dayOfMonth);
      }
      return customDays.includes(weekdayIndex);
    default:
      return true;
  }
}

export function formatScheduleSelectionShort(schedule: HabitSchedule): string {
  const frequency = schedule.frequency?.toLowerCase();
  const customDays = normalizeNumberList(schedule.custom_days);
  const customMonthDays = normalizeNumberList(schedule.custom_month_days);
  const customPeriod = inferCustomPeriod(schedule);

  if (frequency === "daily" || customDays.length === 7) return "";
  if (frequency === "weekdays" || frequency === "5x_week") return "";
  if (frequency === "weekly") {
    return customDays.length > 0 ? WEEKDAY_SHORT[customDays[0]] ?? "" : "";
  }
  if (frequency === "monthly") {
    return customMonthDays.length > 0 ? customMonthDays.join(",") : "1";
  }
  if (frequency === "custom") {
    if (customPeriod === "month") {
      return customMonthDays.join(",");
    }
    return customDays.map((day) => WEEKDAY_SHORT[day]).join("");
  }
  return "";
}

export function formatScheduleLabel(schedule: HabitSchedule): string {
  const frequency = schedule.frequency?.toLowerCase();
  const customPeriod = inferCustomPeriod(schedule);

  switch (frequency) {
    case "daily":
      return "Daily";
    case "weekdays":
    case "5x_week":
      return "Weekdays";
    case "3x_week":
      return "3x/week";
    case "weekly":
      return "Weekly";
    case "monthly":
      return "Monthly";
    case "custom":
      return customPeriod === "month" ? "Custom (M)" : "Custom";
    default:
      return "Custom";
  }
}
