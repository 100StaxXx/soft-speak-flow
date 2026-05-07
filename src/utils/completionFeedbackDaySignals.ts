import type { CompletionFeedbackEvent } from "@/types/completionFeedback";

export type CompletionFeedbackDaySignals = Pick<
  CompletionFeedbackEvent,
  "firstCompletionToday" | "isBuildingMomentum" | "isOverloaded"
>;

export interface CompletionFeedbackDaySignalTask {
  id: string;
  completed?: boolean | null;
  completed_at?: string | null;
}

export const COMPLETION_FEEDBACK_DAY_SIGNAL_TASKS_QUERY_KEY = "completion-feedback-day-signal-tasks";
export const COMPLETION_FEEDBACK_INBOX_TASKS_QUERY_KEY = "inbox-completion-feedback-tasks";
export const COMPLETION_FEEDBACK_LOCAL_COMPLETIONS_QUERY_KEY = "completion-feedback-local-completions";

export const getCompletionFeedbackDaySignalTasksQueryKey = (userId: string, taskDate: string) =>
  [COMPLETION_FEEDBACK_DAY_SIGNAL_TASKS_QUERY_KEY, userId, taskDate] as const;

export const getCompletionFeedbackInboxTasksQueryKey = (userId: string, taskDate: string) =>
  [COMPLETION_FEEDBACK_INBOX_TASKS_QUERY_KEY, userId, taskDate] as const;

export const getCompletionFeedbackLocalCompletionsQueryKey = (userId: string, taskDate: string) =>
  [COMPLETION_FEEDBACK_LOCAL_COMPLETIONS_QUERY_KEY, userId, taskDate] as const;

interface BuildCompletionFeedbackDaySignalsOptions {
  completedTaskId: string | null | undefined;
  tasks: CompletionFeedbackDaySignalTask[] | null | undefined;
  normalizeTaskId?: (taskId: string) => string;
}

const identityTaskId = (taskId: string) => taskId;

export const getCompletionFeedbackTaskDate = (
  taskDate: string | null | undefined,
  completedAt: string | null | undefined,
  now = new Date(),
): string => {
  if (taskDate) return taskDate;
  if (completedAt) {
    const parsedCompletedAt = new Date(completedAt);
    if (!Number.isNaN(parsedCompletedAt.getTime())) {
      return [
        parsedCompletedAt.getFullYear(),
        String(parsedCompletedAt.getMonth() + 1).padStart(2, "0"),
        String(parsedCompletedAt.getDate()).padStart(2, "0"),
      ].join("-");
    }
  }

  return [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, "0"),
    String(now.getDate()).padStart(2, "0"),
  ].join("-");
};

export const getCompletionFeedbackLocalDayBounds = (taskDate: string): {
  start: Date;
  end: Date;
} => {
  const start = new Date(`${taskDate}T00:00:00`);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return { start, end };
};

export const mergeCompletionFeedbackDaySignalTasks = (
  tasks: CompletionFeedbackDaySignalTask[],
  normalizeTaskId: (taskId: string) => string = identityTaskId,
): CompletionFeedbackDaySignalTask[] => {
  const tasksById = new Map<string, CompletionFeedbackDaySignalTask>();

  for (const task of tasks) {
    const normalizedTaskId = normalizeTaskId(task.id);
    const existingTask = tasksById.get(normalizedTaskId);
    if (!existingTask) {
      tasksById.set(normalizedTaskId, task);
      continue;
    }

    const existingCompleted = existingTask.completed === true || Boolean(existingTask.completed_at);
    const nextCompleted = task.completed === true || Boolean(task.completed_at);
    if (nextCompleted && !existingCompleted) {
      tasksById.set(normalizedTaskId, task);
    }
  }

  return [...tasksById.values()];
};

export const buildCompletionFeedbackDaySignals = ({
  completedTaskId,
  tasks,
  normalizeTaskId = identityTaskId,
}: BuildCompletionFeedbackDaySignalsOptions): CompletionFeedbackDaySignals => {
  if (!completedTaskId || !Array.isArray(tasks)) return {};

  let completedCount = 0;
  let incompleteCount = 0;
  let targetTaskFound = false;
  const normalizedCompletedTaskId = normalizeTaskId(completedTaskId);
  const signalTasks = mergeCompletionFeedbackDaySignalTasks(tasks, normalizeTaskId);

  for (const task of signalTasks) {
    const normalizedTaskId = normalizeTaskId(task.id);
    const isTargetTask = task.id === completedTaskId
      || task.id === normalizedCompletedTaskId
      || normalizedTaskId === normalizedCompletedTaskId;
    targetTaskFound ||= isTargetTask;
    const isCompleted = isTargetTask || task.completed === true || Boolean(task.completed_at);

    if (isCompleted) {
      completedCount += 1;
    } else {
      incompleteCount += 1;
    }
  }

  if (!targetTaskFound) {
    completedCount += 1;
  }

  const totalCount = signalTasks.length + (targetTaskFound ? 0 : 1);

  return {
    firstCompletionToday: completedCount <= 1,
    isBuildingMomentum: completedCount >= 3,
    isOverloaded: incompleteCount >= 5 || totalCount >= 8,
  };
};
