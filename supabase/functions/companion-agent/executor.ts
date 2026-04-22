import {
  getEffectiveQuestXP,
  getHabitXP,
} from "../../../src/config/xpRewards.ts";
import { categorizeQuest } from "../../../src/utils/questCategorization.ts";
import {
  loadPendingActionForResolution,
  loadThread,
  persistActionReceipt,
  updatePendingAction,
} from "./persistence.ts";
import type { PendingActionRow } from "./types.ts";

function buildReceipt(params: {
  action: PendingActionRow;
  status: "cancelled" | "failed" | "executed";
  message: string;
  executionResult?: Record<string, unknown> | null;
  executionError?: Record<string, unknown> | null;
}) {
  return {
    actionId: params.action.id,
    status: params.status,
    message: params.message,
    summary: params.action.summary,
    createdAt: new Date().toISOString(),
    executionResult: params.executionResult ?? null,
    executionError: params.executionError ?? null,
  };
}

async function resolveActivePendingAction(params: {
  supabase: any;
  userId: string;
  sessionId: string;
  actionId?: string;
}) {
  const active = await loadPendingActionForResolution({
    supabase: params.supabase,
    userId: params.userId,
    sessionId: params.sessionId,
  });

  if (!active) {
    if (!params.actionId) return null;
    return await loadPendingActionForResolution({
      supabase: params.supabase,
      userId: params.userId,
      sessionId: params.sessionId,
      actionId: params.actionId,
    });
  }

  if (params.actionId && active.id !== params.actionId) {
    throw new Error("Pending action mismatch");
  }

  return active;
}

function taskScheduleLabel(task: Record<string, unknown>) {
  const taskDate = typeof task.task_date === "string" ? task.task_date : null;
  const scheduledTime = typeof task.scheduled_time === "string"
    ? task.scheduled_time
    : null;
  if (taskDate && scheduledTime) return `${taskDate} at ${scheduledTime}`;
  return taskDate ?? "your schedule";
}

function normalizeDifficulty(value: unknown): "easy" | "medium" | "hard" {
  const normalized = typeof value === "string"
    ? value.toLowerCase().trim()
    : "medium";
  if (["easy", "simple", "beginner", "low"].includes(normalized)) return "easy";
  if (
    ["hard", "difficult", "advanced", "high", "challenging"].includes(
      normalized,
    )
  ) return "hard";
  return "medium";
}

