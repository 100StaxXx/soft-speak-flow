import { isBefore, isSameDay, startOfDay } from "date-fns";

export const JOURNEYS_ROUTE = "/journeys";

export const getTodayIfDateStale = (selectedDate: Date, now = new Date()): Date => {
  if (isSameDay(selectedDate, now)) return selectedDate;

  const selectedDay = startOfDay(selectedDate);
  const today = startOfDay(now);

  return isBefore(selectedDay, today) ? now : selectedDate;
};
