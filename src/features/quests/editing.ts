import type { UpdateQuestInput } from "@/hooks/useQuestMutations";
import type { QuestAttachmentInput, TaskAttachment } from "@/types/questAttachments";

export interface EditableQuest {
  id: string;
  title: string;
  taskDate: string | null;
  difficulty: string | null;
  scheduledTime: string | null;
  estimatedDuration: number | null;
  recurrencePattern: string | null;
  recurrenceDays: number[];
  recurrenceMonthDays: number[];
  recurrenceCustomPeriod: "week" | "month" | null;
  reminderEnabled: boolean;
  reminderMinutesBefore: number;
  category: string | null;
  notes: string | null;
  habitSourceId: string | null;
  imageUrl: string | null;
  attachments: TaskAttachment[];
  location: string | null;
}

export interface InboxQuest extends EditableQuest {
  completed: boolean;
}

export interface QuestUpdateDraft {
  title: string;
  taskDate: string | null;
  difficulty: string;
  scheduledTime: string | null;
  estimatedDuration: number | null;
  recurrencePattern: string | null;
  recurrenceDays: number[];
  recurrenceMonthDays: number[];
  recurrenceCustomPeriod: "week" | "month" | null;
  reminderEnabled: boolean;
  reminderMinutesBefore: number;
  notes: string | null;
  category: string | null;
  imageUrl: string | null;
  location: string | null;
  attachments?: QuestAttachmentInput[];
  subtasks?: string[];
}

type LegacyEditableQuestSource = {
  id: string;
  task_text?: string | null;
  task_date?: string | null;
  difficulty?: string | null;
  scheduled_time?: string | null;
  estimated_duration?: number | null;
  recurrence_pattern?: string | null;
  recurrence_days?: unknown;
  recurrence_month_days?: unknown;
  recurrence_custom_period?: unknown;
  reminder_enabled?: unknown;
  reminder_minutes_before?: number | null;
  category?: string | null;
  notes?: string | null;
  habit_source_id?: string | null;
  image_url?: string | null;
  attachments?: unknown;
  location?: string | null;
};

export const toEditableQuestFromLegacyTask = (
  task: LegacyEditableQuestSource,
): EditableQuest => ({
  id: task.id,
  title: task.task_text ?? "",
  taskDate: task.task_date ?? null,
  difficulty: task.difficulty ?? "medium",
  scheduledTime: task.scheduled_time ?? null,
  estimatedDuration: task.estimated_duration ?? 30,
  recurrencePattern: task.recurrence_pattern ?? null,
  recurrenceDays: Array.isArray(task.recurrence_days) ? task.recurrence_days as number[] : [],
  recurrenceMonthDays: Array.isArray(task.recurrence_month_days) ? task.recurrence_month_days as number[] : [],
  recurrenceCustomPeriod:
    task.recurrence_custom_period === "week" || task.recurrence_custom_period === "month"
      ? task.recurrence_custom_period
      : null,
  reminderEnabled: typeof task.reminder_enabled === "boolean" ? task.reminder_enabled : false,
  reminderMinutesBefore: task.reminder_minutes_before ?? 15,
  category: task.category ?? null,
  notes: task.notes ?? null,
  habitSourceId: task.habit_source_id ?? null,
  imageUrl: task.image_url ?? null,
  attachments: Array.isArray(task.attachments) ? task.attachments as TaskAttachment[] : [],
  location: task.location ?? null,
});

export const toInboxQuestFromLegacyTask = (
  task: LegacyEditableQuestSource & { completed?: boolean | null },
): InboxQuest => ({
  ...toEditableQuestFromLegacyTask(task),
  completed: !!task.completed,
});

export const toLegacyQuestUpdateInput = (
  draft: QuestUpdateDraft,
): UpdateQuestInput => ({
  task_text: draft.title,
  task_date: draft.taskDate,
  difficulty: draft.difficulty,
  scheduled_time: draft.scheduledTime,
  estimated_duration: draft.estimatedDuration,
  recurrence_pattern: draft.recurrencePattern,
  recurrence_days: draft.recurrenceDays,
  recurrence_month_days: draft.recurrenceMonthDays,
  recurrence_custom_period: draft.recurrenceCustomPeriod,
  reminder_enabled: draft.reminderEnabled,
  reminder_minutes_before: draft.reminderMinutesBefore,
  notes: draft.notes,
  category: draft.category,
  image_url: draft.imageUrl,
  location: draft.location,
  attachments: draft.attachments,
});
