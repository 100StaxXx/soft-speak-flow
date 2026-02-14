import { getScheduledTimeParts } from "./scheduledTime";
import { getTaskConflictSetForTask, type TaskConflictCandidate } from "./taskTimeConflicts";

const DEFAULT_DURATION_MINUTES = 30;

interface ScheduledTimelineTask extends TaskConflictCandidate {
  startMinute: number;
  endMinute: number;
}

export interface TaskTimelineFlowEntry {
  id: string;
  startMinute: number;
  endMinute: number;
  laneIndex: number;
  laneCount: number;
  overlapCount: number;
  gapBeforeMinutes: number;
}

export interface TaskTimelineFlowResult {
  orderedTaskIds: string[];
  byTaskId: Map<string, TaskTimelineFlowEntry>;
}

const getDurationMinutes = (task: TaskConflictCandidate): number => {
  if (!Number.isFinite(task.estimated_duration) || (task.estimated_duration ?? 0) <= 0) {
    return DEFAULT_DURATION_MINUTES;
  }
  return Number(task.estimated_duration);
};

const getStartMinute = (value: string | null | undefined): number | null => {
  const parts = getScheduledTimeParts(value);
  if (!parts) return null;
  return (parts.hour * 60) + parts.minute;
};

const buildScheduledTimelineTasks = (
  tasks: TaskConflictCandidate[],
  scheduledTimeOverrides?: Record<string, string | null | undefined>,
): ScheduledTimelineTask[] => {
  return tasks
    .map((task) => {
      const override = scheduledTimeOverrides?.[task.id];
      const scheduledTime = override !== undefined ? override : task.scheduled_time;
      const startMinute = getStartMinute(scheduledTime);
      if (startMinute === null) return null;

      const duration = getDurationMinutes(task);
      return {
        ...task,
        startMinute,
        endMinute: startMinute + duration,
      };
    })
    .filter((task): task is ScheduledTimelineTask => task !== null)
    .sort((a, b) => {
      if (a.startMinute !== b.startMinute) return a.startMinute - b.startMinute;
      if (a.endMinute !== b.endMinute) return a.endMinute - b.endMinute;
      return a.id.localeCompare(b.id);
    });
};

export const buildTaskTimelineFlow = (
  tasks: TaskConflictCandidate[],
  scheduledTimeOverrides?: Record<string, string | null | undefined>,
): TaskTimelineFlowResult => {
  const scheduledTasks = buildScheduledTimelineTasks(tasks, scheduledTimeOverrides);
  const byTaskId = new Map<string, TaskTimelineFlowEntry>();

  if (scheduledTasks.length === 0) {
    return { orderedTaskIds: [], byTaskId };
  }

  const activeLanes: Array<{ id: string; endMinute: number; laneIndex: number }> = [];
  const orderedTaskIds: string[] = [];

  let clusterTaskIds: string[] = [];
  let clusterMaxLaneCount = 0;
  let previousStartMinute: number | null = null;

  const finalizeCluster = () => {
    if (clusterTaskIds.length === 0) return;
    for (const taskId of clusterTaskIds) {
      const existing = byTaskId.get(taskId);
      if (!existing) continue;
      existing.laneCount = Math.max(existing.laneCount, clusterMaxLaneCount);
      byTaskId.set(taskId, existing);
    }
    clusterTaskIds = [];
    clusterMaxLaneCount = 0;
  };

  for (const task of scheduledTasks) {
    for (let index = activeLanes.length - 1; index >= 0; index -= 1) {
      if (activeLanes[index].endMinute <= task.startMinute) {
        activeLanes.splice(index, 1);
      }
    }

    if (activeLanes.length === 0) {
      finalizeCluster();
    }

    const usedLanes = new Set(activeLanes.map((lane) => lane.laneIndex));
    let laneIndex = 0;
    while (usedLanes.has(laneIndex)) {
      laneIndex += 1;
    }

    activeLanes.push({
      id: task.id,
      endMinute: task.endMinute,
      laneIndex,
    });

    clusterTaskIds.push(task.id);
    clusterMaxLaneCount = Math.max(clusterMaxLaneCount, activeLanes.length);
    orderedTaskIds.push(task.id);

    const overlapCount = getTaskConflictSetForTask(task.id, tasks, scheduledTimeOverrides).size;
    const gapBeforeMinutes = previousStartMinute === null
      ? 0
      : Math.max(0, task.startMinute - previousStartMinute);
    previousStartMinute = task.startMinute;

    byTaskId.set(task.id, {
      id: task.id,
      startMinute: task.startMinute,
      endMinute: task.endMinute,
      laneIndex,
      laneCount: 1,
      overlapCount,
      gapBeforeMinutes,
    });
  }

  finalizeCluster();

  return {
    orderedTaskIds,
    byTaskId,
  };
};

