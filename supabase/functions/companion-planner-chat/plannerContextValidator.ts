import type {
  PlannerBuildInput,
  PlannerContextEpic,
  PlannerContextRitual,
  PlannerContextTask,
  PlannerPriorityScore,
} from "./planner.ts";
import type { SupabaseClientLike } from "../_shared/costGuardrails.ts";
import {
  isDeletedPlannerEntityReference,
  loadDeletedPlannerEntities,
  type DeletedPlannerEntity,
} from "./deletedPlannerMemory.ts";

type PlannerContext = PlannerBuildInput["plannerContext"];

interface SupabaseQueryResult<T> {
  data: T[] | null;
  error: unknown;
}

interface EpicRow {
  id: string;
  title: string | null;
  end_date: string | null;
  progress_percentage: number | null;
  status: string | null;
  completed_at?: string | null;
}

interface HabitRow {
  id: string;
}

interface DailyTaskRow {
  id: string;
  task_text: string | null;
  task_date: string | null;
  category: string | null;
  difficulty: string | null;
  priority: string | null;
  flexibility: PlannerContextTask["flexibility"];
  energy_type: PlannerContextTask["energyType"];
  must_calendar_block: boolean | null;
  deadline_at: string | null;
  completed: boolean | null;
  scheduled_time: string | null;
  completed_at: string | null;
  estimated_duration: number | null;
  actual_time_spent: number | null;
  notes: string | null;
  recurrence_pattern: string | null;
  recurrence_end_date: string | null;
  source: string | null;
  contact_id: string | null;
  habit_source_id: string | null;
  epic_id: string | null;
  excluded_from_planner_at?: string | null;
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const isRemoteRecordId = (value: string): boolean => UUID_PATTERN.test(value);

const compactStrings = (values: Array<string | null | undefined>): string[] =>
  Array.from(
    new Set(
      values
        .map((value) => value?.trim() ?? "")
        .filter((value) => value.length > 0),
    ),
  );

const compactRemoteIds = (values: Array<string | null | undefined>): string[] =>
  compactStrings(values).filter(isRemoteRecordId);

const collectPlannerTaskGroups = (context: PlannerContext): PlannerContextTask[] => [
  ...context.tasks,
  ...context.inboxTasks,
  ...(context.recentCompletedTasks ?? []),
];

const runInQuery = async <T>(
  supabase: SupabaseClientLike,
  table: string,
  columns: string,
  userId: string,
  ids: string[],
  configure?: (query: any) => any,
): Promise<T[]> => {
  if (ids.length === 0) return [];

  const query = configure
    ? configure(
      supabase
        .from(table)
        .select(columns)
        .eq("user_id", userId),
    )
    : supabase
      .from(table)
      .select(columns)
      .eq("user_id", userId);

  const { data, error } = await query.in("id", ids) as SupabaseQueryResult<T>;
  if (error) throw error;
  return data ?? [];
};

const mapEpicRowToContext = (
  row: EpicRow,
  existing?: PlannerContextEpic,
): PlannerContextEpic => ({
  id: row.id,
  title: row.title ?? existing?.title ?? "",
  endDate: row.end_date ?? null,
  progressPercentage: existing?.progressPercentage ?? null,
  daysRemaining: existing?.daysRemaining ?? null,
  habitCount: existing?.habitCount ?? null,
});

const mapTaskRowToContext = (
  existing: PlannerContextTask,
  row: DailyTaskRow,
  activeEpicIds: ReadonlySet<string>,
  activeEpicTitleById: ReadonlyMap<string, string>,
  activeHabitIds: ReadonlySet<string>,
): PlannerContextTask => {
  const hasActiveEpic = Boolean(row.epic_id && activeEpicIds.has(row.epic_id));
  const hasActiveHabit = Boolean(
    row.habit_source_id && activeHabitIds.has(row.habit_source_id),
  );

  return {
    ...existing,
    id: row.id,
    title: row.task_text ?? existing.title,
    taskDate: row.task_date ?? null,
    category: row.category ?? null,
    scheduledTime: row.scheduled_time ?? null,
    estimatedDuration: row.estimated_duration ?? null,
    actualTimeSpent: row.actual_time_spent ?? null,
    notes: row.notes ?? null,
    difficulty: row.difficulty ?? null,
    flexibility: row.flexibility ?? null,
    energyType: row.energy_type ?? null,
    mustCalendarBlock: row.must_calendar_block ?? null,
    deadlineAt: row.deadline_at ?? null,
    recurrencePattern: row.recurrence_pattern ?? null,
    recurrenceEndDate: row.recurrence_end_date ?? null,
    completed: row.completed === true || row.completed_at ? true : row.completed ?? null,
    completedAt: row.completed_at ?? null,
    priority: row.priority ?? null,
    source: row.source ?? null,
    contactId: row.contact_id ?? null,
    habitSourceId: hasActiveHabit ? row.habit_source_id : null,
    epicId: hasActiveEpic ? row.epic_id : null,
    epicTitle: hasActiveEpic && row.epic_id
      ? activeEpicTitleById.get(row.epic_id) ?? null
      : null,
  };
};

const filterTasksWithDbRows = (
  tasks: PlannerContextTask[],
  taskRowsById: ReadonlyMap<string, DailyTaskRow>,
  activeEpicIds: ReadonlySet<string>,
  activeEpicTitleById: ReadonlyMap<string, string>,
  activeHabitIds: ReadonlySet<string>,
  pendingLocalTaskIds: ReadonlySet<string>,
  deletedEntities: DeletedPlannerEntity[] | null,
): PlannerContextTask[] =>
  tasks.reduce<PlannerContextTask[]>((scoped, task) => {
    if (
      isDeletedPlannerEntityReference({
        entityType: "task",
        entityId: task.id,
      }, deletedEntities)
    ) {
      return scoped;
    }

    const row = taskRowsById.get(task.id);
    if (!row) {
      if (pendingLocalTaskIds.has(task.id)) {
        scoped.push(task);
      }
      return scoped;
    }
    if (row.excluded_from_planner_at) {
      return scoped;
    }
    if (
      isDeletedPlannerEntityReference({
        entityType: "task",
        entityId: row.id,
      }, deletedEntities) ||
      isDeletedPlannerEntityReference({
        entityType: "campaign",
        entityId: row.epic_id,
      }, deletedEntities) ||
      isDeletedPlannerEntityReference({
        entityType: "ritual",
        entityId: row.habit_source_id,
      }, deletedEntities) ||
      isDeletedPlannerEntityReference({
        entityType: "habit",
        entityId: row.habit_source_id,
      }, deletedEntities)
    ) {
      return scoped;
    }
    const hasInactiveEpic = Boolean(
      row.epic_id && !activeEpicIds.has(row.epic_id),
    );
    const hasInactiveHabit = Boolean(
      row.habit_source_id && !activeHabitIds.has(row.habit_source_id),
    );
    if (
      (hasInactiveEpic || hasInactiveHabit) &&
      row.completed !== true &&
      !row.completed_at
    ) {
      return scoped;
    }

    scoped.push(mapTaskRowToContext(
      task,
      row,
      activeEpicIds,
      activeEpicTitleById,
      activeHabitIds,
    ));
    return scoped;
  }, []);

const filterRitualsWithDbRows = (
  rituals: PlannerContextRitual[],
  activeEpicsById: ReadonlyMap<string, PlannerContextEpic>,
  activeHabitIds: ReadonlySet<string>,
  deletedEntities: DeletedPlannerEntity[] | null,
): PlannerContextRitual[] =>
  rituals.reduce<PlannerContextRitual[]>((scoped, ritual) => {
    if (
      isDeletedPlannerEntityReference({
        entityType: "ritual",
        entityId: ritual.id,
      }, deletedEntities) ||
      isDeletedPlannerEntityReference({
        entityType: "habit",
        entityId: ritual.id,
      }, deletedEntities) ||
      isDeletedPlannerEntityReference({
        entityType: "campaign",
        entityId: ritual.epicId,
      }, deletedEntities)
    ) {
      return scoped;
    }
    if (ritual.epicId === "general") {
      if (!activeHabitIds.has(ritual.id)) return scoped;
      scoped.push({
        ...ritual,
        epicId: "general",
        epicTitle: ritual.epicTitle || "your goals",
      });
      return scoped;
    }
    const epic = activeEpicsById.get(ritual.epicId);
    if (!epic || !activeHabitIds.has(ritual.id)) return scoped;
    scoped.push({
      ...ritual,
      epicTitle: epic.title,
    });
    return scoped;
  }, []);

const filterPriorityScoresWithDbRows = (
  priorityScores: PlannerPriorityScore[] | undefined,
  activeEpicIds: ReadonlySet<string>,
  activeRitualIds: ReadonlySet<string>,
  activeTaskIds: ReadonlySet<string>,
  titleMaps: {
    activeEpicTitleById: ReadonlyMap<string, string>;
    activeRitualTitleById: ReadonlyMap<string, string>;
    activeTaskTitleById: ReadonlyMap<string, string>;
  },
): PlannerPriorityScore[] | undefined => {
  if (!priorityScores) return undefined;

  return priorityScores.reduce<PlannerPriorityScore[]>((scoped, score) => {
    if (score.kind === "ritual" || score.ritualId) {
      if (
        score.ritualId &&
        activeRitualIds.has(score.ritualId) &&
        score.epicId &&
        (activeEpicIds.has(score.epicId) || score.epicId === "general")
      ) {
        scoped.push({
          ...score,
          title: titleMaps.activeRitualTitleById.get(score.ritualId) ??
            score.title,
        });
      }
      return scoped;
    }

    if (score.kind === "epic") {
      if (score.epicId && activeEpicIds.has(score.epicId)) {
        scoped.push({
          ...score,
          title: titleMaps.activeEpicTitleById.get(score.epicId) ?? score.title,
        });
      }
      return scoped;
    }

    if (score.kind === "task") {
      if (score.taskId && activeTaskIds.has(score.taskId)) {
        const canonicalScore = {
          ...score,
          title: titleMaps.activeTaskTitleById.get(score.taskId) ?? score.title,
        };
        scoped.push(
          canonicalScore.epicId &&
            canonicalScore.epicId !== "general" &&
            !activeEpicIds.has(canonicalScore.epicId)
            ? { ...canonicalScore, epicId: null }
            : canonicalScore,
        );
      }
      return scoped;
    }

    if (
      !score.epicId ||
      activeEpicIds.has(score.epicId) ||
      score.epicId === "general"
    ) {
      scoped.push(score);
    }
    return scoped;
  }, []);
};

const DEFAULT_TASK_DURATION_MINUTES = 30;
const DEFAULT_WAKE_MINUTES = 8 * 60;
const DEFAULT_WIND_DOWN_MINUTES = 21 * 60;

type PlannerScheduleInsights = NonNullable<PlannerContext["scheduleInsights"]>;
type PlannerCalendarEvent = PlannerContext["calendarEvents"][number];
type PlannerDayLoad = PlannerScheduleInsights["dayLoads"][number];

type TimelineInterval = {
  id: string;
  title: string;
  startMinutes: number;
  endMinutes: number;
};

const formatDateKey = (date: Date): string => date.toISOString().slice(0, 10);

const getRangeDates = (
  selectedDate: string,
  horizon: PlannerScheduleInsights["horizon"],
): string[] => {
  const start = new Date(`${selectedDate}T00:00:00.000Z`);
  if (Number.isNaN(start.getTime())) {
    return [selectedDate].filter(Boolean);
  }

  const totalDays = horizon === "day" ? 1 : horizon === "week" ? 7 : 30;
  return Array.from({ length: totalDays }, (_, index) => {
    const next = new Date(start);
    next.setUTCDate(start.getUTCDate() + index);
    return formatDateKey(next);
  });
};

const parseTimeToMinutes = (value: string | null | undefined): number | null => {
  if (!value) return null;
  const match = value.match(/^(\d{1,2}):(\d{2})/);
  if (!match) return null;

  const hour = Number.parseInt(match[1] ?? "", 10);
  const minute = Number.parseInt(match[2] ?? "", 10);
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return null;

  return (hour * 60) + minute;
};

const getTaskDuration = (task: PlannerContextTask): number =>
  Number.isFinite(task.estimatedDuration) && (task.estimatedDuration ?? 0) > 0
    ? Number(task.estimatedDuration)
    : DEFAULT_TASK_DURATION_MINUTES;

const getDayLoadStatus = (
  totalMinutes: number,
  taskCount: number,
): PlannerDayLoad["status"] => {
  if (taskCount === 0 || totalMinutes === 0) return "open";
  if (totalMinutes > 300 || taskCount >= 6) return "overloaded";
  if (totalMinutes > 180 || taskCount >= 4) return "busy";
  return "balanced";
};

const getEventIntervals = (
  date: string,
  events: PlannerCalendarEvent[],
): TimelineInterval[] => {
  const dayStart = new Date(`${date}T00:00:00`);
  const dayEnd = new Date(`${date}T23:59:59`);
  if (Number.isNaN(dayStart.getTime()) || Number.isNaN(dayEnd.getTime())) {
    return [];
  }

  return events
    .map((event) => {
      const eventStart = new Date(event.start);
      const eventEnd = new Date(event.end);
      if (
        Number.isNaN(eventStart.getTime()) ||
        Number.isNaN(eventEnd.getTime()) ||
        eventEnd <= dayStart ||
        eventStart >= dayEnd
      ) {
        return null;
      }

      if (event.isAllDay) {
        return {
          id: event.id,
          title: event.title,
          startMinutes: DEFAULT_WAKE_MINUTES,
          endMinutes: DEFAULT_WIND_DOWN_MINUTES,
        };
      }

      const localStart = eventStart < dayStart ? dayStart : eventStart;
      const localEnd = eventEnd > dayEnd ? dayEnd : eventEnd;
      const startMinutes = (localStart.getHours() * 60) + localStart.getMinutes();
      const endMinutes = (localEnd.getHours() * 60) + localEnd.getMinutes();
      if (endMinutes <= startMinutes) return null;

      return {
        id: event.id,
        title: event.title,
        startMinutes,
        endMinutes,
      };
    })
    .filter((interval): interval is TimelineInterval => Boolean(interval));
};

const getTaskIntervals = (tasks: PlannerContextTask[]): TimelineInterval[] =>
  tasks
    .filter((task) => task.completed !== true && task.scheduledTime)
    .map((task) => {
      const startMinutes = parseTimeToMinutes(task.scheduledTime);
      if (startMinutes === null) return null;
      return {
        id: task.id,
        title: task.title,
        startMinutes,
        endMinutes: startMinutes + getTaskDuration(task),
      };
    })
    .filter((interval): interval is TimelineInterval => Boolean(interval));

const buildScheduleConflicts = (
  date: string,
  intervals: TimelineInterval[],
): PlannerScheduleInsights["conflicts"] => {
  const sortedIntervals = intervals
    .slice()
    .sort((left, right) => left.startMinutes - right.startMinutes);
  const conflicts: PlannerScheduleInsights["conflicts"] = [];

  for (let i = 0; i < sortedIntervals.length - 1; i += 1) {
    const current = sortedIntervals[i];
    if (!current) continue;
    for (let j = i + 1; j < sortedIntervals.length; j += 1) {
      const next = sortedIntervals[j];
      if (!next || next.startMinutes >= current.endMinutes) break;
      const overlapMinutes = Math.min(current.endMinutes, next.endMinutes) -
        next.startMinutes;
      if (overlapMinutes <= 0) continue;
      conflicts.push({
        date,
        taskAId: current.id,
        taskATitle: current.title,
        taskBId: next.id,
        taskBTitle: next.title,
        overlapMinutes,
      });
    }
  }

  return conflicts;
};

const scopeScheduleInsights = (
  scheduleInsights: PlannerContext["scheduleInsights"],
  tasks: PlannerContextTask[],
  inboxTasks: PlannerContextTask[],
  calendarEvents: PlannerCalendarEvent[],
): PlannerContext["scheduleInsights"] => {
  if (!scheduleInsights) return undefined;

  const rangeDates = getRangeDates(scheduleInsights.selectedDate, scheduleInsights.horizon);
  const rangeDateSet = new Set(rangeDates);
  const tasksByDate = new Map<string, PlannerContextTask[]>();
  const taskById = new Map<string, PlannerContextTask>();

  [...tasks, ...inboxTasks].forEach((task) => {
    taskById.set(task.id, task);
    if (!task.taskDate || !rangeDateSet.has(task.taskDate)) return;
    if (!tasksByDate.has(task.taskDate)) {
      tasksByDate.set(task.taskDate, []);
    }
    tasksByDate.get(task.taskDate)?.push(task);
  });

  const dayLoads = rangeDates.map((date) => {
    const taskIntervals = getTaskIntervals(tasksByDate.get(date) ?? []);
    const eventIntervals = getEventIntervals(date, calendarEvents);
    const intervals = [...taskIntervals, ...eventIntervals];
    const totalMinutes = intervals.reduce(
      (sum, interval) => sum + Math.max(0, interval.endMinutes - interval.startMinutes),
      0,
    );

    return {
      date,
      totalMinutes,
      taskCount: intervals.length,
      status: getDayLoadStatus(totalMinutes, intervals.length),
    } satisfies PlannerDayLoad;
  });

  const conflicts = rangeDates.flatMap((date) =>
    buildScheduleConflicts(
      date,
      [
        ...getTaskIntervals(tasksByDate.get(date) ?? []),
        ...getEventIntervals(date, calendarEvents),
      ],
    )
  );

  const moveSuggestions = scheduleInsights.moveSuggestions
    .filter((suggestion) =>
      Boolean(suggestion.taskId && taskById.has(suggestion.taskId)) &&
      rangeDateSet.has(suggestion.fromDate) &&
      rangeDateSet.has(suggestion.toDate)
    )
    .map((suggestion) => ({
      ...suggestion,
      taskTitle: suggestion.taskId
        ? taskById.get(suggestion.taskId)?.title ?? null
        : null,
    }));

  return {
    horizon: scheduleInsights.horizon,
    selectedDate: scheduleInsights.selectedDate,
    dayLoads,
    overloadedDates: dayLoads
      .filter((load) => load.status === "overloaded")
      .map((load) => load.date),
    emptyDates: dayLoads
      .filter((load) => load.status === "open")
      .map((load) => load.date),
    conflicts,
    suggestedSlots: scheduleInsights.suggestedSlots
      .filter((slot) => rangeDateSet.has(slot.date))
      .map((slot) => ({
        ...slot,
        reason: "Open time in your schedule.",
      })),
    moveSuggestions,
  };
};

export const validateAndPrunePlannerContext = async (
  supabase: SupabaseClientLike,
  userId: string,
  plannerContext: PlannerContext,
  deletedEntities?: DeletedPlannerEntity[] | null,
): Promise<PlannerContext> => {
  try {
    const deletedPlannerEntities = deletedEntities ??
      await loadDeletedPlannerEntities(supabase, userId);
    const taskGroups = collectPlannerTaskGroups(plannerContext);
    const pendingLocalTaskIds = new Set(plannerContext.pendingLocalTaskIds ?? []);
    const pendingLocalEpicIds = new Set(plannerContext.pendingLocalEpicIds ?? []);
    const pendingLocalHabitIds = new Set(plannerContext.pendingLocalHabitIds ?? []);
    const referencedTaskIds = compactRemoteIds(taskGroups.map((task) => task.id));
    const referencedHabitIds = compactStrings([
      ...taskGroups.map((task) => task.habitSourceId),
      ...plannerContext.rituals.map((ritual) => ritual.id),
      ...(plannerContext.priorityScores ?? []).map((score) => score.ritualId),
    ]);

    const taskRows = await runInQuery<DailyTaskRow>(
      supabase,
      "daily_tasks",
      "id, task_text, task_date, category, difficulty, priority, flexibility, energy_type, must_calendar_block, deadline_at, completed, scheduled_time, completed_at, estimated_duration, actual_time_spent, notes, recurrence_pattern, recurrence_end_date, source, contact_id, habit_source_id, epic_id, excluded_from_planner_at",
      userId,
      referencedTaskIds,
    );

    const referencedEpicIds = compactRemoteIds([
      ...plannerContext.activeEpics.map((epic) => epic.id),
      ...taskGroups.map((task) => task.epicId),
      ...taskRows.map((row) => row.epic_id),
      ...plannerContext.rituals.map((ritual) => ritual.epicId),
      ...(plannerContext.priorityScores ?? []).map((score) => score.epicId),
    ]);

    const referencedRemoteHabitIds = compactRemoteIds([
      ...referencedHabitIds,
      ...taskRows.map((row) => row.habit_source_id),
    ]);
    const [epicRows, habitRows] = await Promise.all([
      runInQuery<EpicRow>(
        supabase,
        "epics",
        "id, title, end_date, progress_percentage, status, completed_at",
        userId,
        referencedEpicIds,
      ),
      runInQuery<HabitRow>(
        supabase,
        "habits",
        "id",
        userId,
        referencedRemoteHabitIds,
        (query) => query.eq("is_active", true),
      ),
    ]);

    const remoteEpicIds = new Set(epicRows.map((row) => row.id));
    const activeEpicRows = epicRows.filter((row) =>
      row.status === "active" &&
      !row.completed_at &&
      !isDeletedPlannerEntityReference({
        entityType: "campaign",
        entityId: row.id,
      }, deletedPlannerEntities)
    );
    const preservedClientEpics = plannerContext.activeEpics.filter((epic) =>
      !remoteEpicIds.has(epic.id) &&
      pendingLocalEpicIds.has(epic.id)
    );

    const existingEpicsById = new Map(
      plannerContext.activeEpics.map((epic) => [epic.id, epic]),
    );
    const activeEpics = [
      ...preservedClientEpics,
      ...activeEpicRows.map((row) =>
        mapEpicRowToContext(row, existingEpicsById.get(row.id))
      ),
    ];
    const activeEpicsById = new Map(activeEpics.map((epic) => [epic.id, epic]));
    const activeEpicIds = new Set(activeEpicsById.keys());
    const activeEpicTitleById = new Map(
      activeEpics.map((epic) => [epic.id, epic.title]),
    );
    const activeHabitIds = new Set([
      ...pendingLocalHabitIds,
      ...habitRows.map((habit) => habit.id),
    ]);
    const taskRowsById = new Map(taskRows.map((row) => [row.id, row]));

    const tasks = filterTasksWithDbRows(
      plannerContext.tasks,
      taskRowsById,
      activeEpicIds,
      activeEpicTitleById,
      activeHabitIds,
      pendingLocalTaskIds,
      deletedPlannerEntities,
    );
    const inboxTasks = filterTasksWithDbRows(
      plannerContext.inboxTasks,
      taskRowsById,
      activeEpicIds,
      activeEpicTitleById,
      activeHabitIds,
      pendingLocalTaskIds,
      deletedPlannerEntities,
    );
    const recentCompletedTasks = filterTasksWithDbRows(
      plannerContext.recentCompletedTasks ?? [],
      taskRowsById,
      activeEpicIds,
      activeEpicTitleById,
      activeHabitIds,
      pendingLocalTaskIds,
      deletedPlannerEntities,
    );
    const rituals = filterRitualsWithDbRows(
      plannerContext.rituals,
      activeEpicsById,
      activeHabitIds,
      deletedPlannerEntities,
    );
    const activeRitualIds = new Set(rituals.map((ritual) => ritual.id));
    const activeTaskIds = new Set([
      ...tasks,
      ...inboxTasks,
      ...recentCompletedTasks,
    ].map((task) => task.id));
    const activeTaskTitleById = new Map([
      ...tasks,
      ...inboxTasks,
      ...recentCompletedTasks,
    ].map((task) => [task.id, task.title]));
    const activeRitualTitleById = new Map(
      rituals.map((ritual) => [ritual.id, ritual.title]),
    );
    const priorityScores = filterPriorityScoresWithDbRows(
      plannerContext.priorityScores,
      activeEpicIds,
      activeRitualIds,
      activeTaskIds,
      {
        activeEpicTitleById,
        activeRitualTitleById,
        activeTaskTitleById,
      },
    );
    const scheduleInsights = scopeScheduleInsights(
      plannerContext.scheduleInsights,
      tasks,
      inboxTasks,
      plannerContext.calendarEvents,
    );

    return {
      ...plannerContext,
      tasks,
      inboxTasks,
      recentCompletedTasks,
      activeEpics,
      activeHabitIds: [...activeHabitIds],
      rituals,
      ...(priorityScores ? { priorityScores } : {}),
      ...(scheduleInsights ? { scheduleInsights } : {}),
    };
  } catch (error) {
    console.warn(
      "[companion-planner-chat] planner context validation failed; using client context",
      { userId, error },
    );
    return plannerContext;
  }
};
