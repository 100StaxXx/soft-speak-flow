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

function resolveReminderMinutesBefore(value: number | null | undefined): number {
  return typeof value === "number" && Number.isFinite(value) && value > 0
    ? Math.trunc(value)
    : 15;
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

    if (task.reminder_enabled && !task.reminder_sent && remindersEnabled) {
      const minutesBefore = resolveReminderMinutesBefore(task.reminder_minutes_before);
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
            type: "task_reminder",
            url: "/tasks",
          },
        });
      }
    }
  }

  return rows;
}
