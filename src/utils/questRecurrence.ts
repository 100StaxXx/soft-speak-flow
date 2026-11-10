import { differenceInCalendarDays, getDay, isValid, lastDayOfMonth, parseISO, startOfDay } from "date-fns";
import { getClampedMonthDays } from "@/utils/habitSchedule";

export interface QuestRecurrenceRule {
  task_date?: string | null;
  created_at?: string | null;
  recurrence_pattern?: string | null;
  recurrence_days?: number[] | null;
  recurrence_month_days?: number[] | null;
  recurrence_custom_period?: "week" | "month" | null;
}

/**
 * Determine if a recurring task should spawn today based on its pattern.
 */
export function shouldSpawnToday(
  template: QuestRecurrenceRule,
  appDayOfWeek: number,
  targetDateInput: Date = new Date(),
): boolean {
  const pattern = template.recurrence_pattern?.toLowerCase();
  const targetDate = startOfDay(targetDateInput);
  const anchorDate = getAnchorDate(template);

  if (!pattern || (anchorDate && targetDate < anchorDate)) return false;

  switch (pattern) {
    case "daily":
      return true;

    case "weekly":
      if (template.recurrence_days && template.recurrence_days.length > 0) {
        return template.recurrence_days.includes(appDayOfWeek);
      }
      return anchorDate ? toAppDayIndex(getDay(anchorDate)) === appDayOfWeek : true;

    case "weekdays":
      return appDayOfWeek >= 0 && appDayOfWeek <= 4;

    case "weekends":
      return appDayOfWeek === 5 || appDayOfWeek === 6;

    case "biweekly": {
      const recurrenceDay = template.recurrence_days?.[0] ?? (anchorDate ? toAppDayIndex(getDay(anchorDate)) : appDayOfWeek);
      if (recurrenceDay !== appDayOfWeek) return false;
      if (!anchorDate) return false;

      const diffDays = differenceInCalendarDays(targetDate, anchorDate);
      return diffDays >= 0 && diffDays % 14 === 0;
    }

    case "monthly": {
      const configuredMonthDays = getClampedMonthDays(template.recurrence_month_days, targetDate);
      if (configuredMonthDays.length > 0) {
        return configuredMonthDays.includes(targetDate.getDate());
      }

      if (!anchorDate) return false;
      const desiredDayOfMonth = anchorDate.getDate();
      const runDayOfMonth = Math.min(desiredDayOfMonth, lastDayOfMonth(targetDate).getDate());
      return targetDate.getDate() === runDayOfMonth;
    }

    case "custom": {
      const customPeriod = template.recurrence_custom_period ?? "week";
      if (customPeriod === "month") {
        const configuredMonthDays = getClampedMonthDays(template.recurrence_month_days, targetDate);
        if (configuredMonthDays.length > 0) {
          return configuredMonthDays.includes(targetDate.getDate());
        }
        if (!anchorDate) return false;
        const fallbackDay = Math.min(anchorDate.getDate(), lastDayOfMonth(targetDate).getDate());
        return targetDate.getDate() === fallbackDay;
      }

      if (template.recurrence_days && template.recurrence_days.length > 0) {
        return template.recurrence_days.includes(appDayOfWeek);
      }
      return false;
    }

    default:
      if (pattern.includes("daily") || pattern.includes("day")) {
        return true;
      }
      return false;
  }
}

function getAnchorDate(template: QuestRecurrenceRule): Date | null {
  if (template.task_date) {
    const parsedTaskDate = parseISO(template.task_date);
    if (isValid(parsedTaskDate)) return startOfDay(parsedTaskDate);
  }

  if (template.created_at) {
    const parsedCreatedAt = parseISO(template.created_at);
    if (isValid(parsedCreatedAt)) return startOfDay(parsedCreatedAt);
  }

  return null;
}

export function toAppDayIndex(jsDay: number): number {
  return jsDay === 0 ? 6 : jsDay - 1;
}
