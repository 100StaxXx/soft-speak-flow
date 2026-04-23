import type { Quest, Subtask } from "@/types/domain";
import type { TaskAttachment } from "@/types/questAttachments";

export type DisplayQuestSubtask = Pick<Subtask, "id" | "title" | "completed" | "sortOrder">;

export interface DisplayQuest extends Pick<
  Quest,
  | "id"
  | "title"
  | "completed"
  | "xpReward"
  | "scheduledTime"
  | "estimatedDuration"
  | "isMainQuest"
  | "habitSourceId"
  | "notes"
  | "priority"
  | "difficulty"
  | "category"
  | "isRecurring"
  | "recurrencePattern"
  | "imageUrl"
  | "attachments"
  | "location"
> {
  subtasks: DisplayQuestSubtask[];
}

export interface CalendarQuest extends DisplayQuest {
  taskDate: string;
}

type LegacyDisplayQuestSource = {
  id: string;
  task_text?: string | null;
  completed?: boolean | null;
  xp_reward?: number | null;
  scheduled_time?: string | null;
  estimated_duration?: number | null;
  is_main_quest?: boolean | null;
  habit_source_id?: string | null;
  notes?: string | null;
  priority?: string | null;
  difficulty?: string | null;
  category?: string | null;
  is_recurring?: boolean | null;
  recurrence_pattern?: string | null;
  image_url?: string | null;
  attachments?: TaskAttachment[] | null;
  subtasks?: Array<{
    id: string;
    title?: string | null;
    completed?: boolean | null;
    sort_order?: number | null;
  }> | null;
  location?: string | null;
};

type LegacyCalendarQuestSource = LegacyDisplayQuestSource & {
  task_date: string;
};

export const toDisplayQuestFromLegacyTask = (
  task: LegacyDisplayQuestSource,
): DisplayQuest => ({
  id: task.id,
  title: task.task_text ?? "",
  completed: !!task.completed,
  xpReward: task.xp_reward ?? 0,
  scheduledTime: task.scheduled_time ?? null,
  estimatedDuration: task.estimated_duration ?? null,
  isMainQuest: !!task.is_main_quest,
  habitSourceId: task.habit_source_id ?? null,
  notes: task.notes ?? null,
  priority: task.priority ?? null,
  difficulty: task.difficulty ?? null,
  category: task.category ?? null,
  isRecurring: !!task.is_recurring,
  recurrencePattern: task.recurrence_pattern ?? null,
  imageUrl: task.image_url ?? null,
  attachments: task.attachments ?? [],
  subtasks: (task.subtasks ?? [])
    .slice()
    .sort((left, right) => (
      (left.sort_order ?? Number.MAX_SAFE_INTEGER)
      - (right.sort_order ?? Number.MAX_SAFE_INTEGER)
    ))
    .map((subtask) => ({
      id: subtask.id,
      title: subtask.title ?? "",
      completed: !!subtask.completed,
      sortOrder: subtask.sort_order ?? null,
    })),
  location: task.location ?? null,
});

export const toCalendarQuestFromLegacyTask = (
  task: LegacyCalendarQuestSource,
): CalendarQuest => ({
  ...toDisplayQuestFromLegacyTask(task),
  taskDate: task.task_date,
});
