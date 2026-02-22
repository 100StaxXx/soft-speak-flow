import { isSameDay } from "date-fns";

export const JOURNEYS_ROUTE = "/journeys";

export const getTodayIfDateStale = (selectedDate: Date, now = new Date()): Date =>
  isSameDay(selectedDate, now) ? selectedDate : now;
