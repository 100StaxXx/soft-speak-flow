import { supabase } from "@/integrations/supabase/client";
import { fetchEpics, type EpicRecord } from "@/hooks/epicsQuery";
import type { Habit, HabitCompletion } from "@/features/habits/types";
import {
  getAllLocalTasksForUser,
  getLocalEpicHabits,
  getLocalEpics,
  getLocalHabitCompletionsForDate,
  getLocalHabits,
  getLocalSubtasksForTask,
  getLocalTasksByDate,
  replaceLocalEpicHabits,
  replaceLocalEpicsForUser,
  replaceLocalHabitCompletionsForDate,
  replaceLocalHabitsForUser,
  replaceLocalJourneyPhases,
  replaceLocalEpicMilestones,
  replaceLocalTasksForDate,
  upsertPlannerRecords,
} from "@/utils/plannerLocalStore";
import { getPendingActionCount } from "@/utils/offlineStorage";
import { fetchDailyTasksRemote, type DailyTask } from "@/services/dailyTasksRemote";

export const PLANNER_SYNC_EVENT = "planner-sync-finished";

const plannerRemoteSyncLockCounts = new Map<string, number>();

interface HabitRemoteRow extends Habit {
  description?: string | null;
  estimated_minutes?: number | null;
  preferred_time?: string | null;
  reminder_enabled?: boolean | null;
  reminder_minutes_before?: number | null;
  sort_order?: number | null;
}

const sortTasks = (tasks: DailyTask[]) =>
  tasks
    .slice()
    .sort((a, b) => {
      const sortA = a.sort_order ?? Number.MAX_SAFE_INTEGER;
      const sortB = b.sort_order ?? Number.MAX_SAFE_INTEGER;
      if (sortA !== sortB) return sortA - sortB;
      return (b.created_at ?? "").localeCompare(a.created_at ?? "");
    });

function getPlannerRemoteSyncLockCount(userId: string): number {
  return plannerRemoteSyncLockCounts.get(userId) ?? 0;
}

export function hasPlannerRemoteSyncLock(userId: string): boolean {
  return getPlannerRemoteSyncLockCount(userId) > 0;
}

export function acquirePlannerRemoteSyncLock(userId: string): () => void {
  plannerRemoteSyncLockCounts.set(userId, getPlannerRemoteSyncLockCount(userId) + 1);

  let released = false;

  return () => {
    if (released) return;
    released = true;

    const nextCount = getPlannerRemoteSyncLockCount(userId) - 1;
    if (nextCount <= 0) {
      plannerRemoteSyncLockCounts.delete(userId);
      return;
    }

    plannerRemoteSyncLockCounts.set(userId, nextCount);
  };
}

export async function withPlannerRemoteSyncLock<T>(
  userId: string,
  operation: () => Promise<T>,
): Promise<T> {
  const release = acquirePlannerRemoteSyncLock(userId);

  try {
    return await operation();
  } finally {
    release();
  }
}

export async function canSyncPlannerFromRemote(userId: string): Promise<boolean> {
  if (typeof navigator !== "undefined" && !navigator.onLine) return false;
  if (hasPlannerRemoteSyncLock(userId)) return false;
  return (await getPendingActionCount(userId)) === 0;
}

export async function loadLocalDailyTasks(userId: string, taskDate: string): Promise<DailyTask[]> {
  const tasks = await getLocalTasksByDate<DailyTask>(userId, taskDate);

  const hydratedTasks = await Promise.all(
    tasks.map(async (task) => ({
      ...task,
      subtasks: (await getLocalSubtasksForTask<DailyTask["subtasks"][number] & { task_id: string }>(task.id))
        .slice()
        .sort((a, b) => (a.sort_order ?? Number.MAX_SAFE_INTEGER) - (b.sort_order ?? Number.MAX_SAFE_INTEGER))
        .map((subtask) => ({
          id: subtask.id,
          title: subtask.title,
          completed: subtask.completed,
          sort_order: subtask.sort_order,
        })),
    })),
  );

  return sortTasks(hydratedTasks);
}

export async function loadAllLocalTaskDates(userId: string): Promise<string[]> {
  const tasks = await getAllLocalTasksForUser<DailyTask>(userId);
  return Array.from(
    new Set(
      tasks
        .map((task) => task.task_date)
        .filter((taskDate): taskDate is string => typeof taskDate === "string" && taskDate.length > 0),
    ),
  ).sort();
}

export async function syncLocalDailyTasksFromRemote(userId: string, taskDate: string): Promise<DailyTask[] | null> {
  if (!(await canSyncPlannerFromRemote(userId))) {
    return null;
  }

  const remoteTasks = await fetchDailyTasksRemote(userId, taskDate);
  if (!(await canSyncPlannerFromRemote(userId))) {
    return null;
  }
  await replaceLocalTasksForDate(userId, taskDate, remoteTasks as Array<DailyTask & { subtasks?: Array<{
    id: string;
    task_id: string;
    user_id: string;
    title: string;
    completed: boolean | null;
    sort_order: number | null;
  }> }>);

  return remoteTasks;
}

export async function loadLocalHabits(userId: string): Promise<Habit[]> {
  const habits = await getLocalHabits<Habit & { sort_order?: number | null }>(userId);
  return habits
    .filter((habit) => habit.is_active !== false)
    .slice()
    .sort((a, b) => (a.sort_order ?? Number.MAX_SAFE_INTEGER) - (b.sort_order ?? Number.MAX_SAFE_INTEGER));
}

