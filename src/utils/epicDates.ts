import { addDays, differenceInCalendarDays, format, isValid, parseISO, startOfDay } from "date-fns";

const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export interface EpicDateInput {
  start_date?: string | null;
  target_days?: number | null;
  end_date?: string | null;
}

const parseDateOnly = (value: string | null | undefined) => {
  if (typeof value !== "string" || !DATE_ONLY_PATTERN.test(value)) {
    return null;
  }

  const parsed = parseISO(value);
  return isValid(parsed) ? parsed : null;
};

const toTargetDays = (value: number | null | undefined) => {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return null;
  }

  return Math.max(0, Math.round(value));
};

export const resolveEpicEndDate = ({ start_date, target_days, end_date }: EpicDateInput): string | null => {
  const parsedEndDate = parseDateOnly(end_date);
  if (parsedEndDate) {
    return format(parsedEndDate, "yyyy-MM-dd");
  }

  const parsedStartDate = parseDateOnly(start_date);
  const normalizedTargetDays = toTargetDays(target_days);

  if (!parsedStartDate || normalizedTargetDays === null) {
    return null;
  }

  return format(addDays(parsedStartDate, normalizedTargetDays), "yyyy-MM-dd");
};

export const getEpicDaysRemaining = (
  epicOrEndDate: EpicDateInput | string | null | undefined,
  now: Date = new Date(),
) => {
  const resolvedEndDate = typeof epicOrEndDate === "string"
    ? resolveEpicEndDate({ end_date: epicOrEndDate })
    : resolveEpicEndDate(epicOrEndDate ?? {});

  if (!resolvedEndDate) {
    return null;
  }

  const parsedEndDate = parseISO(resolvedEndDate);
  if (!isValid(parsedEndDate)) {
    return null;
  }

  return Math.max(0, differenceInCalendarDays(parsedEndDate, startOfDay(now)));
};
