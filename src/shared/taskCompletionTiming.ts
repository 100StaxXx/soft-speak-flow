export interface TaskCompletionDisciplineAwardInput {
  taskId: string;
  taskDate: string;
  habitSourceId: string | null;
  scheduledTime: string | null;
  completedAt: Date;
}

export type TaskCompletionDisciplineAward =
  | { kind: "habit_complete"; habitId: string; date: string }
  | { kind: "planned_task_on_time"; taskId: string }
  | null;

export const isTaskCompletionOnTime = (
  scheduledTime: string | null,
  completedAt: Date,
): boolean | null => {
  if (!scheduledTime) return null;

  const scheduledHour = Number.parseInt(scheduledTime.split(":")[0] ?? "", 10);
  if (Number.isNaN(scheduledHour)) return null;

  return Math.abs(scheduledHour - completedAt.getHours()) <= 1;
};

export const getTaskCompletionDisciplineAward = ({
  taskId,
  taskDate,
  habitSourceId,
  scheduledTime,
  completedAt,
}: TaskCompletionDisciplineAwardInput): TaskCompletionDisciplineAward => {
  if (habitSourceId) {
    return {
      kind: "habit_complete",
      habitId: habitSourceId,
      date: taskDate,
    };
  }

  if (isTaskCompletionOnTime(scheduledTime, completedAt)) {
    return {
      kind: "planned_task_on_time",
      taskId,
    };
  }

  return null;
};
