import { supabase } from "@/integrations/supabase/client";

type TaskWithId = {
  id: string;
  actual_duration_minutes?: number | null;
};

type RitualWithId = {
  id: string;
  actualDurationMinutes?: number | null;
};

type FocusSessionDurationRow = {
  task_id: string | null;
  actual_duration: number | null;
};

type HabitTaskRow = {
  id: string;
  habit_source_id: string | null;
};

const medianDuration = (durations: number[]): number | null => {
  if (durations.length === 0) return null;

  const sorted = [...durations].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) return Math.round(sorted[middle]);

  return Math.round((sorted[middle - 1] + sorted[middle]) / 2);
};

export const attachActualDurationMinutes = async <Task extends TaskWithId>(
  userId: string,
  tasks: Task[],
): Promise<Task[]> => {
  const taskIds = [...new Set(tasks.map((task) => task.id).filter(Boolean))];
  if (taskIds.length === 0) return tasks;

  const { data, error } = await supabase
    .from("focus_sessions")
    .select("task_id, actual_duration")
    .eq("user_id", userId)
    .eq("status", "completed")
    .in("task_id", taskIds)
    .not("actual_duration", "is", null)
    .gt("actual_duration", 0);

  if (error) throw error;

  const durationsByTaskId = new Map<string, number[]>();
  for (const row of (data ?? []) as FocusSessionDurationRow[]) {
    if (!row.task_id || typeof row.actual_duration !== "number") continue;
    if (!Number.isFinite(row.actual_duration) || row.actual_duration <= 0) continue;

    const durations = durationsByTaskId.get(row.task_id) ?? [];
    durations.push(row.actual_duration);
    durationsByTaskId.set(row.task_id, durations);
  }

  return tasks.map((task) => ({
    ...task,
    actual_duration_minutes: medianDuration(durationsByTaskId.get(task.id) ?? []),
  }));
};

export const attachRitualActualDurationMinutes = async <
  Ritual extends RitualWithId,
>(
  userId: string,
  rituals: Ritual[],
  completedSinceIso: string,
  limit = 200,
): Promise<Ritual[]> => {
  const ritualIds = [...new Set(rituals.map((ritual) => ritual.id).filter(Boolean))];
  if (ritualIds.length === 0) return rituals;

  const { data: taskRows, error: taskError } = await supabase
    .from("daily_tasks")
    .select("id, habit_source_id")
    .eq("user_id", userId)
    .eq("completed", true)
    .gte("completed_at", completedSinceIso)
    .order("completed_at", { ascending: false })
    .limit(limit)
    .in("habit_source_id", ritualIds);

  if (taskError) throw taskError;

  const taskToRitualId = new Map<string, string>();
  for (const row of (taskRows ?? []) as HabitTaskRow[]) {
    if (row.id && row.habit_source_id) {
      taskToRitualId.set(row.id, row.habit_source_id);
    }
  }

  const taskIds = [...taskToRitualId.keys()];
  if (taskIds.length === 0) {
    return rituals.map((ritual) => ({
      ...ritual,
      actualDurationMinutes: null,
    }));
  }

  const { data: sessionRows, error: sessionError } = await supabase
    .from("focus_sessions")
    .select("task_id, actual_duration")
    .eq("user_id", userId)
    .eq("status", "completed")
    .in("task_id", taskIds)
    .not("actual_duration", "is", null)
    .gt("actual_duration", 0);

  if (sessionError) throw sessionError;

  const durationsByRitualId = new Map<string, number[]>();
  for (const row of (sessionRows ?? []) as FocusSessionDurationRow[]) {
    if (!row.task_id || typeof row.actual_duration !== "number") continue;
    if (!Number.isFinite(row.actual_duration) || row.actual_duration <= 0) continue;

    const ritualId = taskToRitualId.get(row.task_id);
    if (!ritualId) continue;

    const durations = durationsByRitualId.get(ritualId) ?? [];
    durations.push(row.actual_duration);
    durationsByRitualId.set(ritualId, durations);
  }

  return rituals.map((ritual) => ({
    ...ritual,
    actualDurationMinutes: medianDuration(
      durationsByRitualId.get(ritual.id) ?? [],
    ),
  }));
};
