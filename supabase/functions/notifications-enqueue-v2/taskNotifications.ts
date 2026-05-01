import {
  type NotificationType,
  toScheduledDateTime,
} from "../_shared/notificationsV2.ts";

export interface TaskCandidateRow {
  id: string;
  user_id: string;
  task_text: string;
  xp_reward: number | null;
  task_date: string;
  scheduled_time: string;
  start_notification_sent: boolean | null;
  reminder_enabled: boolean | null;
  reminder_sent: boolean | null;
  reminder_minutes_before: number | null;
  reminder_offsets_minutes?: number[] | null;
  reminder_sent_offsets_minutes?: number[] | null;
  completed: boolean | null;
}

export interface TaskProfileRow {
  id: string;
  timezone: string | null;
  task_reminders_enabled: boolean | null;
}

export interface TaskNotificationCandidate {
  userId: string;
  type: Extract<NotificationType, "task_start" | "task_reminder">;
  sourceId: string;
  dedupeKey: string;
  scheduledFor: string;
  payload: Record<string, unknown>;
}

export const MAX_TASK_REMINDER_MINUTES = 10080;
const TASK_REMINDER_SCAN_PAST_DAYS = 1;
const TASK_REMINDER_SCAN_TIMEZONE_BUFFER_DAYS = 1;
const DAY_MS = 24 * 60 * 60_000;

function toIsoDateAtDayOffset(now: Date, days: number): string {
  return new Date(now.getTime() + days * DAY_MS).toISOString().slice(0, 10);
}

export function buildTaskNotificationScanDateRange(now: Date): {
  startDateIso: string;
  endDateIso: string;
} {
  const reminderLookaheadDays = Math.ceil(MAX_TASK_REMINDER_MINUTES / 1440);

  return {
    startDateIso: toIsoDateAtDayOffset(now, -TASK_REMINDER_SCAN_PAST_DAYS),
    endDateIso: toIsoDateAtDayOffset(now, reminderLookaheadDays + TASK_REMINDER_SCAN_TIMEZONE_BUFFER_DAYS),
  };
}

function normalizeReminderOffsets(values: readonly unknown[] | null | undefined): number[] {
  if (!Array.isArray(values)) return [];

  return Array.from(
    new Set(
      values
        .map((value) => {
          if (typeof value !== "number" || !Number.isFinite(value)) return null;
          const minutes = Math.trunc(value);
          return minutes >= 1 && minutes <= MAX_TASK_REMINDER_MINUTES ? minutes : null;
        })
        .filter((value): value is number => value !== null),
    ),
  ).sort((a, b) => a - b);
}

function resolveReminderOffsets(task: TaskCandidateRow): number[] {
  const explicitOffsets = normalizeReminderOffsets(task.reminder_offsets_minutes);
  if (explicitOffsets.length > 0) return explicitOffsets;

  if (!task.reminder_enabled) return [];

  const legacyMinutes = typeof task.reminder_minutes_before === "number" && Number.isFinite(task.reminder_minutes_before) && task.reminder_minutes_before > 0
    ? Math.trunc(task.reminder_minutes_before)
    : 15;

  return normalizeReminderOffsets([legacyMinutes]);
}

function resolveSentReminderOffsets(task: TaskCandidateRow, reminderOffsets: number[]): number[] {
  const sentOffsets = normalizeReminderOffsets(task.reminder_sent_offsets_minutes);
  if (sentOffsets.length > 0) return sentOffsets;
  return task.reminder_sent ? reminderOffsets : [];
}

export function buildTaskNotificationCandidates(input: {
  tasks: readonly TaskCandidateRow[];
  profilesByUser: ReadonlyMap<string, TaskProfileRow>;
  now: Date;
}): TaskNotificationCandidate[] {
  const rows: TaskNotificationCandidate[] = [];

  for (const task of input.tasks) {
    if (task.completed) continue;

    const profile = input.profilesByUser.get(task.user_id);
    const timezone = profile?.timezone ?? "UTC";
    const scheduledAt = toScheduledDateTime(task.task_date, task.scheduled_time, timezone);
    if (!scheduledAt) continue;

    const remindersEnabled = profile?.task_reminders_enabled !== false;

    if (scheduledAt <= input.now && !task.start_notification_sent && remindersEnabled) {
      rows.push({
        userId: task.user_id,
        type: "task_start",
        sourceId: task.id,
        dedupeKey: `task_start:${task.id}`,
        scheduledFor: scheduledAt.toISOString(),
        payload: {
          task_id: task.id,
          task_text: task.task_text,
          xp_reward: task.xp_reward,
          type: "task_start",
          url: "/tasks",
        },
      });
    }

    if (task.reminder_enabled && remindersEnabled) {
      const reminderOffsets = resolveReminderOffsets(task);
      const sentReminderOffsets = new Set(resolveSentReminderOffsets(task, reminderOffsets));

      for (const minutesBefore of reminderOffsets) {
        if (sentReminderOffsets.has(minutesBefore)) continue;

        const reminderAt = new Date(scheduledAt.getTime() - minutesBefore * 60_000);

        if (reminderAt <= input.now) {
          rows.push({
            userId: task.user_id,
            type: "task_reminder",
            sourceId: task.id,
            dedupeKey: `task_reminder:${task.id}:${minutesBefore}`,
            scheduledFor: reminderAt.toISOString(),
            payload: {
              task_id: task.id,
              task_text: task.task_text,
              xp_reward: task.xp_reward,
              reminder_minutes_before: minutesBefore,
              reminder_offset_minutes: minutesBefore,
              type: "task_reminder",
              url: "/tasks",
            },
          });
        }
      }
    }
  }

  return rows;
}
