import { addMinutes, endOfDay, format } from "date-fns";

import type { Tables } from "@/integrations/supabase/types";
import type { DailyTask } from "@/services/dailyTasksRemote";
import type { CalendarItem } from "@/types/domain";
import { parseScheduledTime } from "@/utils/scheduledTime";

type ExternalCalendarEventRow = Tables<"external_calendar_events">;

export interface CalendarItemQuestLink {
  connection_id: string;
  external_event_id: string;
  provider: string;
  sync_mode: string;
}

export interface CalendarItemQuestOutlookLink {
  connection_id: string;
  external_task_id: string;
  provider: string;
  sync_mode: string;
}

const formatLocalDateTime = (value: Date) =>
  format(value, "yyyy-MM-dd'T'HH:mm:ss");

const buildQuestWindow = (
  task: Pick<DailyTask, "task_date" | "scheduled_time" | "estimated_duration">,
) => {
  if (!task.task_date) return null;

  const baseDate = new Date(`${task.task_date}T00:00:00`);
  const scheduledStart = parseScheduledTime(task.scheduled_time, baseDate);

  if (!scheduledStart) {
    return {
      startsAt: formatLocalDateTime(baseDate),
      endsAt: formatLocalDateTime(endOfDay(baseDate)),
      isAllDay: true,
    };
  }

  const durationMinutes = task.estimated_duration && task.estimated_duration > 0
    ? task.estimated_duration
    : 30;
  const scheduledEnd = addMinutes(scheduledStart, durationMinutes);

  return {
    startsAt: formatLocalDateTime(scheduledStart),
    endsAt: formatLocalDateTime(scheduledEnd),
    isAllDay: false,
  };
};

export const toCalendarItemFromExternalEvent = (
  event: ExternalCalendarEventRow,
): CalendarItem => ({
  id: `external:${event.id}`,
  source: "external_event",
  title: event.title,
  startsAt: event.start_time,
  endsAt: event.end_time,
  isAllDay: Boolean(event.is_all_day),
  provider: event.source,
  readOnly: true,
  questId: null,
  syncMode: null,
  sourceTable: "external_calendar_events",
  externalEventId: event.external_event_id,
  connectionId: event.connection_id,
  taskDate: null,
  scheduledTime: null,
  estimatedDuration: null,
});

export const toCalendarItemFromQuest = (
  task: DailyTask,
  options: {
    calendarLinks?: CalendarItemQuestLink[] | null;
    outlookTaskLinks?: CalendarItemQuestOutlookLink[] | null;
  } = {},
): CalendarItem | null => {
  const window = buildQuestWindow(task);
  if (!window) return null;

  const calendarLink = options.calendarLinks?.[0] ?? null;
  const outlookTaskLink = options.outlookTaskLinks?.[0] ?? null;

  return {
    id: `quest:${task.id}`,
    source: "quest",
    title: task.task_text,
    startsAt: window.startsAt,
    endsAt: window.endsAt,
    isAllDay: window.isAllDay,
    provider: calendarLink?.provider ?? outlookTaskLink?.provider ?? null,
    readOnly: false,
    questId: task.id,
    syncMode: calendarLink?.sync_mode ?? outlookTaskLink?.sync_mode ?? null,
    sourceTable: "daily_tasks",
    externalEventId: calendarLink?.external_event_id ?? outlookTaskLink?.external_task_id ?? null,
    connectionId: calendarLink?.connection_id ?? outlookTaskLink?.connection_id ?? null,
    taskDate: task.task_date,
    scheduledTime: task.scheduled_time ?? null,
    estimatedDuration: task.estimated_duration ?? null,
  };
};
