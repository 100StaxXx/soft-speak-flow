import type { DailySubtask, DailyTask } from "@/services/dailyTasksRemote";
import type { Quest, Subtask } from "@/types/domain";

type DailySubtaskLike = DailySubtask & Record<string, unknown>;

const readString = (value: unknown): string | null =>
  typeof value === "string" ? value : null;

const isRowBackedSubtask = (value: unknown): value is DailySubtaskLike => (
  typeof value === "object"
  && value !== null
  && typeof (value as { id?: unknown }).id === "string"
  && typeof (value as { title?: unknown }).title === "string"
);

export const toSubtask = (
  subtask: DailySubtask,
  questId: string,
): Subtask => {
  const row = subtask as DailySubtaskLike;

  return {
    id: subtask.id,
    questId,
    title: subtask.title,
    completed: Boolean(subtask.completed),
    completedAt: readString(row.completed_at),
    sortOrder: subtask.sort_order ?? null,
    createdAt: readString(row.created_at),
  };
};

const toQuestSubtasks = (task: DailyTask): Subtask[] => {
  // Template-local `subtasks: string[]` drafts intentionally stay outside the
  // canonical Subtask boundary in this phase. Only row-backed subtask objects
  // from the `subtasks` table become Subtask DTOs.
  const rowBackedSubtasks = (task.subtasks ?? []).filter(isRowBackedSubtask);

  return rowBackedSubtasks
    .slice()
    .sort((left, right) => (
      (left.sort_order ?? Number.MAX_SAFE_INTEGER)
      - (right.sort_order ?? Number.MAX_SAFE_INTEGER)
    ))
    .map((subtask) => toSubtask(subtask, task.id));
};

export const toQuest = (task: DailyTask): Quest => ({
  id: task.id,
  userId: task.user_id,
  title: task.task_text,
  xpReward: task.xp_reward,
  taskDate: task.task_date ?? null,
  scheduledTime: task.scheduled_time ?? null,
  estimatedDuration: task.estimated_duration ?? null,
  completed: Boolean(task.completed),
  completedAt: task.completed_at ?? null,
  priority: task.priority ?? null,
  difficulty: task.difficulty ?? null,
  campaignId: task.epic_id ?? null,
  campaignTitle: task.epic_title ?? null,
  habitSourceId: task.habit_source_id ?? null,
  isMainQuest: Boolean(task.is_main_quest),
  isRecurring: Boolean(task.is_recurring),
  reminderEnabled: Boolean(task.reminder_enabled),
  reminderMinutesBefore: task.reminder_minutes_before ?? null,
  aiGenerated: Boolean(task.ai_generated),
  notes: task.notes ?? null,
  location: task.location ?? null,
  source: task.source ?? null,
  category: task.category ?? null,
  imageUrl: task.image_url ?? null,
  contactId: task.contact_id ?? null,
  autoLogInteraction: Boolean(task.auto_log_interaction),
  sortOrder: task.sort_order ?? null,
  recurrencePattern: task.recurrence_pattern ?? null,
  recurrenceDays: task.recurrence_days ?? [],
  recurrenceMonthDays: task.recurrence_month_days ?? [],
  recurrenceCustomPeriod: task.recurrence_custom_period ?? null,
  recurrenceEndDate: task.recurrence_end_date ?? null,
  subtasks: toQuestSubtasks(task),
  attachments: task.attachments ?? [],
});
