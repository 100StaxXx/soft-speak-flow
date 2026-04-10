import { addDays, format, getDay, parseISO } from "date-fns";

import { getHabitXP } from "@/config/xpRewards";
import type { DailyTask } from "@/services/dailyTasksRemote";
import { categorizeQuest } from "@/utils/questCategorization";
import {
  createOfflinePlannerId,
  getAllLocalTasksForUser,
} from "@/utils/plannerLocalStore";
import { loadLocalEpics } from "@/utils/plannerSync";
import {
  inferCustomPeriod,
  isHabitScheduledForDate,
  type HabitCustomPeriod,
} from "@/utils/habitSchedule";
import { getEffectiveMissionDate } from "@/utils/timezone";

export const RITUAL_RECONCILIATION_WINDOW_DAYS = 30;

type TaskDifficulty = "easy" | "medium" | "hard";

interface LinkedEpic {
  id: string;
  title: string | null;
}

export interface NormalizedRitualSchedule {
  frequency: string;
  custom_days: number[] | null;
  custom_month_days: number[] | null;
  customPeriod: HabitCustomPeriod;
}

export interface HabitTaskTemplate {
  habitId: string;
  userId: string;
  title: string;
  difficulty: string | null;
  estimated_minutes: number | null;
  preferred_time: string | null;
  category: string | null;
  reminder_enabled: boolean | null;
  reminder_minutes_before: number | null;
  frequency: string;
  custom_days: number[] | null;
  custom_month_days: number[] | null;
  customPeriod?: HabitCustomPeriod | null;
}

export interface HabitTaskReconciliationResult {
  createdTasks: DailyTask[];
  updatedTasks: Array<{
    existingTask: DailyTask;
    nextTask: DailyTask;
    updates: Record<string, unknown>;
  }>;
  deletedTasks: DailyTask[];
  touchedDates: string[];
}

function normalizeNumberList(values: number[] | null | undefined): number[] {
  if (!values || values.length === 0) return [];
  return [...new Set(values)].sort((a, b) => a - b);
}

function normalizeTaskDifficulty(value: string | null | undefined): TaskDifficulty {
  const normalized = value?.toLowerCase()?.trim();
  if (normalized === "easy" || normalized === "hard") return normalized;
  return "medium";
}

function toPlannerWeekday(targetDate: Date): number {
  const jsDay = getDay(targetDate);
  return jsDay === 0 ? 6 : jsDay - 1;
}

function buildTouchedDates(result: HabitTaskReconciliationResult): string[] {
  const dates = new Set<string>();

  result.createdTasks.forEach((task) => {
    if (task.task_date) dates.add(task.task_date);
  });
  result.updatedTasks.forEach(({ nextTask }) => {
    if (nextTask.task_date) dates.add(nextTask.task_date);
  });
  result.deletedTasks.forEach((task) => {
    if (task.task_date) dates.add(task.task_date);
  });

  return [...dates].sort();
}

function getNextSortOrderForDate(taskDate: string, tasks: DailyTask[]): number {
  const maxSort = tasks
    .filter((task) => task.task_date === taskDate)
    .reduce((highest, task) => {
      const sortOrder = task.sort_order ?? -1;
      return sortOrder > highest ? sortOrder : highest;
    }, -1);

  return maxSort + 1;
}

async function resolveLinkedEpic(userId: string, habitId: string): Promise<LinkedEpic | null> {
  const epics = await loadLocalEpics(userId);

  for (const epic of epics) {
    if (epic.status !== "active") continue;
    if (!(epic.epic_habits ?? []).some((link) => link.habit_id === habitId)) continue;

    return {
      id: epic.id,
      title: typeof epic.title === "string" ? epic.title : null,
    };
  }

  return null;
}

function buildTaskMetadata(template: HabitTaskTemplate, linkedEpic: LinkedEpic | null) {
  const difficulty = normalizeTaskDifficulty(template.difficulty);

  return {
    task_text: template.title.trim(),
    difficulty,
    xp_reward: getHabitXP(difficulty),
    scheduled_time: template.preferred_time ?? null,
    estimated_duration: template.estimated_minutes ?? null,
    category: template.category ?? categorizeQuest(template.title),
    reminder_enabled: template.reminder_enabled ?? false,
    reminder_minutes_before: template.reminder_minutes_before ?? 15,
    habit_source_id: template.habitId,
    epic_id: linkedEpic?.id ?? null,
    epic_title: linkedEpic?.title ?? null,
  };
}

