import { isSameDay } from "date-fns";

export const JOURNEYS_ROUTE = "/journeys";

export const shouldResetJourneysDate = (previousPath: string | null, nextPath: string): boolean =>
  previousPath !== JOURNEYS_ROUTE && nextPath === JOURNEYS_ROUTE;

export const getTodayIfDateStale = (selectedDate: Date, now = new Date()): Date =>
  isSameDay(selectedDate, now) ? selectedDate : now;
