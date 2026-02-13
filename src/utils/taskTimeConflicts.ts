import { getScheduledTimeParts } from "@/utils/scheduledTime";

const DEFAULT_DURATION_MINUTES = 30;

export interface TaskConflictCandidate {
  id: string;
  scheduled_time?: string | null;
  estimated_duration?: number | null;
}

export interface TaskTimeConflict {
  taskAId: string;
  taskBId: string;
  overlapMinutes: number;
}

interface TaskInterval {
  id: string;
  startMinutes: number;
  endMinutes: number;
}

const getTaskDurationMinutes = (task: TaskConflictCandidate): number => {
  return Number.isFinite(task.estimated_duration)
    && (task.estimated_duration ?? 0) > 0
    ? Number(task.estimated_duration)
    : DEFAULT_DURATION_MINUTES;
};

const minutesFromTime = (value: string | null | undefined): number | null => {
  const parts = getScheduledTimeParts(value);
  if (!parts) return null;
  return (parts.hour * 60) + parts.minute;
};

const getTaskIntervals = (
  tasks: TaskConflictCandidate[],
  scheduledTimeOverrides?: Record<string, string | null | undefined>,
): TaskInterval[] => {
  const intervals: TaskInterval[] = [];

  for (const task of tasks) {
    const overrideValue = scheduledTimeOverrides?.[task.id];
    const scheduledTime = overrideValue !== undefined ? overrideValue : task.scheduled_time;
    const startMinutes = minutesFromTime(scheduledTime);
    if (startMinutes === null) continue;

    intervals.push({
      id: task.id,
      startMinutes,
      endMinutes: startMinutes + getTaskDurationMinutes(task),
    });
  }

  return intervals.sort((a, b) => a.startMinutes - b.startMinutes);
};

export const detectTaskTimeConflicts = (
  tasks: TaskConflictCandidate[],
  scheduledTimeOverrides?: Record<string, string | null | undefined>,
): TaskTimeConflict[] => {
  const intervals = getTaskIntervals(tasks, scheduledTimeOverrides);
  if (intervals.length < 2) return [];

  const conflicts: TaskTimeConflict[] = [];

  for (let i = 0; i < intervals.length - 1; i += 1) {
    const current = intervals[i];
    for (let j = i + 1; j < intervals.length; j += 1) {
      const next = intervals[j];
      if (next.startMinutes >= current.endMinutes) break;

      const overlapMinutes = Math.min(current.endMinutes, next.endMinutes) - next.startMinutes;
      if (overlapMinutes <= 0) continue;

      conflicts.push({
        taskAId: current.id,
        taskBId: next.id,
        overlapMinutes,
      });
    }
  }

  return conflicts;
};

export const buildTaskConflictMap = (
  tasks: TaskConflictCandidate[],
  scheduledTimeOverrides?: Record<string, string | null | undefined>,
): Map<string, Set<string>> => {
  const conflicts = detectTaskTimeConflicts(tasks, scheduledTimeOverrides);
  const conflictMap = new Map<string, Set<string>>();

  for (const conflict of conflicts) {
    if (!conflictMap.has(conflict.taskAId)) {
      conflictMap.set(conflict.taskAId, new Set<string>());
    }
    if (!conflictMap.has(conflict.taskBId)) {
      conflictMap.set(conflict.taskBId, new Set<string>());
    }
    conflictMap.get(conflict.taskAId)?.add(conflict.taskBId);
    conflictMap.get(conflict.taskBId)?.add(conflict.taskAId);
  }

  return conflictMap;
};

export const getTaskConflictSetForTask = (
  taskId: string,
  tasks: TaskConflictCandidate[],
  scheduledTimeOverrides?: Record<string, string | null | undefined>,
): Set<string> => {
  const activeTask = tasks.find((task) => task.id === taskId);
  if (!activeTask) return new Set<string>();

  const activeTimeOverride = scheduledTimeOverrides?.[taskId];
  const activeScheduledTime = activeTimeOverride !== undefined
    ? activeTimeOverride
    : activeTask.scheduled_time;
  const activeStartMinutes = minutesFromTime(activeScheduledTime);
  if (activeStartMinutes === null) return new Set<string>();

  const activeEndMinutes = activeStartMinutes + getTaskDurationMinutes(activeTask);
  const overlapIds = new Set<string>();

  for (const task of tasks) {
    if (task.id === taskId) continue;

    const overrideValue = scheduledTimeOverrides?.[task.id];
    const scheduledTime = overrideValue !== undefined ? overrideValue : task.scheduled_time;
    const startMinutes = minutesFromTime(scheduledTime);
    if (startMinutes === null) continue;

    const endMinutes = startMinutes + getTaskDurationMinutes(task);
    const overlapMinutes = Math.min(activeEndMinutes, endMinutes) - Math.max(activeStartMinutes, startMinutes);
    if (overlapMinutes > 0) {
      overlapIds.add(task.id);
    }
  }

  return overlapIds;
};

export const getTaskConflictCount = (
  taskId: string,
  tasks: TaskConflictCandidate[],
  scheduledTimeOverrides?: Record<string, string | null | undefined>,
): number => {
  return getTaskConflictSetForTask(taskId, tasks, scheduledTimeOverrides).size;
};