function buildTaskUpdatePayload(
  existingTask: DailyTask,
  nextTask: DailyTask,
): Record<string, unknown> {
  const updates: Record<string, unknown> = {};

  if (existingTask.task_text !== nextTask.task_text) updates.task_text = nextTask.task_text;
  if (existingTask.difficulty !== nextTask.difficulty) updates.difficulty = nextTask.difficulty;
  if (existingTask.xp_reward !== nextTask.xp_reward) updates.xp_reward = nextTask.xp_reward;
  if (existingTask.scheduled_time !== nextTask.scheduled_time) updates.scheduled_time = nextTask.scheduled_time;
  if (existingTask.estimated_duration !== nextTask.estimated_duration) {
    updates.estimated_duration = nextTask.estimated_duration;
  }
  if (existingTask.category !== nextTask.category) updates.category = nextTask.category;
  if (existingTask.reminder_enabled !== nextTask.reminder_enabled) {
    updates.reminder_enabled = nextTask.reminder_enabled;
  }
  if (existingTask.reminder_minutes_before !== nextTask.reminder_minutes_before) {
    updates.reminder_minutes_before = nextTask.reminder_minutes_before;
  }
  if (existingTask.epic_id !== nextTask.epic_id) updates.epic_id = nextTask.epic_id;

  return updates;
}

function buildNewHabitTask(
  template: HabitTaskTemplate,
  taskDate: string,
  linkedEpic: LinkedEpic | null,
  allTasks: DailyTask[],
): DailyTask {
  const metadata = buildTaskMetadata(template, linkedEpic);

  return {
    id: createOfflinePlannerId("task"),
    user_id: template.userId,
    task_text: metadata.task_text,
    difficulty: metadata.difficulty,
    xp_reward: metadata.xp_reward,
    task_date: taskDate,
    completed: false,
    completed_at: null,
    is_main_quest: false,
    scheduled_time: metadata.scheduled_time,
    estimated_duration: metadata.estimated_duration,
    recurrence_pattern: null,
    recurrence_days: null,
    recurrence_month_days: null,
    recurrence_custom_period: null,
    recurrence_end_date: null,
    is_recurring: false,
    reminder_enabled: metadata.reminder_enabled,
    reminder_minutes_before: metadata.reminder_minutes_before,
    reminder_sent: false,
    parent_template_id: null,
    category: metadata.category,
    is_bonus: false,
    created_at: new Date().toISOString(),
    priority: null,
    is_top_three: null,
    actual_time_spent: null,
    ai_generated: null,
    context_id: null,
    source: "recurring",
    habit_source_id: template.habitId,
    epic_id: metadata.epic_id,
    epic_title: metadata.epic_title,
    sort_order: getNextSortOrderForDate(taskDate, allTasks),
    contact_id: null,
    auto_log_interaction: true,
    contact: null,
    image_url: null,
    attachments: [],
    notes: null,
    location: null,
    subtasks: [],
  };
}

export function normalizeRitualSchedule(input: {
  frequency: string;
  customDays?: number[] | null;
  customMonthDays?: number[] | null;
  customPeriod?: HabitCustomPeriod | null;
}): NormalizedRitualSchedule {
  const rawFrequency = input.frequency?.toLowerCase().trim() || "daily";
  const customDays = normalizeNumberList(input.customDays);
  const customMonthDays = normalizeNumberList(input.customMonthDays);
  const customPeriod = input.customPeriod ?? inferCustomPeriod({
    frequency: rawFrequency,
    custom_days: customDays,
    custom_month_days: customMonthDays,
  });

  if (customDays.length === 7) {
    return {
      frequency: "daily",
      custom_days: null,
      custom_month_days: null,
      customPeriod: "week",
    };
  }

  if (rawFrequency === "weekdays" || rawFrequency === "5x_week") {
    return {
      frequency: "5x_week",
      custom_days: [0, 1, 2, 3, 4],
      custom_month_days: null,
      customPeriod: "week",
    };
  }

  if (rawFrequency === "daily") {
    return {
      frequency: "daily",
      custom_days: null,
      custom_month_days: null,
      customPeriod: "week",
    };
  }

  if (rawFrequency === "weekly") {
    return {
      frequency: "weekly",
      custom_days: customDays.length > 0 ? [customDays[0]] : [0],
      custom_month_days: null,
      customPeriod: "week",
    };
  }

  if (rawFrequency === "monthly") {
    return {
      frequency: "monthly",
      custom_days: null,
      custom_month_days: customMonthDays.length > 0 ? [customMonthDays[0]] : [1],
      customPeriod: "month",
    };
  }

  if (customPeriod === "month") {
    return {
      frequency: "custom",
      custom_days: null,
      custom_month_days: customMonthDays.length > 0 ? customMonthDays : [1],
      customPeriod: "month",
    };
  }

  if (customDays.length === 5 && [0, 1, 2, 3, 4].every((day) => customDays.includes(day))) {
    return {
      frequency: "5x_week",
      custom_days: [0, 1, 2, 3, 4],
      custom_month_days: null,
      customPeriod: "week",
    };
  }

  return {
    frequency: rawFrequency === "custom" ? "custom" : rawFrequency,
    custom_days: customDays.length > 0 ? customDays : [0],
    custom_month_days: null,
    customPeriod: "week",
  };
}