function normalizeRecurrencePattern(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

function normalizeTaskSource(
  value: unknown,
  taskDate: string | null,
) {
  if (typeof value === "string" && value.trim().length > 0) {
    return value.trim();
  }

  return taskDate === null ? "inbox" : "manual";
}

function normalizeFrequency(
  value: unknown,
): "daily" | "5x_week" | "3x_week" | "monthly" | "custom" {
  const normalized = typeof value === "string"
    ? value.toLowerCase().trim().replace(/\s+/g, "_")
    : "daily";
  if (
    ["daily", "everyday", "every_day", "7x_week", "7x"].includes(normalized)
  ) return "daily";
  if (
    ["5x_week", "5x", "weekdays", "five_times", "5_times"].includes(normalized)
  ) return "5x_week";
  if (
    ["3x_week", "3x", "three_times", "3_times", "thrice"].includes(normalized)
  ) return "3x_week";
  if (["monthly", "month", "every_month"].includes(normalized)) {
    return "monthly";
  }
  return "custom";
}

function normalizeThemeColor(
  value: unknown,
): "heroic" | "warrior" | "mystic" | "nature" | "solar" {
  if (typeof value !== "string") return "heroic";
  const normalized = value.toLowerCase().trim();
  if (["heroic", "warrior", "mystic", "nature", "solar"].includes(normalized)) {
    return normalized as "heroic" | "warrior" | "mystic" | "nature" | "solar";
  }

  const hexMap: Record<
    string,
    "heroic" | "warrior" | "mystic" | "nature" | "solar"
  > = {
    "#f59e0b": "heroic",
    "#ef4444": "warrior",
    "#10b981": "nature",
    "#ec4899": "mystic",
    "#f97316": "solar",
    "#8b5cf6": "mystic",
    "#3b82f6": "heroic",
    "#475569": "warrior",
  };

  return hexMap[normalized] ?? "heroic";
}

function toNumberArray(
  value: unknown,
  range: { min: number; max: number },
) {
  if (!Array.isArray(value)) return null;

  const numbers = value
    .filter((entry): entry is number =>
      typeof entry === "number" && Number.isFinite(entry)
    )
    .map((entry) => Math.trunc(entry))
    .filter((entry) => entry >= range.min && entry <= range.max);

  return numbers.length > 0 ? numbers : null;
}

function normalizeSubtaskTitles(value: unknown): string[] {
  if (!Array.isArray(value)) return [];

  const seen = new Set<string>();

  return value
    .filter((entry): entry is string => typeof entry === "string")
    .map((entry) => entry.trim().replace(/\s+/g, " "))
    .filter((entry) => entry.length > 0)
    .filter((entry) => {
      const key = entry.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

function buildTaskRecurrencePayload(input: {
  recurrencePattern: unknown;
  recurrenceDays: unknown;
  recurrenceMonthDays: unknown;
  recurrenceCustomPeriod: unknown;
  recurrenceEndDate: unknown;
}) {
  const recurrencePattern = normalizeRecurrencePattern(input.recurrencePattern);
  const recurrenceCustomPeriod = recurrencePattern === "custom" &&
      (input.recurrenceCustomPeriod === "month" ||
        input.recurrenceCustomPeriod === "week")
    ? input.recurrenceCustomPeriod
    : null;
  const recurrenceDays = recurrencePattern
    ? toNumberArray(input.recurrenceDays, { min: 0, max: 6 })
    : null;
  const recurrenceMonthDays = recurrencePattern === "monthly" ||
      (recurrencePattern === "custom" && recurrenceCustomPeriod === "month")
    ? toNumberArray(input.recurrenceMonthDays, { min: 1, max: 31 })
    : null;
  const recurrenceEndDate = typeof input.recurrenceEndDate === "string"
    ? input.recurrenceEndDate
    : null;

  return {
    recurrence_pattern: recurrencePattern,
    recurrence_days: recurrenceDays,
    recurrence_month_days: recurrenceMonthDays,
    recurrence_custom_period: recurrencePattern === "custom"
      ? recurrenceCustomPeriod ?? "week"
      : null,
    recurrence_end_date: recurrencePattern ? recurrenceEndDate : null,
    is_recurring: recurrencePattern !== null,
  };
}

function addDaysToDateOnly(dateOnly: string, days: number) {
  const next = new Date(`${dateOnly}T00:00:00.000Z`);
  next.setUTCDate(next.getUTCDate() + days);
  return next.toISOString().slice(0, 10);
}

function resolveCampaignEndDate(startDate: string, targetDays: number) {
  return addDaysToDateOnly(startDate, Math.max(0, Math.round(targetDays)));
}

function buildCampaignInviteCode() {
  return `EPIC-${
    crypto.randomUUID().replaceAll("-", "").slice(0, 8).toUpperCase()
  }`;
}

const RITUAL_RECONCILIATION_WINDOW_DAYS = 30;

type RemoteTaskRow = {
  id: string;
  user_id: string;
  task_text: string;
  difficulty: string | null;
  xp_reward: number | null;
  task_date: string | null;
  completed: boolean | null;
  completed_at: string | null;
  is_main_quest: boolean | null;
  scheduled_time: string | null;
  estimated_duration: number | null;
  recurrence_pattern: string | null;
  recurrence_days: number[] | null;
  recurrence_month_days: number[] | null;
  recurrence_custom_period: string | null;
  recurrence_end_date: string | null;
  is_recurring: boolean | null;
  reminder_enabled: boolean | null;
  reminder_minutes_before: number | null;
  category: string | null;
  is_bonus: boolean | null;
  created_at: string | null;
  priority: string | null;
  is_top_three: boolean | null;
  actual_time_spent: number | null;
  ai_generated: boolean | null;
  context_id: string | null;
  source: string | null;
  habit_source_id: string | null;
  epic_id: string | null;
  epic_title: string | null;
  sort_order: number | null;
  contact_id: string | null;
  auto_log_interaction: boolean | null;
  image_url: string | null;
  notes: string | null;
  location: string | null;
  parent_template_id: string | null;
};

type LinkedEpic = {
  id: string;
  title: string | null;
};

type HabitCustomPeriod = "week" | "month";

type NormalizedRitualSchedule = {
  frequency: string;
  custom_days: number[] | null;
  custom_month_days: number[] | null;
  customPeriod: HabitCustomPeriod;
};

type RitualTaskTemplate = {
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
  customPeriod: HabitCustomPeriod;
};

function normalizeNumberList(values: number[] | null | undefined): number[] {
  if (!values || values.length === 0) return [];
  return [...new Set(values)].sort((left, right) => left - right);
}

function inferCustomPeriod(schedule: {
  customPeriod?: HabitCustomPeriod | null;
  custom_month_days?: number[] | null;
}): HabitCustomPeriod {
  if (schedule.customPeriod === "month") return "month";
  if (schedule.customPeriod === "week") return "week";
  if ((schedule.custom_month_days?.length ?? 0) > 0) return "month";
  return "week";
}

function normalizeRitualSchedule(input: {
  frequency: string;
  customDays?: number[] | null;
  customMonthDays?: number[] | null;
  customPeriod?: HabitCustomPeriod | null;
}): NormalizedRitualSchedule {
  const rawFrequency = input.frequency?.toLowerCase().trim() || "daily";
  const customDays = normalizeNumberList(input.customDays);
  const customMonthDays = normalizeNumberList(input.customMonthDays);
  const customPeriod = input.customPeriod ?? inferCustomPeriod({
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
      custom_month_days: customMonthDays.length > 0
        ? [customMonthDays[0]]
        : [1],
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

  if (
    customDays.length === 5 &&
    [0, 1, 2, 3, 4].every((day) => customDays.includes(day))
  ) {
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

function getClampedMonthDays(
  monthDays: number[] | null | undefined,
  targetDate: Date,
) {
  const normalized = normalizeNumberList(monthDays);
  if (normalized.length === 0) return [];

  const lastDayOfMonth = new Date(
    Date.UTC(targetDate.getUTCFullYear(), targetDate.getUTCMonth() + 1, 0),
  ).getUTCDate();

  return normalizeNumberList(
    normalized.map((day) => Math.min(Math.max(day, 1), lastDayOfMonth)),
  );
}

function isRitualScheduledForDate(
  schedule: {
    frequency?: string | null;
    custom_days?: number[] | null;
    custom_month_days?: number[] | null;
    customPeriod?: HabitCustomPeriod | null;
  },
  targetDate: Date,
  weekdayIndex: number,
) {
  const frequency = schedule.frequency?.toLowerCase();
  const customDays = normalizeNumberList(schedule.custom_days);
  const monthDays = getClampedMonthDays(schedule.custom_month_days, targetDate);
  const dayOfMonth = targetDate.getUTCDate();
  const customPeriod = inferCustomPeriod(schedule);

  switch (frequency) {
    case "daily":
      return true;
    case "weekly":
      return (customDays[0] ?? 0) === weekdayIndex;
    case "weekdays":
    case "5x_week":
      return weekdayIndex >= 0 && weekdayIndex <= 4;
    case "weekends":
      return weekdayIndex === 5 || weekdayIndex === 6;
    case "3x_week":
      return (customDays.length > 0 ? customDays : [0, 2, 4]).includes(
        weekdayIndex,
      );
    case "monthly":
      return (monthDays.length > 0 ? monthDays : [1]).includes(dayOfMonth);
    case "custom":
      if (customPeriod === "month") {
        return (monthDays.length > 0 ? monthDays : [1]).includes(dayOfMonth);
      }
      return customDays.includes(weekdayIndex);
    default:
      return true;
  }
}

function toPlannerWeekday(targetDate: Date) {
  const jsDay = targetDate.getUTCDay();
  return jsDay === 0 ? 6 : jsDay - 1;
}

function resolveEffectiveMissionDate(currentDateTime?: string | null) {
  const match = currentDateTime?.match(/^(\d{4}-\d{2}-\d{2})T(\d{2}):/);
  if (!match) {
    return new Date().toISOString().slice(0, 10);
  }

  const [, dateOnly, hourPart] = match;
  const hour = Number.parseInt(hourPart, 10);
  if (Number.isNaN(hour) || hour >= 2) {
    return dateOnly;
  }

  return addDaysToDateOnly(dateOnly, -1);
}

async function resolveLinkedEpicForHabit(params: {
  supabase: any;
  userId: string;
  habitId: string;
}): Promise<LinkedEpic | null> {
  const { data: links, error: linksError } = await params.supabase
    .from("epic_habits")
    .select("epic_id")
    .eq("habit_id", params.habitId);

  if (linksError) throw linksError;

  const epicIds = [
    ...new Set(
      (links ?? [])
        .map((row: { epic_id?: string | null }) => row.epic_id)
        .filter((value: string | null | undefined): value is string =>
          typeof value === "string" && value.length > 0
        ),
    ),
  ];
  if (epicIds.length === 0) return null;

  const { data: epics, error: epicsError } = await params.supabase
    .from("epics")
    .select("id, title")
    .in("id", epicIds)
    .eq("user_id", params.userId)
    .eq("status", "active")
    .limit(1);

  if (epicsError) throw epicsError;

  const epic = Array.isArray(epics) ? epics[0] : null;
  if (!epic?.id) return null;

  return {
    id: String(epic.id),
    title: typeof epic.title === "string" ? epic.title : null,
  };
}

function buildRitualTaskMetadata(
  template: RitualTaskTemplate,
  linkedEpic: LinkedEpic | null,
) {
  const difficulty = normalizeDifficulty(template.difficulty);

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

function buildRitualTaskUpdatePayload(
  existingTask: RemoteTaskRow,
  nextTask: RemoteTaskRow,
) {
  const updates: Record<string, unknown> = {};

  if (existingTask.task_text !== nextTask.task_text) {
    updates.task_text = nextTask.task_text;
  }
  if (existingTask.difficulty !== nextTask.difficulty) {
    updates.difficulty = nextTask.difficulty;
  }
  if (existingTask.xp_reward !== nextTask.xp_reward) {
    updates.xp_reward = nextTask.xp_reward;
  }
  if (existingTask.scheduled_time !== nextTask.scheduled_time) {
    updates.scheduled_time = nextTask.scheduled_time;
  }
  if (existingTask.estimated_duration !== nextTask.estimated_duration) {
    updates.estimated_duration = nextTask.estimated_duration;
  }
  if (existingTask.category !== nextTask.category) {
    updates.category = nextTask.category;
  }
  if (existingTask.reminder_enabled !== nextTask.reminder_enabled) {
    updates.reminder_enabled = nextTask.reminder_enabled;
  }
  if (
    existingTask.reminder_minutes_before !== nextTask.reminder_minutes_before
  ) {
    updates.reminder_minutes_before = nextTask.reminder_minutes_before;
  }
  if (existingTask.epic_id !== nextTask.epic_id) {
    updates.epic_id = nextTask.epic_id;
  }

  return updates;
}

function getNextSortOrderForDate(taskDate: string, tasks: RemoteTaskRow[]) {
  return tasks
    .filter((task) => task.task_date === taskDate)
    .reduce((highest, task) => {
      const sortOrder = task.sort_order ?? -1;
      return sortOrder > highest ? sortOrder : highest;
    }, -1) + 1;
}

async function getQuestPositionForDate(params: {
  supabase: any;
  userId: string;
  taskDate: string | null;
}) {
  if (!params.taskDate) return 1;

  const { count, error } = await params.supabase
    .from("daily_tasks")
    .select("id", { count: "exact", head: true })
    .eq("user_id", params.userId)
    .eq("task_date", params.taskDate);

  if (error) throw error;

  return (count ?? 0) + 1;
}

function buildNewRitualTask(params: {
  template: RitualTaskTemplate;
  taskDate: string;
  linkedEpic: LinkedEpic | null;
  allTasks: RemoteTaskRow[];
}) {
  const metadata = buildRitualTaskMetadata(params.template, params.linkedEpic);

  return {
    id: crypto.randomUUID(),
    user_id: params.template.userId,
    task_text: metadata.task_text,
    difficulty: metadata.difficulty,
    xp_reward: metadata.xp_reward,
    task_date: params.taskDate,
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
    habit_source_id: params.template.habitId,
    epic_id: metadata.epic_id,
    epic_title: metadata.epic_title,
    sort_order: getNextSortOrderForDate(params.taskDate, params.allTasks),
    contact_id: null,
    auto_log_interaction: true,
    image_url: null,
    notes: null,
    location: null,
  };
}

export async function executeAction(params: {
  supabase: any;
  userId: string;
  action: PendingActionRow;
}) {
  const payload = params.action.normalized_payload;

  switch (params.action.action_type) {
    case "task_create": {
      const title = String(payload.title ?? "New task").trim() || "New task";
      const taskDate = typeof payload.task_date === "string"
        ? payload.task_date
        : null;
      const difficulty = normalizeDifficulty(payload.difficulty);
      const recurrencePayload = buildTaskRecurrencePayload({
        recurrencePattern: payload.recurrence_pattern,
        recurrenceDays: payload.recurrence_days,
        recurrenceMonthDays: payload.recurrence_month_days,
        recurrenceCustomPeriod: payload.recurrence_custom_period,
        recurrenceEndDate: payload.recurrence_end_date,
      });
      const questPosition = await getQuestPositionForDate({
        supabase: params.supabase,
        userId: params.userId,
        taskDate,
      });
      const xpReward = getEffectiveQuestXP(difficulty, questPosition);
      const reminderMinutesBefore =
        typeof payload.reminder_minutes_before === "number"
          ? payload.reminder_minutes_before
          : 15;
      const subtasks = normalizeSubtaskTitles(payload.subtasks);
      const insertPayload = {
        user_id: params.userId,
        task_text: title,
        difficulty,
        xp_reward: xpReward,
        task_date: taskDate,
        scheduled_time: typeof payload.scheduled_time === "string"
          ? payload.scheduled_time
          : null,
        estimated_duration: typeof payload.estimated_duration === "number"
          ? payload.estimated_duration
          : null,
        ...recurrencePayload,
        notes: typeof payload.notes === "string" ? payload.notes : null,
        location: typeof payload.location === "string"
          ? payload.location
          : null,
        category: typeof payload.category === "string"
          ? payload.category
          : categorizeQuest(title),
        epic_id: typeof payload.epic_id === "string" ? payload.epic_id : null,
        priority: typeof payload.priority === "string"
          ? payload.priority
          : null,
        contact_id: typeof payload.contact_id === "string"
          ? payload.contact_id
          : null,
        auto_log_interaction: payload.auto_log_interaction === false
          ? false
          : true,
        image_url: typeof payload.image_url === "string"
          ? payload.image_url
          : null,
        reminder_enabled: payload.reminder_enabled === true,
        reminder_minutes_before: reminderMinutesBefore,
        source: normalizeTaskSource(payload.source, taskDate),
      };

      const { data, error } = await params.supabase
        .from("daily_tasks")
        .insert(insertPayload)
        .select("id, task_text, task_date, scheduled_time")
        .single();

      if (error) throw error;

      let subtaskPersistWarning = false;
      let subtasksCreated = 0;

      if (subtasks.length > 0) {
        const { error: subtaskError } = await params.supabase
          .from("subtasks")
          .insert(
            subtasks.map((subtaskTitle, index) => ({
              user_id: params.userId,
              task_id: data.id,
              title: subtaskTitle,
              completed: false,
              completed_at: null,
              sort_order: index,
            })),
          );

        if (subtaskError) {
          console.error(
            "Failed to persist companion-agent task subtasks:",
            subtaskError,
          );
          subtaskPersistWarning = true;
        } else {
          subtasksCreated = subtasks.length;
        }
      }

      return {
        receiptMessage: subtaskPersistWarning
          ? `Got it — "${data.task_text}" added for ${
            taskScheduleLabel(data as Record<string, unknown>)
          }. I couldn't finish the step breakdown yet.`
          : `Got it — "${data.task_text}" added for ${
            taskScheduleLabel(data as Record<string, unknown>)
          }.`,
        executionResult: {
          task_id: data.id,
          task: data,
          subtasks_created: subtasksCreated,
          subtask_persist_warning: subtaskPersistWarning,
        },
      };
    }
    case "task_update": {
      const taskId = String(payload.task_id ?? "");
      const patch = Object.fromEntries(
        Object.entries({
          task_text: payload.title,
          task_date: payload.task_date,
          scheduled_time: payload.scheduled_time,
          estimated_duration: payload.estimated_duration,
          notes: payload.notes,
          location: payload.location,
          priority: payload.priority,
          completed: payload.completed,
          reminder_enabled: payload.reminder_enabled,
          reminder_minutes_before: payload.reminder_minutes_before,
        }).filter(([, value]) => value !== undefined),
      );

      const { data, error } = await params.supabase
        .from("daily_tasks")
        .update(patch)
        .eq("id", taskId)
        .eq("user_id", params.userId)
        .select("id, task_text, task_date, scheduled_time")
        .single();

      if (error) throw error;

      return {
        receiptMessage: `Got it — "${data.task_text}" is updated.`,
        executionResult: {
          task_id: data.id,
          task: data,
        },
      };
    }
    case "ritual_create": {
      const epicId = typeof payload.epic_id === "string"
        ? payload.epic_id
        : null;
      const normalizedSchedule = normalizeRitualSchedule({
        frequency: String(payload.frequency ?? "daily"),
        customDays: toNumberArray(payload.custom_days, { min: 0, max: 6 }),
        customMonthDays: toNumberArray(payload.custom_month_days, {
          min: 1,
          max: 31,
        }),
      });
      const reminderMinutesBefore =
        typeof payload.reminder_minutes_before === "number"
          ? payload.reminder_minutes_before
          : 15;
      const { data, error } = await params.supabase
        .from("habits")
        .insert({
          user_id: params.userId,
          title: String(payload.title ?? "New ritual").trim() || "New ritual",
          difficulty: normalizeDifficulty(payload.difficulty),
          frequency: normalizedSchedule.frequency,
          preferred_time: typeof payload.preferred_time === "string"
            ? payload.preferred_time
            : null,
          estimated_minutes: typeof payload.estimated_minutes === "number"
            ? payload.estimated_minutes
            : null,
          description: typeof payload.description === "string"
            ? payload.description
            : null,
          category: typeof payload.category === "string"
            ? payload.category
            : null,
          custom_days: normalizedSchedule.custom_days,
          custom_month_days: normalizedSchedule.custom_month_days,
          reminder_enabled: payload.reminder_enabled === true,
          reminder_minutes_before: reminderMinutesBefore,
          is_active: true,
        })
        .select("id, title")
        .single();

      if (error) throw error;

      if (epicId) {
        const { error: epicLinkError } = await params.supabase
          .from("epic_habits")
          .insert({
            epic_id: epicId,
            habit_id: data.id,
          });
        if (epicLinkError) {
          await params.supabase
            .from("habits")
            .delete()
            .eq("id", data.id)
            .eq("user_id", params.userId);
          throw epicLinkError;
        }
      }

      return {
        receiptMessage: `Got it — ritual "${data.title}" is set.`,
        executionResult: {
          ritual_id: data.id,
          ritual: data,
          epic_id: epicId,
          normalized_schedule: normalizedSchedule,
        },
      };
    }
    case "ritual_update": {
      const habitId = String(payload.habit_id ?? "");
      if (!habitId) {
        throw new Error("Missing ritual id for update");
      }

      const normalizedSchedule = normalizeRitualSchedule({
        frequency: String(payload.frequency ?? "daily"),
        customDays: toNumberArray(payload.custom_days, { min: 0, max: 6 }),
        customMonthDays: toNumberArray(payload.custom_month_days, {
          min: 1,
          max: 31,
        }),
      });
      const habitUpdatePayload = {
        title: String(payload.title ?? "Updated ritual").trim(),
        description: typeof payload.description === "string"
          ? payload.description.trim() || null
          : null,
        difficulty: normalizeDifficulty(payload.difficulty),
        frequency: normalizedSchedule.frequency,
        estimated_minutes: typeof payload.estimated_minutes === "number"
          ? payload.estimated_minutes
          : null,
        preferred_time: typeof payload.preferred_time === "string"
          ? payload.preferred_time
          : null,
        category: typeof payload.category === "string"
          ? payload.category
          : null,
        custom_days: normalizedSchedule.custom_days,
        custom_month_days: normalizedSchedule.custom_month_days,
        reminder_enabled: payload.reminder_enabled === true,
        reminder_minutes_before:
          typeof payload.reminder_minutes_before === "number"
            ? payload.reminder_minutes_before
            : 15,
      };

      const { error: habitError } = await params.supabase
        .from("habits")
        .update(habitUpdatePayload)
        .eq("id", habitId)
        .eq("user_id", params.userId);

      if (habitError) throw habitError;

      const today = resolveEffectiveMissionDate(
        typeof params.action.metadata?.currentDateTime === "string"
          ? params.action.metadata.currentDateTime
          : null,
      );
      const horizonEndDate = addDaysToDateOnly(
        today,
        RITUAL_RECONCILIATION_WINDOW_DAYS,
      );
      const { data: futureTasks, error: tasksError } = await params.supabase
        .from("daily_tasks")
        .select(
          "id, user_id, task_text, difficulty, xp_reward, task_date, completed, completed_at, is_main_quest, scheduled_time, estimated_duration, recurrence_pattern, recurrence_days, recurrence_month_days, recurrence_custom_period, recurrence_end_date, is_recurring, reminder_enabled, reminder_minutes_before, category, is_bonus, created_at, priority, is_top_three, actual_time_spent, ai_generated, context_id, source, habit_source_id, epic_id, epic_title, sort_order, contact_id, auto_log_interaction, image_url, notes, location, parent_template_id",
        )
        .eq("user_id", params.userId)
        .gte("task_date", today)
        .lte("task_date", horizonEndDate);

      if (tasksError) throw tasksError;

      const linkedEpic = await resolveLinkedEpicForHabit({
        supabase: params.supabase,
        userId: params.userId,
        habitId,
      });
      const template: RitualTaskTemplate = {
        habitId,
        userId: params.userId,
        title: habitUpdatePayload.title,
        difficulty: habitUpdatePayload.difficulty,
        estimated_minutes: habitUpdatePayload.estimated_minutes,
        preferred_time: habitUpdatePayload.preferred_time,
        category: habitUpdatePayload.category,
        reminder_enabled: habitUpdatePayload.reminder_enabled,
        reminder_minutes_before: habitUpdatePayload.reminder_minutes_before,
        frequency: habitUpdatePayload.frequency,
        custom_days: habitUpdatePayload.custom_days,
        custom_month_days: habitUpdatePayload.custom_month_days,
        customPeriod: normalizedSchedule.customPeriod,
      };
      const allFutureTasks = (futureTasks ?? []) as RemoteTaskRow[];
      const futureHabitTasks = allFutureTasks.filter((task) =>
        task.habit_source_id === habitId &&
        typeof task.task_date === "string" &&
        task.task_date >= today
      );
      const tasksByDate = new Map<string, RemoteTaskRow>();
      futureHabitTasks.forEach((task) => {
        if (task.task_date) {
          tasksByDate.set(task.task_date, task);
        }
      });

      const evaluationDates = new Set<string>(tasksByDate.keys());
      for (
        let offset = 0;
        offset <= RITUAL_RECONCILIATION_WINDOW_DAYS;
        offset += 1
      ) {
        evaluationDates.add(addDaysToDateOnly(today, offset));
      }

      const createdTasks: RemoteTaskRow[] = [];
      let updatedCount = 0;
      let deletedCount = 0;

      for (const taskDate of [...evaluationDates].sort()) {
        const targetDate = new Date(`${taskDate}T00:00:00.000Z`);
        const scheduled = isRitualScheduledForDate(
          {
            frequency: template.frequency,
            custom_days: template.custom_days,
            custom_month_days: template.custom_month_days,
            customPeriod: template.customPeriod,
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

            const metadata = buildRitualTaskMetadata(template, linkedEpic);
            const nextTask: RemoteTaskRow = {
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
            const updates = buildRitualTaskUpdatePayload(
              existingTask,
              nextTask,
            );

            if (Object.keys(updates).length > 0) {
              const { error: updateTaskError } = await params.supabase
                .from("daily_tasks")
                .update(updates)
                .eq("id", existingTask.id)
                .eq("user_id", params.userId);
              if (updateTaskError) throw updateTaskError;
              updatedCount += 1;
            }
            continue;
          }

          const newTask = buildNewRitualTask({
            template,
            taskDate,
            linkedEpic,
            allTasks: [...allFutureTasks, ...createdTasks],
          });
          const { error: createTaskError } = await params.supabase
            .from("daily_tasks")
            .insert(newTask);
          if (createTaskError) throw createTaskError;
          createdTasks.push(newTask);
          continue;
        }

        if (existingTask && existingTask.completed !== true) {
          const { error: deleteTaskError } = await params.supabase
            .from("daily_tasks")
            .delete()
            .eq("id", existingTask.id)
            .eq("user_id", params.userId);
          if (deleteTaskError) throw deleteTaskError;
          deletedCount += 1;
        }
      }

      return {
        receiptMessage:
          `Got it — ritual "${habitUpdatePayload.title}" is updated and upcoming quests are synced.`,
        executionResult: {
          ritual_id: habitId,
          created_count: createdTasks.length,
          updated_count: updatedCount,
          deleted_count: deletedCount,
          normalized_schedule: normalizedSchedule,
        },
      };
    }
    case "reminder_create": {
      const targetType = String(payload.target_type ?? "");
      const targetId = String(payload.target_id ?? "");
      const patch = {
        reminder_enabled: payload.reminder_enabled !== false,
        reminder_minutes_before:
          typeof payload.reminder_minutes_before === "number"
            ? payload.reminder_minutes_before
            : null,
      };

      if (targetType === "task") {
        const { error } = await params.supabase
          .from("daily_tasks")
          .update(patch)
          .eq("id", targetId)
          .eq("user_id", params.userId);
        if (error) throw error;
      } else if (targetType === "ritual") {
        const { error } = await params.supabase
          .from("habits")
          .update(patch)
          .eq("id", targetId)
          .eq("user_id", params.userId);
        if (error) throw error;
      } else {
        throw new Error("Unsupported reminder target");
      }

      return {
        receiptMessage: "Got it — reminder set.",
        executionResult: {
          target_type: targetType,
          target_id: targetId,
        },
      };
    }
    case "campaign_create": {
      const campaignId = crypto.randomUUID();
      const now = new Date().toISOString();
      const startDate = now.slice(0, 10);
      const targetDays = typeof payload.target_days === "number" &&
          Number.isFinite(payload.target_days)
        ? Math.max(1, Math.round(payload.target_days))
        : 30;
      const rawHabits = Array.isArray(payload.habits) ? payload.habits : [];
      if (rawHabits.length === 0) {
        throw new Error("Campaign create requires at least one ritual");
      }

      const campaignInsert = {
        id: campaignId,
        user_id: params.userId,
        title: String(payload.title ?? "New campaign"),
        description: typeof payload.description === "string"
          ? payload.description
          : null,
        status: "active",
        progress_percentage: 0,
        target_days: targetDays,
        start_date: startDate,
        end_date: resolveCampaignEndDate(startDate, targetDays),
        xp_reward: Math.floor(targetDays * 10),
        is_public: false,
        invite_code: buildCampaignInviteCode(),
        theme_color: normalizeThemeColor(payload.theme_color),
        story_type_slug: typeof payload.story_type_slug === "string"
          ? payload.story_type_slug
          : null,
        created_at: now,
        updated_at: now,
      };

      const { data: campaign, error: campaignError } = await params.supabase
        .from("epics")
        .insert(campaignInsert)
        .select("id, title, target_days, end_date")
        .single();

      if (campaignError) throw campaignError;

      const habitsToInsert = rawHabits.map((habit) => ({
        id: crypto.randomUUID(),
        user_id: params.userId,
        title: typeof habit?.title === "string"
          ? habit.title
          : "Starter ritual",
        description: typeof habit?.description === "string"
          ? habit.description
          : null,
        difficulty: normalizeDifficulty(habit?.difficulty),
        frequency: normalizeFrequency(habit?.frequency),
        custom_days: toNumberArray(habit?.custom_days, { min: 0, max: 6 }),
        custom_month_days: toNumberArray(habit?.custom_month_days, {
          min: 1,
          max: 31,
        }),
        preferred_time: typeof habit?.preferred_time === "string"
          ? habit.preferred_time
          : null,
        reminder_enabled: habit?.reminder_enabled === true,
        reminder_minutes_before:
          typeof habit?.reminder_minutes_before === "number"
            ? habit.reminder_minutes_before
            : 15,
        estimated_minutes: typeof habit?.estimated_minutes === "number"
          ? habit.estimated_minutes
          : null,
        category: typeof habit?.category === "string" ? habit.category : null,
        is_active: true,
        current_streak: 0,
        longest_streak: 0,
        created_at: now,
      }));

      try {
        const { error: habitError } = await params.supabase
          .from("habits")
          .insert(habitsToInsert);
        if (habitError) throw habitError;

        const { error: linkError } = await params.supabase
          .from("epic_habits")
          .insert(
            habitsToInsert.map((habit) => ({
              epic_id: campaignId,
              habit_id: habit.id,
            })),
          );
        if (linkError) throw linkError;
      } catch (error) {
        try {
          await params.supabase
            .from("epic_habits")
            .delete()
            .eq("epic_id", campaignId);
          await params.supabase
            .from("habits")
            .delete()
            .in("id", habitsToInsert.map((habit) => habit.id))
            .eq("user_id", params.userId);
          await params.supabase
            .from("epics")
            .delete()
            .eq("id", campaignId)
            .eq("user_id", params.userId);
        } catch (_cleanupError) {
          // Best-effort rollback only; surface the original failure.
        }
        throw error;
      }

      return {
        receiptMessage: `Got it — campaign "${campaign.title}" is created.`,
        executionResult: {
          campaign_id: campaign.id,
          campaign,
          ritual_ids: habitsToInsert.map((habit) => habit.id),
        },
      };
    }
    case "campaign_adjust": {
      const campaignId = String(payload.campaign_id ?? "");
      if (!campaignId) {
        throw new Error("Missing campaign id for campaign adjustment");
      }

      const adjustmentType = typeof payload.adjustment_type === "string"
        ? payload.adjustment_type
        : "custom";
      const reason = typeof payload.reason === "string" ? payload.reason : null;
      const requestedSummary = typeof payload.requested_summary === "string"
        ? payload.requested_summary
        : null;
      const requestText = reason ?? requestedSummary;

      const { data: adjustmentResult, error: adjustmentError } = await params
        .supabase.functions.invoke(
          "adjust-epic-plan",
          {
            body: {
              epicId: campaignId,
              adjustmentType,
              reason: reason ?? undefined,
              customRequest: requestText ?? undefined,
            },
          },
        );

      if (adjustmentError) throw adjustmentError;

      const suggestions = Array.isArray(
          (adjustmentResult as { suggestions?: unknown[] } | null)?.suggestions,
        )
        ? (adjustmentResult as { suggestions: unknown[] }).suggestions
        : [];

      if (suggestions.length === 0) {
        throw new Error("No campaign adjustments were generated.");
      }

      const { data: applyResult, error: applyError } = await params.supabase
        .functions.invoke(
          "apply-epic-adjustments",
          {
            body: {
              epicId: campaignId,
              adjustments: suggestions,
              adjustmentType,
              reason: requestText ?? undefined,
            },
          },
        );

      if (applyError) throw applyError;

      const appliedChanges = Array.isArray(
          (applyResult as { appliedChanges?: unknown[] } | null)
            ?.appliedChanges,
        )
        ? (applyResult as { appliedChanges: unknown[] }).appliedChanges
          .filter((entry): entry is string => typeof entry === "string")
        : [];
      const message =
        typeof (applyResult as { message?: unknown } | null)?.message ===
            "string"
          ? (applyResult as { message: string }).message
          : null;

      return {
        receiptMessage: message
          ? `Got it — ${message.charAt(0).toLowerCase()}${message.slice(1)}.`
          : `Got it — applied ${suggestions.length} campaign adjustment${
            suggestions.length === 1 ? "" : "s"
          }.`,
        executionResult: {
          campaign_id: campaignId,
          adjustment_type: adjustmentType,
          request_text: requestText,
          suggestions,
          applied_changes: appliedChanges,
        },
      };
    }
    case "campaign_update": {
      const campaignId = String(payload.campaign_id ?? "");
      const patch = Object.fromEntries(
        Object.entries({
          title: payload.title,
          description: payload.description,
          end_date: payload.end_date,
          status: payload.status,
          target_days: payload.target_days,
          updated_at: new Date().toISOString(),
        }).filter(([, value]) => value !== undefined),
      );

      const { data, error } = await params.supabase
        .from("epics")
        .update(patch)
        .eq("id", campaignId)
        .eq("user_id", params.userId)
        .select("id, title")
        .single();

      if (error) throw error;

      return {
        receiptMessage: `Got it — campaign "${data.title}" is updated.`,
        executionResult: {
          campaign_id: data.id,
          campaign: data,
        },
      };
    }
    case "journal_entry": {
      const reflectionDate = typeof payload.reflection_date === "string"
        ? payload.reflection_date
        : new Date().toISOString().slice(0, 10);
      const { data, error } = await params.supabase
        .from("user_reflections")
        .insert({
          user_id: params.userId,
          mood: typeof payload.mood === "string" ? payload.mood : "neutral",
          note: typeof payload.note === "string" ? payload.note : null,
          reflection_date: reflectionDate,
        })
        .select("id, reflection_date")
        .single();

      if (error) throw error;

      return {
        receiptMessage: "Saved that to your journal.",
        executionResult: {
          journal_entry_id: data.id,
          reflection_date: data.reflection_date,
        },
      };
    }
    default:
      throw new Error(`Unsupported action type: ${params.action.action_type}`);
  }
}

export async function confirmPendingAction(params: {
  supabase: any;
  userId: string;
  sessionId: string;
  actionId?: string;
}) {
  const action = await resolveActivePendingAction(params);
  if (!action) {
    throw new Error("No pending action found");
  }

  const thread = await loadThread(
    params.supabase,
    params.userId,
    params.sessionId,
  );
  if (!thread) throw new Error("Thread not found");

  if (action.status === "executed") {
    return {
      action,
      receipt: buildReceipt({
        action,
        status: "executed",
        message: "That action was already confirmed.",
        executionResult: action.execution_result,
      }),
      thread,
      pendingAction: null,
    };
  }

  if (action.status !== "pending") {
    throw new Error(`Action is not pending: ${action.status}`);
  }

  if (new Date(action.expires_at).getTime() <= Date.now()) {
    const expired = await updatePendingAction(params.supabase, action.id, {
      status: "expired",
    });
    return {
      action: expired,
      receipt: buildReceipt({
        action: expired,
        status: "failed",
        message: "That confirmation expired, so I didn’t apply it.",
        executionError: { code: "expired" },
      }),
      thread,
      pendingAction: null,
    };
  }

  await updatePendingAction(params.supabase, action.id, {
    status: "confirmed",
    confirmed_at: new Date().toISOString(),
  });

  try {
    const execution = await executeAction({
      supabase: params.supabase,
      userId: params.userId,
      action,
    });

    const executed = await updatePendingAction(params.supabase, action.id, {
      status: "executed",
      executed_at: new Date().toISOString(),
      execution_result: execution.executionResult,
      execution_error: null,
    });

    const receipt = buildReceipt({
      action: executed,
      status: "executed",
      message: execution.receiptMessage,
      executionResult: execution.executionResult,
    });

    await persistActionReceipt({
      supabase: params.supabase,
      userId: params.userId,
      companionId: thread.companion_id,
      sessionId: params.sessionId,
      surface: thread.surface,
      userMessage: "Confirm",
      assistantReply: receipt.message,
    });

    return {
      action: executed,
      receipt,
      thread,
      pendingAction: null,
    };
  } catch (error) {
    const executionError = {
      message: error instanceof Error ? error.message : String(error),
    };
    const failed = await updatePendingAction(params.supabase, action.id, {
      status: "failed",
      execution_error: executionError,
    });

    const receipt = buildReceipt({
      action: failed,
      status: "failed",
      message: "I couldn’t complete that change. Nothing else was applied.",
      executionError,
    });

    await persistActionReceipt({
      supabase: params.supabase,
      userId: params.userId,
      companionId: thread.companion_id,
      sessionId: params.sessionId,
      surface: thread.surface,
      userMessage: "Confirm",
      assistantReply: receipt.message,
    });

    return {
      action: failed,
      receipt,
      thread,
      pendingAction: null,
    };
  }
}

export async function cancelPendingAction(params: {
  supabase: any;
  userId: string;
  sessionId: string;
  actionId?: string;
}) {
  const action = await resolveActivePendingAction(params);
  if (!action) {
    throw new Error("No pending action found");
  }

  const thread = await loadThread(
    params.supabase,
    params.userId,
    params.sessionId,
  );
  if (!thread) throw new Error("Thread not found");

  if (action.status === "cancelled") {
    return {
      action,
      receipt: buildReceipt({
        action,
        status: "cancelled",
        message: "Okay, I won’t schedule that.",
      }),
      thread,
      pendingAction: null,
    };
  }

  const cancelled = await updatePendingAction(params.supabase, action.id, {
    status: "cancelled",
    cancelled_at: new Date().toISOString(),
  });

  const receipt = buildReceipt({
    action: cancelled,
    status: "cancelled",
    message: "Okay, I won’t schedule that.",
  });

  await persistActionReceipt({
    supabase: params.supabase,
    userId: params.userId,
    companionId: thread.companion_id,
    sessionId: params.sessionId,
    surface: thread.surface,
    userMessage: "Cancel",
    assistantReply: receipt.message,
  });

  return {
    action: cancelled,
    receipt,
    thread,
    pendingAction: null,
  };
}
