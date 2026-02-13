import { normalizeScheduledTime } from "@/utils/scheduledTime";

export interface TaskSchedulingState {
  task_date: string | null;
  scheduled_time: string | null;
  habit_source_id: string | null;
  source?: string | null;
}

export interface NormalizedTaskSchedulingState extends TaskSchedulingState {
  normalizedToInbox: boolean;
  strippedScheduledTime: boolean;
}

const isRegularQuest = (habitSourceId: string | null | undefined) => !habitSourceId;

export const normalizeTaskSchedulingState = (
  state: TaskSchedulingState,
): NormalizedTaskSchedulingState => {
  let taskDate = state.task_date ?? null;
  let scheduledTime = normalizeScheduledTime(state.scheduled_time);
  let source = state.source ?? null;
  let normalizedToInbox = false;
  let strippedScheduledTime = false;

  if (taskDate === null && scheduledTime !== null) {
    scheduledTime = null;
    strippedScheduledTime = true;
  }

  if (isRegularQuest(state.habit_source_id) && taskDate !== null && scheduledTime === null) {
    taskDate = null;
    source = "inbox";
    normalizedToInbox = true;
  }

  if (taskDate === null && scheduledTime !== null) {
    scheduledTime = null;
    strippedScheduledTime = true;
  }

  return {
    task_date: taskDate,
    scheduled_time: scheduledTime,
    habit_source_id: state.habit_source_id ?? null,
    source,
    normalizedToInbox,
    strippedScheduledTime,
  };
};

export interface SchedulingUpdateInput extends Partial<Omit<TaskSchedulingState, "habit_source_id">> {
  habit_source_id?: string | null;
}

export const normalizeTaskSchedulingUpdate = (
  existing: TaskSchedulingState,
  updates: SchedulingUpdateInput,
): NormalizedTaskSchedulingState => {
  return normalizeTaskSchedulingState({
    task_date: updates.task_date !== undefined ? updates.task_date : existing.task_date,
    scheduled_time: updates.scheduled_time !== undefined ? updates.scheduled_time : existing.scheduled_time,
    habit_source_id: updates.habit_source_id !== undefined ? updates.habit_source_id : existing.habit_source_id,
    source: updates.source !== undefined ? updates.source : existing.source,
  });
};