export async function reconcileHabitLinkedTasks(
  template: HabitTaskTemplate,
  options?: {
    today?: string;
    horizonDays?: number;
  },
): Promise<HabitTaskReconciliationResult> {
  const today = options?.today ?? getEffectiveMissionDate();
  const horizonDays = options?.horizonDays ?? RITUAL_RECONCILIATION_WINDOW_DAYS;
  const linkedEpic = await resolveLinkedEpic(template.userId, template.habitId);
  const allTasks = await getAllLocalTasksForUser<DailyTask>(template.userId);

  const futureHabitTasks = allTasks.filter(
    (task) =>
      task.habit_source_id === template.habitId
      && typeof task.task_date === "string"
      && task.task_date >= today,
  );

  const tasksByDate = new Map<string, DailyTask>();
  futureHabitTasks.forEach((task) => {
    if (task.task_date) {
      tasksByDate.set(task.task_date, task);
    }
  });

  const evaluationDates = new Set<string>(tasksByDate.keys());
  const startDate = parseISO(today);
  for (let offset = 0; offset <= horizonDays; offset += 1) {
    evaluationDates.add(format(addDays(startDate, offset), "yyyy-MM-dd"));
  }

  const createdTasks: DailyTask[] = [];
  const updatedTasks: HabitTaskReconciliationResult["updatedTasks"] = [];
  const deletedTasks: DailyTask[] = [];

  for (const taskDate of [...evaluationDates].sort()) {
    const targetDate = parseISO(taskDate);
    const scheduled = isHabitScheduledForDate(
      {
        frequency: template.frequency,
        custom_days: template.custom_days,
        custom_month_days: template.custom_month_days,
        customPeriod: template.customPeriod ?? null,
      },
      targetDate,
      toPlannerWeekday(targetDate),
    );
    const existingTask = tasksByDate.get(taskDate) ?? null;

    if (scheduled) {
      if (existingTask) {
        if (existingTask.completed === true) {
          continue;
        }

        const metadata = buildTaskMetadata(template, linkedEpic);
        const nextTask: DailyTask = {
          ...existingTask,
          task_text: metadata.task_text,
          difficulty: metadata.difficulty,
          xp_reward: metadata.xp_reward,
          scheduled_time: metadata.scheduled_time,
          estimated_duration: metadata.estimated_duration,
          category: metadata.category,
          reminder_enabled: metadata.reminder_enabled,
          reminder_minutes_before: metadata.reminder_minutes_before,
          habit_source_id: template.habitId,
          epic_id: metadata.epic_id,
          epic_title: metadata.epic_title,
        };
        const updates = buildTaskUpdatePayload(existingTask, nextTask);

        if (Object.keys(updates).length > 0) {
          updatedTasks.push({
            existingTask,
            nextTask,
            updates,
          });
        }
        continue;
      }

      createdTasks.push(buildNewHabitTask(template, taskDate, linkedEpic, [...allTasks, ...createdTasks]));
      continue;
    }

    if (existingTask && existingTask.completed !== true) {
      deletedTasks.push(existingTask);
    }
  }

  const result: HabitTaskReconciliationResult = {
    createdTasks,
    updatedTasks,
    deletedTasks,
    touchedDates: [],
  };

  result.touchedDates = buildTouchedDates(result);
  return result;
}
