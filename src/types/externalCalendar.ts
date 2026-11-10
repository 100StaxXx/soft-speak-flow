import type { CalendarTask } from "@/types/quest";

export type ExternalCalendarProvider = "google" | "outlook" | "apple";

export interface RawExternalCalendarEvent {
  connectionId?: unknown;
  notes?: unknown;
  meetingUrl?: unknown;
  isRecurring?: unknown;
  availability?: unknown;
  id?: unknown;
  title?: unknown;
  startDate?: unknown;
  endDate?: unknown;
  isAllDay?: unknown;
  location?: unknown;
  calendarId?: unknown;
  calendarName?: unknown;
  htmlLink?: unknown;
}

export interface ExternalCalendarEvent {
  connectionId?: string | null;
  notes?: string | null;
  meetingUrl?: string | null;
  isRecurring?: boolean;
  availability?: string | null;
  id: string;
  provider: ExternalCalendarProvider;
  title: string;
  taskDate: string;
  scheduledTime: string | null;
  estimatedDuration: number;
  isAllDay: boolean;
  startDate: string;
  endDate: string;
  location: string | null;
  calendarId: string | null;
  calendarName: string;
  htmlLink: string | null;
}

const readString = (value: unknown): string | null =>
  typeof value === "string" && value.trim().length > 0 ? value.trim() : null;

const readExternalUrl = (value: unknown): string | null => {
  const candidate = readString(value);
  if (!candidate) return null;

  try {
    const url = new URL(candidate);
    return url.protocol === "https:" || url.protocol === "http:" ? url.toString() : null;
  } catch {
    return null;
  }
};

const localDateKey = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const localTimeKey = (date: Date): string =>
  `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;

export const externalCalendarEventKey = (
  event: Pick<ExternalCalendarEvent, "provider" | "id"> & Partial<Pick<ExternalCalendarEvent, "connectionId" | "calendarId">>,
): string => [event.provider, event.connectionId ?? "", event.calendarId ?? "", event.id].map(encodeURIComponent).join(":");

export function normalizeExternalCalendarEvent(
  raw: RawExternalCalendarEvent,
  provider: ExternalCalendarProvider,
  fallbackCalendarName: string,
): ExternalCalendarEvent | null {
  const id = readString(raw.id);
  const rawStartDate = readString(raw.startDate);
  const rawEndDate = readString(raw.endDate);
  if (!id || !rawStartDate || !rawEndDate) return null;

  const isAllDay = raw.isAllDay === true;
  const title = readString(raw.title) ?? "Busy";
  const calendarName = readString(raw.calendarName) ?? fallbackCalendarName;
  const details = {
    connectionId: readString(raw.connectionId), notes: readString(raw.notes),
    meetingUrl: readExternalUrl(raw.meetingUrl), isRecurring: raw.isRecurring === true,
    availability: readString(raw.availability),
  };

  if (isAllDay) {
    const taskDate = rawStartDate.slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(taskDate)) return null;

    return {
      ...details,
      id,
      provider,
      title,
      taskDate,
      scheduledTime: null,
      estimatedDuration: 1440,
      isAllDay: true,
      startDate: rawStartDate,
      endDate: rawEndDate,
      location: readString(raw.location),
      calendarId: readString(raw.calendarId),
      calendarName,
      htmlLink: readExternalUrl(raw.htmlLink),
    };
  }

  const start = new Date(rawStartDate);
  const end = new Date(rawEndDate);
  if (
    Number.isNaN(start.getTime())
    || Number.isNaN(end.getTime())
    || end.getTime() <= start.getTime()
  ) return null;

  return {
    ...details,
    id,
    provider,
    title,
    taskDate: localDateKey(start),
    scheduledTime: localTimeKey(start),
    estimatedDuration: Math.max(1, Math.round((end.getTime() - start.getTime()) / 60_000)),
    isAllDay: false,
    startDate: start.toISOString(),
    endDate: end.toISOString(),
    location: readString(raw.location),
    calendarId: readString(raw.calendarId),
    calendarName,
    htmlLink: readExternalUrl(raw.htmlLink),
  };
}

/** Intersect the source interval with a local day, including exclusive all-day ends.
 * Never change the source ID: conversion and synchronization must address the original event.
 */
export function externalEventsForDay(events: ExternalCalendarEvent[], date: Date): ExternalCalendarEvent[] {
  const day = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const next = new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1);
  const key = localDateKey(day);
  return events.flatMap((event) => {
    if (event.isAllDay) {
      return key >= event.startDate.slice(0, 10) && key < event.endDate.slice(0, 10)
        ? [{ ...event, taskDate: key }] : [];
    }
    const start = Math.max(Date.parse(event.startDate), day.getTime());
    const end = Math.min(Date.parse(event.endDate), next.getTime());
    return end > start ? [{ ...event, taskDate: key, scheduledTime: localTimeKey(new Date(start)),
      estimatedDuration: Math.round((end - start) / 60000) }] : [];
  });
}

export function findEventConflicts(event: ExternalCalendarEvent, events: ExternalCalendarEvent[]): ExternalCalendarEvent[] {
  if (event.isAllDay || event.availability === "free") return [];
  return events.filter((other) => externalCalendarEventKey(other) !== externalCalendarEventKey(event)
    && !other.isAllDay && other.availability !== "free"
    && Date.parse(other.startDate) < Date.parse(event.endDate)
    && Date.parse(other.endDate) > Date.parse(event.startDate));
}

export function dedupeExternalCalendarEvents(
  events: ExternalCalendarEvent[],
): ExternalCalendarEvent[] {
  const byKey = new Map<string, ExternalCalendarEvent>();
  for (const event of events) {
    byKey.set(externalCalendarEventKey(event), event);
  }

  return Array.from(byKey.values()).sort((left, right) => {
    const dateCompare = left.taskDate.localeCompare(right.taskDate);
    if (dateCompare !== 0) return dateCompare;
    return (left.scheduledTime ?? "00:00").localeCompare(right.scheduledTime ?? "00:00");
  });
}

export function externalCalendarEventToCalendarTask(
  event: ExternalCalendarEvent,
): CalendarTask {
  return {
    id: `external:${externalCalendarEventKey(event)}`,
    task_text: event.title,
    task_date: event.taskDate,
    scheduled_time: event.scheduledTime,
    estimated_duration: event.estimatedDuration,
    completed: false,
    is_main_quest: false,
    difficulty: null,
    xp_reward: 0,
    source: "external_calendar",
  };
}