export async function loadLocalHabitCompletions(userId: string, date: string): Promise<HabitCompletion[]> {
  return getLocalHabitCompletionsForDate<HabitCompletion>(userId, date);
}

export async function syncLocalHabitsFromRemote(userId: string, today: string): Promise<void> {
  if (!(await canSyncPlannerFromRemote(userId))) {
    return;
  }

  const [{ data: habits, error: habitsError }, { data: completions, error: completionsError }] = await Promise.all([
    supabase
      .from("habits")
      .select("*")
      .eq("user_id", userId)
      .eq("is_active", true)
      .order("sort_order", { ascending: true }),
    supabase
      .from("habit_completions")
      .select("*")
      .eq("user_id", userId)
      .eq("date", today),
  ]);

  if (habitsError) throw habitsError;
  if (completionsError) throw completionsError;

  await replaceLocalHabitsForUser(userId, (habits ?? []) as HabitRemoteRow[]);
  await replaceLocalHabitCompletionsForDate(userId, today, (completions ?? []) as HabitCompletion[]);
}

export async function loadLocalEpics(userId: string): Promise<EpicRecord[]> {
  const [epics, habits] = await Promise.all([
    getLocalEpics<EpicRecord>(userId),
    getLocalHabits<HabitRemoteRow>(userId),
  ]);
  const epicHabits = await getLocalEpicHabits<Array<{ id: string; epic_id: string; habit_id: string }>[number]>(
    epics.map((epic) => epic.id),
  );

  const habitById = new Map(habits.map((habit) => [habit.id, habit]));
  const linksByEpicId = new Map<string, Array<{ habit_id: string; habits: EpicRecord["epic_habits"][number]["habits"] }>>();

  epicHabits.forEach((link) => {
    const habit = habitById.get(link.habit_id);
    if (!linksByEpicId.has(link.epic_id)) {
      linksByEpicId.set(link.epic_id, []);
    }

    linksByEpicId.get(link.epic_id)?.push({
      habit_id: link.habit_id,
      habits: habit
        ? {
          id: habit.id,
          title: habit.title,
          difficulty: habit.difficulty,
          description: habit.description ?? null,
          frequency: habit.frequency ?? null,
          estimated_minutes: habit.estimated_minutes ?? null,
          custom_days: habit.custom_days ?? null,
          custom_month_days: habit.custom_month_days ?? null,
          preferred_time: habit.preferred_time ?? null,
          category: habit.category ?? null,
        }
        : null,
    });
  });

  return epics
    .slice()
    .sort((a, b) => (b.created_at ?? "").localeCompare(a.created_at ?? ""))
    .map((epic) => ({
      ...epic,
      epic_habits: linksByEpicId.get(epic.id) ?? [],
    }));
}

export async function syncLocalEpicsFromRemote(userId: string): Promise<void> {
  if (!(await canSyncPlannerFromRemote(userId))) {
    return;
  }

  const epics = await fetchEpics(userId);
  await replaceLocalEpicsForUser(userId, epics);

  const epicIds = epics.map((epic) => epic.id);
  const [{ data: phases, error: phasesError }, { data: milestones, error: milestonesError }] = epicIds.length > 0
    ? await Promise.all([
      supabase
        .from("journey_phases")
        .select("*")
        .eq("user_id", userId)
        .in("epic_id", epicIds),
      supabase
        .from("epic_milestones")
        .select("*")
        .eq("user_id", userId)
        .in("epic_id", epicIds),
    ])
    : [{ data: [], error: null }, { data: [], error: null }];

  if (phasesError) throw phasesError;
  if (milestonesError) throw milestonesError;

  const habitsToUpsert: HabitRemoteRow[] = [];
  for (const epic of epics) {
    const links = (epic.epic_habits ?? []).map((link) => ({
      id: `${epic.id}:${link.habit_id}`,
      epic_id: epic.id,
      habit_id: link.habit_id,
    }));
    await replaceLocalEpicHabits(epic.id, links);
    await replaceLocalJourneyPhases(
      epic.id,
      ((phases ?? []).filter((phase) => phase.epic_id === epic.id) as Array<{
        id: string;
        user_id: string;
        epic_id: string;
      }>),
    );
    await replaceLocalEpicMilestones(
      epic.id,
      ((milestones ?? []).filter((milestone) => milestone.epic_id === epic.id) as Array<{
        id: string;
        user_id: string;
        epic_id: string;
      }>),
    );

    (epic.epic_habits ?? []).forEach((link) => {
      if (link.habits) {
        habitsToUpsert.push({
          ...link.habits,
          user_id: userId,
          frequency: link.habits.frequency ?? "daily",
          custom_days: link.habits.custom_days ?? null,
          custom_month_days: link.habits.custom_month_days ?? null,
          current_streak: null,
          longest_streak: null,
          created_at: null,
          is_active: true,
        });
      }
    });
  }

  if (habitsToUpsert.length > 0) {
    await upsertPlannerRecords("habits", habitsToUpsert);
  }
}

export function dispatchPlannerSyncFinished(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(PLANNER_SYNC_EVENT));
}
