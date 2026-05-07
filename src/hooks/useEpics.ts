import { useCallback, useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { toast } from "@/components/ui/sonner";
import { useXPRewards } from "@/hooks/useXPRewards";
import { CAMPAIGN_XP_REWARDS } from "@/config/xpRewards";
import { useAIInteractionTracker } from "@/hooks/useAIInteractionTracker";
import { useAchievements } from "@/hooks/useAchievements";
import { addDays, format, getDay } from "date-fns";
import type { DailyTask } from "@/services/dailyTasksRemote";
import type { StoryTypeSlug } from "@/types/narrativeTypes";
import { getEpicsQueryKey, type EpicRecord } from "@/hooks/epicsQuery";
import { DAILY_PLAN_OPTIMIZATION_QUERY_KEY } from "@/hooks/useDailyPlanOptimization";
import { requestJourneyPathGeneration } from "@/utils/journeyPathCache";
import { useResilience } from "@/contexts/ResilienceContext";
import {
  ACTIVE_CAMPAIGN_LIMIT,
  ACTIVE_CAMPAIGN_LIMIT_MESSAGE,
  hasReachedActiveCampaignLimit,
  isActiveCampaignLimitHaystack,
} from "@/features/epics/constants";
import {
  PLANNER_SYNC_EVENT,
  dispatchPlannerSyncFinished,
  loadLocalEpics,
  withPlannerRemoteSyncLock,
  warmEpicsQueryFromRemote,
} from "@/utils/plannerSync";
import { resolveEpicEndDate } from "@/utils/epicDates";
import { isQueueableWriteError } from "@/utils/networkErrors";
import { trackResilienceEvent } from "@/utils/resilienceTelemetry";
import {
  forgetDeletedPlannerEntities,
  normalizeDeletedPlannerEntities,
  type DeletedPlannerEntity,
} from "@/utils/deletedPlannerMemory";
import {
  createOfflinePlannerId,
  getAllLocalTasksForUser,
  getLocalEpicHabits,
  getLocalHabitCompletions,
  getLocalHabits,
  getLocalJourneyPaths,
  getLocalJourneyPhases,
  getLocalEpicMilestones,
  removePlannerRecord,
  removePlannerRecords,
  upsertPlannerRecord,
  upsertPlannerRecords,
} from "@/utils/plannerLocalStore";
import { toRemoteEpicInsertPayload } from "@/utils/epicRemotePayload";
import { getQueuedActions, type QueuedAction } from "@/utils/offlineStorage";
import { runDailyTaskCleanupUpdate } from "@/utils/supabaseDailyTaskCleanup";
import {
  isValidCampaignMilestonePercent,
  normalizeCampaignMilestonePercentArray,
} from "@/utils/campaignMilestones";
import {
  normalizeRitualSchedule,
  reconcileHabitLinkedTasks,
  type HabitTaskReconciliationResult,
  type HabitTaskTemplate,
  type NormalizedRitualSchedule,
} from "@/hooks/habitTaskReconciliation";
import { isHabitScheduledForDate } from "@/utils/habitSchedule";

const normalizeDifficulty = (value: string): "easy" | "medium" | "hard" => {
  const lower = value?.toLowerCase()?.trim() || "medium";
  if (["easy", "simple", "beginner", "low"].includes(lower)) return "easy";
  if (["hard", "difficult", "advanced", "high", "challenging"].includes(lower)) return "hard";
  return "medium";
};

const normalizeFrequency = (value: string): "daily" | "5x_week" | "3x_week" | "monthly" | "custom" => {
  const lower = value?.toLowerCase()?.trim()?.replace(/\s+/g, "_") || "daily";
  if (["daily", "everyday", "every_day", "7x_week", "7x"].includes(lower)) return "daily";
  if (["5x_week", "5x", "weekdays", "five_times", "5_times"].includes(lower)) return "5x_week";
  if (["3x_week", "3x", "three_times", "3_times", "thrice"].includes(lower)) return "3x_week";
  if (["monthly", "month", "every_month"].includes(lower)) return "monthly";
  if (["weekly", "biweekly", "twice", "2x", "2x_week", "once", "1x", "custom", "twice_daily"].includes(lower)) return "custom";
  return "daily";
};

const normalizeThemeColor = (value: string | undefined): "heroic" | "warrior" | "mystic" | "nature" | "solar" => {
  if (!value) return "heroic";
  const lower = value.toLowerCase().trim();

  if (["heroic", "warrior", "mystic", "nature", "solar"].includes(lower)) {
    return lower as "heroic" | "warrior" | "mystic" | "nature" | "solar";
  }

  const hexMap: Record<string, "heroic" | "warrior" | "mystic" | "nature" | "solar"> = {
    "#f59e0b": "heroic",
    "#ef4444": "warrior",
    "#10b981": "nature",
    "#ec4899": "mystic",
    "#f97316": "solar",
    "#8b5cf6": "mystic",
    "#3b82f6": "heroic",
    "#475569": "warrior",
  };

  return hexMap[lower] || "heroic";
};

interface EpicsOptions {
  enabled?: boolean;
}

type ErrorLike = {
  message?: string;
  details?: string;
  hint?: string;
  code?: string;
};

const toErrorHaystack = (error: unknown): string => {
  if (!error) return "";

  if (typeof error === "string") {
    return error.toLowerCase();
  }

  if (error instanceof Error) {
    return error.message.toLowerCase();
  }

  if (typeof error === "object") {
    const candidate = error as ErrorLike;
    return `${candidate.message ?? ""} ${candidate.details ?? ""} ${candidate.hint ?? ""} ${candidate.code ?? ""}`.toLowerCase();
  }

  return "";
};

const isLegacyMonthSchemaError = (error: unknown): boolean => {
  const haystack = toErrorHaystack(error);

  return (
    haystack.includes("custom_month_days") ||
    (haystack.includes("habits_frequency_check") && haystack.includes("monthly")) ||
    (haystack.includes("frequency") && haystack.includes("monthly") && haystack.includes("check"))
  );
};

export const normalizeCreateCampaignError = (error: unknown): { title: string; description?: string } => {
  const haystack = toErrorHaystack(error);

  if (isActiveCampaignLimitHaystack(haystack)) {
    return {
      title: "Campaign limit reached",
      description: ACTIVE_CAMPAIGN_LIMIT_MESSAGE,
    };
  }

  if (haystack.includes("not authenticated") || haystack.includes("jwt") || haystack.includes("auth")) {
    return {
      title: "Sign in required",
      description: "Please refresh and sign in again before creating a campaign.",
    };
  }

  if (haystack.includes("maximum active habit limit reached")) {
    return {
      title: "Too many active rituals",
      description: "Your account hit a legacy ritual limit. Update your app data and try creating this campaign again.",
    };
  }

  if (isLegacyMonthSchemaError(error)) {
    return {
      title: "Campaign setup update needed",
      description: "Your planner data is missing a recent ritual scheduling update. Please try again shortly.",
    };
  }

  if (
    haystack.includes("invalid input syntax for type integer")
    || haystack.includes("22p02")
    || haystack.includes("milestone_percent")
  ) {
    return {
      title: "Campaign plan needs an update",
      description: "One of the generated milestones had an invalid percentage. Rebuild the plan and try again.",
    };
  }

  if (haystack.includes("daily_tasks_regular_requires_time_or_inbox")) {
    return {
      title: "Campaign cleanup needs attention",
      description: "We couldn't finish cleaning up a failed campaign save. Refresh your planner and try again.",
    };
  }

  if (haystack.includes("failed to create habits") || haystack.includes("no habits were created")) {
    return {
      title: "Campaign needs attention",
      description: "We couldn't finish saving every part of this campaign. Please review it and try again.",
    };
  }

  return {
    title: "Campaign couldn't be saved",
    description: "We couldn't finish saving every part of this campaign. Please review it and try again.",
  };
};

type LocalHabitRow = {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  difficulty: string | null;
  frequency: string;
  custom_days: number[] | null;
  custom_month_days: number[] | null;
  preferred_time: string | null;
  reminder_enabled: boolean | null;
  reminder_minutes_before: number | null;
  estimated_minutes: number | null;
  category: string | null;
  is_active: boolean | null;
  current_streak: number | null;
  longest_streak: number | null;
  created_at: string | null;
  sort_order?: number | null;
};

type LocalEpicRow = EpicRecord;

type LocalEpicPayload = {
  epic: LocalEpicRow;
  habits: LocalHabitRow[];
  epicHabits: Array<{ id: string; epic_id: string; habit_id: string }>;
  phases: Array<{ id: string; epic_id: string; user_id: string; name: string; description: string; start_date: string; end_date: string; phase_order: number }>;
  milestones: Array<{ id: string; epic_id: string; user_id: string; title: string; description: string | null; target_date: string; milestone_percent: number; is_postcard_milestone: boolean; phase_order: number; phase_name: string | null }>;
};

type LocalEpicHabitRow = {
  id: string;
  epic_id: string;
  habit_id: string;
};

type LocalCampaignRitualPayload = {
  habit: LocalHabitRow;
  epicHabit: LocalEpicHabitRow;
};

type TaskQueueAction = (
  type: "CREATE_TASK" | "UPDATE_TASK" | "DELETE_TASK",
  payload: unknown,
) => Promise<unknown>;

type HabitTaskReconciliationAggregate = HabitTaskReconciliationResult;

type CreateEpicInput = {
  title: string;
  description?: string;
  target_days: number;
  is_public?: boolean;
  theme_color?: string;
  story_type_slug?: StoryTypeSlug;
  habits: Array<{
    title: string;
    description?: string;
    difficulty: string;
    frequency: string;
    custom_days: number[];
    custom_month_days?: number[];
    preferred_time?: string | null;
    preferredTime?: string | null;
    reminder_enabled?: boolean;
    reminder_minutes_before?: number;
    estimated_minutes?: number | null;
    estimatedMinutes?: number | null;
    category?: string | null;
  }>;
  milestones?: Array<{
    title: string;
    description?: string;
    target_date: string;
    milestone_percent: number;
    is_postcard_milestone: boolean;
    phase_name?: string;
    phaseName?: string;
  }>;
  phases?: Array<{
    name: string;
    description: string;
    start_date: string;
    end_date: string;
    phase_order: number;
  }>;
};

type CreateEpicMutationResult = {
  queued: boolean;
  epic: LocalEpicRow;
  isNewCreate: boolean;
};

type EpicCreateMatch = {
  epic: LocalEpicRow;
  queued: boolean;
};

type FingerprintHabit = {
  title: string;
  description: string | null;
  difficulty: "easy" | "medium" | "hard";
  frequency: "daily" | "5x_week" | "3x_week" | "monthly" | "custom";
  custom_days: number[] | null;
  custom_month_days: number[] | null;
  preferred_time: string | null;
  estimated_minutes: number | null;
  category: string | null;
  reminder_enabled: boolean;
  reminder_minutes_before: number;
};

type FingerprintMilestone = {
  title: string;
  description: string | null;
  target_date: string;
  milestone_percent: number;
  is_postcard_milestone: boolean;
  phase_name: string | null;
};

type FingerprintPhase = {
  name: string;
  description: string | null;
  start_date: string;
  end_date: string;
  phase_order: number;
};

const RECENT_EPIC_CREATE_WINDOW_MS = 5 * 60 * 1000;
const RECENT_EPIC_CREATE_ATTEMPT_WINDOW_MS = 24 * 60 * 60 * 1000;
const EPIC_CREATE_ATTEMPT_STORAGE_KEY = "cosmiq:recent-epic-create-attempts:v1";
const inFlightEpicCreateRequests = new Map<string, Promise<CreateEpicMutationResult>>();
const recentEpicCreateAttempts = new Map<string, { createdAt: number; payload: LocalEpicPayload }>();

const wait = (ms: number) => new Promise<void>((resolve) => {
  window.setTimeout(resolve, ms);
});

type StoredEpicCreateAttempt = {
  fingerprint: string;
  createdAt: number;
  payload: LocalEpicPayload;
};

const getCampaignAttemptStorage = (): Storage | null => {
  if (typeof window === "undefined") return null;

  try {
    const storage = window.localStorage;
    return storage
      && typeof storage.getItem === "function"
      && typeof storage.setItem === "function"
      ? storage
      : null;
  } catch {
    return null;
  }
};

export interface CreateCampaignRitualInput {
  epicId: string;
  title: string;
  difficulty: string;
  frequency: string;
  customDays?: number[] | null;
  customMonthDays?: number[] | null;
  preferredTime?: string | null;
  estimatedMinutes?: number | null;
  description?: string | null;
  category?: string | null;
  reminderEnabled?: boolean | null;
  reminderMinutesBefore?: number | null;
}

export interface CreateCampaignRitualResult {
  queued: boolean;
  habit: LocalHabitRow;
  epicHabit: LocalEpicHabitRow;
}

export interface DeleteCampaignRitualInput {
  epicId: string;
  habitId: string;
}

type LocalTaskEpicTitleRow = {
  id: string;
  user_id: string;
  epic_id: string | null;
  epic_title?: string | null;
};

type LocalTaskCampaignCleanupRow = {
  id: string;
  user_id: string;
  task_text?: string | null;
  habit_source_id: string | null;
  epic_id: string | null;
  epic_title?: string | null;
  task_date: string | null;
  completed: boolean | null;
  completed_at?: string | null;
  excluded_from_planner_at?: string | null;
};

const buildDeletedPlannerEntitiesForCampaign = ({
  epic,
  habits,
  tasks,
}: {
  epic: LocalEpicRow;
  habits: LocalHabitRow[];
  tasks: LocalTaskCampaignCleanupRow[];
}): DeletedPlannerEntity[] => {
  const campaignEntity: DeletedPlannerEntity = {
    entityType: "campaign",
    entityId: epic.id,
    title: epic.title,
    metadata: {
      createdAt: epic.created_at ?? null,
    },
  };

  const ritualEntities = habits.map((habit): DeletedPlannerEntity => ({
    entityType: "ritual",
    entityId: habit.id,
    title: habit.title,
    metadata: {
      campaignId: epic.id,
      campaignTitle: epic.title,
    },
  }));

  const taskEntities = tasks.map((task): DeletedPlannerEntity => ({
    entityType: "task",
    entityId: task.id,
    title: task.task_text ?? null,
    metadata: {
      campaignId: epic.id,
      campaignTitle: epic.title,
      habitSourceId: task.habit_source_id ?? null,
      taskDate: task.task_date ?? null,
    },
  }));

  return [campaignEntity, ...ritualEntities, ...taskEntities];
};

function scrubCampaignRitualTaskRows<T>(rows: T | undefined, habitId: string): T | undefined {
  if (!Array.isArray(rows)) return rows;

  let changed = false;
  const excludedFromPlannerAt = new Date().toISOString();
  const nextRows = (rows as DailyTask[]).reduce<DailyTask[]>((next, task) => {
    if (task.habit_source_id !== habitId) {
      next.push(task);
      return next;
    }

    changed = true;
    if (task.completed === true || task.completed_at) {
      next.push({
        ...task,
        epic_id: null,
        epic_title: null,
        habit_source_id: null,
        excluded_from_planner_at: task.excluded_from_planner_at ??
          excludedFromPlannerAt,
      });
    }
    return next;
  }, []);

  return changed ? (nextRows as T) : rows;
}

function scrubCampaignRitualTaskCaches(
  queryClient: ReturnType<typeof useQueryClient>,
  habitId: string,
) {
  queryClient.setQueriesData({ queryKey: ["daily-tasks"] }, (old) =>
    scrubCampaignRitualTaskRows(old, habitId)
  );
  queryClient.setQueriesData({ queryKey: ["calendar-tasks"] }, (old) =>
    scrubCampaignRitualTaskRows(old, habitId)
  );
}

function scrubUnlinkedCampaignHabitTaskRows<T>(
  rows: T | undefined,
  { epicId, habitId }: DeleteCampaignRitualInput,
): T | undefined {
  if (!Array.isArray(rows)) return rows;

  let changed = false;
  const nextRows = (rows as DailyTask[]).map((task) => {
    if (task.habit_source_id !== habitId || task.epic_id !== epicId) {
      return task;
    }

    changed = true;
    return {
      ...task,
      epic_id: null,
      epic_title: null,
    };
  });

  return changed ? (nextRows as T) : rows;
}

function scrubUnlinkedCampaignHabitTaskCaches(
  queryClient: ReturnType<typeof useQueryClient>,
  input: DeleteCampaignRitualInput,
) {
  queryClient.setQueriesData({ queryKey: ["daily-tasks"] }, (old) =>
    scrubUnlinkedCampaignHabitTaskRows(old, input)
  );
  queryClient.setQueriesData({ queryKey: ["calendar-tasks"] }, (old) =>
    scrubUnlinkedCampaignHabitTaskRows(old, input)
  );
}

const normalizeFingerprintText = (value: string | null | undefined): string | null => {
  const normalized = value?.trim().replace(/\s+/g, " ") ?? "";
  return normalized.length > 0 ? normalized.toLowerCase() : null;
};

const CAMPAIGN_RITUAL_TIME_FALLBACKS = ["08:00", "10:00", "14:00", "17:00", "19:00", "20:30"];
const MAX_CAMPAIGN_RITUAL_ESTIMATED_MINUTES = 1440;
const CAMPAIGN_RITUAL_DEFAULT_ESTIMATED_MINUTES = 30;
const CAMPAIGN_RITUAL_SCHEDULING_HORIZON_DAYS = 30;
const CAMPAIGN_RITUAL_SCHEDULING_STEP_MINUTES = 15;
const CAMPAIGN_RITUAL_EARLIEST_START_MINUTES = 6 * 60;
const CAMPAIGN_RITUAL_LATEST_END_MINUTES = 22 * 60;

const normalizeCampaignHabitPreferredTime = (
  values: Array<string | null | undefined>,
  fallbackTime: string | null = null,
): string | null => {
  for (const value of values) {
    if (typeof value !== "string") continue;

    const match = value.trim().match(/^([01]?\d|2[0-3]):([0-5]\d)(?::[0-5]\d)?$/);
    if (match) {
      return `${match[1].padStart(2, "0")}:${match[2]}`;
    }
  }

  return fallbackTime;
};

const normalizeCampaignHabitEstimatedMinutes = (...values: Array<number | null | undefined>): number | null => {
  for (const value of values) {
    if (
      typeof value === "number"
      && Number.isFinite(value)
      && Number.isInteger(value)
      && value > 0
      && value <= MAX_CAMPAIGN_RITUAL_ESTIMATED_MINUTES
    ) {
      return value;
    }
  }

  return null;
};

type CampaignRitualScheduleInput = {
  frequency: string;
  custom_days: number[] | null;
  custom_month_days: number[] | null;
};

type CampaignRitualSchedulingBlock = {
  schedule: NormalizedRitualSchedule;
  startMinutes: number;
  endMinutes: number;
};

const parseCampaignClockMinutes = (value: string | null | undefined): number | null => {
  const normalized = normalizeCampaignHabitPreferredTime([value], null);
  if (!normalized) return null;

  const [hours, minutes] = normalized.split(":").map((part) => Number.parseInt(part, 10));
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return null;

  return (hours * 60) + minutes;
};

const formatCampaignClockMinutes = (value: number): string => {
  const normalized = Math.max(0, Math.min(23 * 60 + 59, value));
  const hours = Math.floor(normalized / 60);
  const minutes = normalized % 60;

  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
};

const normalizeCampaignSchedulingDuration = (estimatedMinutes: number | null | undefined): number => {
  if (
    typeof estimatedMinutes === "number"
    && Number.isFinite(estimatedMinutes)
    && estimatedMinutes > 0
  ) {
    return Math.min(Math.ceil(estimatedMinutes), MAX_CAMPAIGN_RITUAL_ESTIMATED_MINUTES);
  }

  return CAMPAIGN_RITUAL_DEFAULT_ESTIMATED_MINUTES;
};

const toPlannerWeekday = (targetDate: Date): number => {
  const jsDay = getDay(targetDate);
  return jsDay === 0 ? 6 : jsDay - 1;
};

const schedulesCanOccurTogether = (
  left: NormalizedRitualSchedule,
  right: NormalizedRitualSchedule,
): boolean => {
  const start = new Date();

  for (let offset = 0; offset <= CAMPAIGN_RITUAL_SCHEDULING_HORIZON_DAYS; offset += 1) {
    const targetDate = addDays(start, offset);
    const weekday = toPlannerWeekday(targetDate);

    if (
      isHabitScheduledForDate(left, targetDate, weekday)
      && isHabitScheduledForDate(right, targetDate, weekday)
    ) {
      return true;
    }
  }

  return false;
};

const intervalsOverlap = (
  leftStart: number,
  leftEnd: number,
  rightStart: number,
  rightEnd: number,
): boolean => leftStart < rightEnd && leftEnd > rightStart;

const buildCampaignRitualSchedulingBlock = (input: {
  preferred_time: string | null;
  estimated_minutes: number | null;
  frequency: string;
  custom_days: number[] | null;
  custom_month_days: number[] | null;
}): CampaignRitualSchedulingBlock | null => {
  const startMinutes = parseCampaignClockMinutes(input.preferred_time);
  if (startMinutes === null) return null;

  const duration = normalizeCampaignSchedulingDuration(input.estimated_minutes);

  return {
    schedule: normalizeRitualSchedule({
      frequency: input.frequency,
      customDays: input.custom_days,
      customMonthDays: input.custom_month_days,
    }),
    startMinutes,
    endMinutes: Math.min(24 * 60, startMinutes + duration),
  };
};

const collectActiveCampaignRitualSchedulingBlocks = (
  activeEpics: EpicRecord[],
): CampaignRitualSchedulingBlock[] =>
  activeEpics
    .filter((epic) => epic.status === "active")
    .flatMap((epic) => epic.epic_habits ?? [])
    .map((link) => link.habits)
    .filter((habit): habit is NonNullable<typeof habit> => Boolean(habit))
    .map((habit) =>
      buildCampaignRitualSchedulingBlock({
        preferred_time: habit.preferred_time ?? null,
        estimated_minutes: habit.estimated_minutes ?? null,
        frequency: habit.frequency ?? "daily",
        custom_days: habit.custom_days ?? null,
        custom_month_days: habit.custom_month_days ?? null,
      })
    )
    .filter((block): block is CampaignRitualSchedulingBlock => Boolean(block));

const buildCampaignRitualTimeCandidates = (
  preferredTime: string | null,
  fallbackTime: string,
  durationMinutes: number,
): string[] => {
  const preferredMinutes =
    parseCampaignClockMinutes(preferredTime) ??
      parseCampaignClockMinutes(fallbackTime) ??
      parseCampaignClockMinutes(CAMPAIGN_RITUAL_TIME_FALLBACKS[0]) ??
      CAMPAIGN_RITUAL_EARLIEST_START_MINUTES;
  const latestStart = CAMPAIGN_RITUAL_LATEST_END_MINUTES - durationMinutes;
  const candidates: string[] = [];
  const seen = new Set<string>();

  const addCandidate = (minutes: number) => {
    if (minutes < CAMPAIGN_RITUAL_EARLIEST_START_MINUTES || minutes > latestStart) return;
    const alignedMinutes = Math.round(minutes / CAMPAIGN_RITUAL_SCHEDULING_STEP_MINUTES) *
      CAMPAIGN_RITUAL_SCHEDULING_STEP_MINUTES;
    if (alignedMinutes < CAMPAIGN_RITUAL_EARLIEST_START_MINUTES || alignedMinutes > latestStart) return;

    const clock = formatCampaignClockMinutes(alignedMinutes);
    if (seen.has(clock)) return;
    seen.add(clock);
    candidates.push(clock);
  };

  addCandidate(preferredMinutes);

  for (
    let offset = CAMPAIGN_RITUAL_SCHEDULING_STEP_MINUTES;
    offset <= 8 * 60;
    offset += CAMPAIGN_RITUAL_SCHEDULING_STEP_MINUTES
  ) {
    addCandidate(preferredMinutes + offset);
    addCandidate(preferredMinutes - offset);
  }

  for (const fallback of CAMPAIGN_RITUAL_TIME_FALLBACKS) {
    const fallbackMinutes = parseCampaignClockMinutes(fallback);
    if (fallbackMinutes !== null) addCandidate(fallbackMinutes);
  }

  for (
    let minutes = CAMPAIGN_RITUAL_EARLIEST_START_MINUTES;
    minutes <= latestStart;
    minutes += CAMPAIGN_RITUAL_SCHEDULING_STEP_MINUTES
  ) {
    addCandidate(minutes);
  }

  return candidates;
};

const isCampaignRitualCandidateAvailable = ({
  candidateTime,
  durationMinutes,
  schedule,
  occupied,
}: {
  candidateTime: string;
  durationMinutes: number;
  schedule: NormalizedRitualSchedule;
  occupied: CampaignRitualSchedulingBlock[];
}): boolean => {
  const startMinutes = parseCampaignClockMinutes(candidateTime);
  if (startMinutes === null) return false;

  const endMinutes = startMinutes + durationMinutes;

  return !occupied.some((block) =>
    intervalsOverlap(startMinutes, endMinutes, block.startMinutes, block.endMinutes)
    && schedulesCanOccurTogether(schedule, block.schedule)
  );
};

const chooseSmartCampaignRitualTime = ({
  preferredTime,
  fallbackTime,
  estimatedMinutes,
  scheduleInput,
  occupied,
}: {
  preferredTime: string | null;
  fallbackTime: string;
  estimatedMinutes: number | null;
  scheduleInput: CampaignRitualScheduleInput;
  occupied: CampaignRitualSchedulingBlock[];
}): string | null => {
  const normalizedPreferred = normalizeCampaignHabitPreferredTime([preferredTime], null);
  const normalizedFallback = normalizeCampaignHabitPreferredTime([fallbackTime], CAMPAIGN_RITUAL_TIME_FALLBACKS[0]);
  if (!normalizedFallback) return normalizedPreferred;

  const durationMinutes = normalizeCampaignSchedulingDuration(estimatedMinutes);
  const schedule = normalizeRitualSchedule({
    frequency: scheduleInput.frequency,
    customDays: scheduleInput.custom_days,
    customMonthDays: scheduleInput.custom_month_days,
  });

  const candidates = buildCampaignRitualTimeCandidates(
    normalizedPreferred,
    normalizedFallback,
    durationMinutes,
  );
  const selectedTime = candidates.find((candidateTime) =>
    isCampaignRitualCandidateAvailable({
      candidateTime,
      durationMinutes,
      schedule,
      occupied,
    })
  );

  return selectedTime ?? normalizedPreferred ?? normalizedFallback;
};

const sortNumbers = (values: number[] | null | undefined): number[] | null =>
  values?.length ? [...values].sort((left, right) => left - right) : null;

const sortByStableJson = <T,>(items: T[]): T[] =>
  items
    .slice()
    .sort((left, right) => JSON.stringify(left).localeCompare(JSON.stringify(right)));

const normalizeFingerprintHabit = (
  habit: Pick<
    LocalHabitRow,
    | "title"
    | "description"
    | "difficulty"
    | "frequency"
    | "custom_days"
    | "custom_month_days"
    | "preferred_time"
    | "estimated_minutes"
    | "category"
    | "reminder_enabled"
    | "reminder_minutes_before"
  >,
): FingerprintHabit => ({
  title: normalizeFingerprintText(habit.title) ?? "",
  description: normalizeFingerprintText(habit.description),
  difficulty: normalizeDifficulty(habit.difficulty ?? "medium"),
  frequency: normalizeFrequency(habit.frequency),
  custom_days: sortNumbers(habit.custom_days),
  custom_month_days: sortNumbers(habit.custom_month_days),
  // Preferred times can be shifted by smart scheduling, so they are not part of create idempotency.
  preferred_time: null,
  estimated_minutes: habit.estimated_minutes ?? null,
  category: normalizeFingerprintText(habit.category),
  reminder_enabled: Boolean(habit.reminder_enabled),
  reminder_minutes_before: habit.reminder_minutes_before ?? 15,
});

const normalizeFingerprintInputHabit = (
  habit: CreateEpicInput["habits"][number],
  index: number,
): FingerprintHabit =>
  normalizeFingerprintHabit({
    title: habit.title,
    description: habit.description ?? null,
    difficulty: habit.difficulty,
    frequency: habit.frequency,
    custom_days: habit.custom_days ?? null,
    custom_month_days: habit.custom_month_days ?? null,
    preferred_time: normalizeCampaignHabitPreferredTime(
      [habit.preferred_time, habit.preferredTime],
      CAMPAIGN_RITUAL_TIME_FALLBACKS[index % CAMPAIGN_RITUAL_TIME_FALLBACKS.length],
    ),
    estimated_minutes: normalizeCampaignHabitEstimatedMinutes(habit.estimated_minutes, habit.estimatedMinutes),
    category: habit.category ?? null,
    reminder_enabled: habit.reminder_enabled ?? false,
    reminder_minutes_before: habit.reminder_minutes_before ?? 15,
  });

const normalizeFingerprintMilestone = (
  milestone: Pick<
    LocalEpicPayload["milestones"][number],
    "title" | "description" | "target_date" | "milestone_percent" | "is_postcard_milestone" | "phase_name"
  >,
  normalizedPercent = milestone.milestone_percent,
): FingerprintMilestone => ({
  title: normalizeFingerprintText(milestone.title) ?? "",
  description: normalizeFingerprintText(milestone.description),
  target_date: milestone.target_date,
  milestone_percent: normalizedPercent,
  is_postcard_milestone: Boolean(milestone.is_postcard_milestone),
  phase_name: normalizeFingerprintText(milestone.phase_name),
});

const normalizeFingerprintInputMilestone = (
  milestone: NonNullable<CreateEpicInput["milestones"]>[number],
  normalizedPercent = milestone.milestone_percent,
): FingerprintMilestone =>
  normalizeFingerprintMilestone({
    title: milestone.title,
    description: milestone.description ?? null,
    target_date: milestone.target_date,
    milestone_percent: milestone.milestone_percent,
    is_postcard_milestone: milestone.is_postcard_milestone,
    phase_name: milestone.phase_name ?? milestone.phaseName ?? null,
  });

const normalizeFingerprintPhase = (
  phase: Pick<LocalEpicPayload["phases"][number], "name" | "description" | "start_date" | "end_date" | "phase_order">,
): FingerprintPhase => ({
  name: normalizeFingerprintText(phase.name) ?? "",
  description: normalizeFingerprintText(phase.description),
  start_date: phase.start_date,
  end_date: phase.end_date,
  phase_order: phase.phase_order,
});

const buildCampaignCreateFingerprint = (userId: string, epicData: CreateEpicInput): string => {
  const milestones = epicData.milestones ?? [];
  const normalizedMilestonePercents = normalizeCampaignMilestonePercentArray(
    milestones.map((milestone) => milestone.milestone_percent),
  );

  return JSON.stringify({
    user_id: userId,
    title: normalizeFingerprintText(epicData.title) ?? "",
    target_days: epicData.target_days,
    story_type_slug: normalizeFingerprintText(epicData.story_type_slug ?? null),
    habits: sortByStableJson(epicData.habits.map(normalizeFingerprintInputHabit)),
    milestones: sortByStableJson(
      milestones.map((milestone, index) => normalizeFingerprintInputMilestone(
        milestone,
        normalizedMilestonePercents[index],
      )),
    ),
    phases: sortByStableJson((epicData.phases ?? []).map(normalizeFingerprintPhase)),
  });
};

const buildCampaignCreateFingerprintFromPayload = (userId: string, payload: LocalEpicPayload): string => {
  const normalizedMilestonePercents = normalizeCampaignMilestonePercentArray(
    payload.milestones.map((milestone) => milestone.milestone_percent),
  );

  return JSON.stringify({
    user_id: userId,
    title: normalizeFingerprintText(payload.epic.title) ?? "",
    target_days: payload.epic.target_days,
    story_type_slug: normalizeFingerprintText(payload.epic.story_type_slug ?? null),
    habits: sortByStableJson(payload.habits.map(normalizeFingerprintHabit)),
    milestones: sortByStableJson(
      payload.milestones.map((milestone, index) => normalizeFingerprintMilestone(
        milestone,
        normalizedMilestonePercents[index],
      )),
    ),
    phases: sortByStableJson(payload.phases.map(normalizeFingerprintPhase)),
  });
};

const isRecentEpicCreateTimestamp = (value: string | number | null | undefined, nowMs: number): boolean => {
  if (typeof value === "number") {
    return nowMs - value <= RECENT_EPIC_CREATE_WINDOW_MS;
  }

  if (typeof value === "string") {
    const parsed = Date.parse(value);
    if (!Number.isNaN(parsed)) {
      return nowMs - parsed <= RECENT_EPIC_CREATE_WINDOW_MS;
    }
  }

  return false;
};

const isRecentEpicCreateAttemptTimestamp = (value: number | null | undefined, nowMs: number): boolean =>
  typeof value === "number"
  && Number.isFinite(value)
  && nowMs - value <= RECENT_EPIC_CREATE_ATTEMPT_WINDOW_MS;

const readStoredEpicCreateAttempts = (): StoredEpicCreateAttempt[] => {
  const storage = getCampaignAttemptStorage();
  if (!storage) return [];

  try {
    const raw = storage.getItem(EPIC_CREATE_ATTEMPT_STORAGE_KEY);
    if (!raw) return [];

    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];

    const nowMs = Date.now();
    return parsed.filter((entry): entry is StoredEpicCreateAttempt => {
      if (!entry || typeof entry !== "object") return false;
      const candidate = entry as Partial<StoredEpicCreateAttempt>;
      return typeof candidate.fingerprint === "string"
        && isRecentEpicCreateAttemptTimestamp(candidate.createdAt, nowMs)
        && Boolean(candidate.payload?.epic)
        && Array.isArray(candidate.payload?.habits)
        && Array.isArray(candidate.payload?.epicHabits)
        && Array.isArray(candidate.payload?.phases)
        && Array.isArray(candidate.payload?.milestones);
    });
  } catch (error) {
    console.warn("Failed to read recent campaign create attempts:", error);
    return [];
  }
};

const writeStoredEpicCreateAttempts = (attempts: StoredEpicCreateAttempt[]) => {
  const storage = getCampaignAttemptStorage();
  if (!storage) return;

  try {
    const nowMs = Date.now();
    const recentAttempts = attempts
      .filter((attempt) => isRecentEpicCreateAttemptTimestamp(attempt.createdAt, nowMs))
      .slice(-20);
    storage.setItem(EPIC_CREATE_ATTEMPT_STORAGE_KEY, JSON.stringify(recentAttempts));
  } catch (error) {
    console.warn("Failed to store recent campaign create attempts:", error);
  }
};

const rememberEpicCreateAttempt = (fingerprint: string, payload: LocalEpicPayload): void => {
  const createdAt = Date.now();
  recentEpicCreateAttempts.set(fingerprint, { createdAt, payload });

  const storedAttempts = readStoredEpicCreateAttempts()
    .filter((attempt) => attempt.fingerprint !== fingerprint);
  storedAttempts.push({ fingerprint, createdAt, payload });
  writeStoredEpicCreateAttempts(storedAttempts);
};

const getRememberedEpicCreatePayload = (fingerprint: string): LocalEpicPayload | null => {
  const nowMs = Date.now();
  const memoryAttempt = recentEpicCreateAttempts.get(fingerprint);
  if (memoryAttempt && isRecentEpicCreateAttemptTimestamp(memoryAttempt.createdAt, nowMs)) {
    return memoryAttempt.payload;
  }

  if (memoryAttempt) {
    recentEpicCreateAttempts.delete(fingerprint);
  }

  const storedAttempt = readStoredEpicCreateAttempts()
    .find((attempt) => attempt.fingerprint === fingerprint);
  if (!storedAttempt) return null;

  recentEpicCreateAttempts.set(fingerprint, {
    createdAt: storedAttempt.createdAt,
    payload: storedAttempt.payload,
  });
  return storedAttempt.payload;
};

const isActiveQueuedEpicCreateStatus = (status: QueuedAction["status"]) =>
  status === "queued" || status === "syncing" || status === "failed";

const findRecentMatchingQueuedEpicCreate = async (
  userId: string,
  fingerprint: string,
): Promise<EpicCreateMatch | null> => {
  const queuedActions = await getQueuedActions(userId);
  const nowMs = Date.now();

  for (const action of queuedActions) {
    if (action.action_kind !== "EPIC_CREATE" || !isActiveQueuedEpicCreateStatus(action.status)) {
      continue;
    }

    if (!isRecentEpicCreateTimestamp(action.created_at, nowMs)) {
      continue;
    }

    const payload = action.payload as Partial<LocalEpicPayload> | undefined;
    if (!payload?.epic || !Array.isArray(payload.habits) || !Array.isArray(payload.phases) || !Array.isArray(payload.milestones)) {
      continue;
    }

    const normalizedPayload: LocalEpicPayload = {
      epic: payload.epic as LocalEpicRow,
      habits: payload.habits as LocalHabitRow[],
      epicHabits: Array.isArray(payload.epicHabits) ? payload.epicHabits as LocalEpicPayload["epicHabits"] : [],
      phases: payload.phases as LocalEpicPayload["phases"],
      milestones: payload.milestones as LocalEpicPayload["milestones"],
    };

    if (buildCampaignCreateFingerprintFromPayload(userId, normalizedPayload) === fingerprint) {
      return {
        epic: normalizedPayload.epic,
        queued: true,
      };
    }
  }

  return null;
};

const findRecentMatchingLocalEpicCreate = async (
  userId: string,
  fingerprint: string,
): Promise<EpicCreateMatch | null> => {
  const [localEpics, localHabits] = await Promise.all([
    loadLocalEpics(userId),
    getLocalHabits<LocalHabitRow>(userId),
  ]);
  const recentLocalEpics = localEpics.filter((epic) => isRecentEpicCreateTimestamp(epic.created_at, Date.now()));
  if (recentLocalEpics.length === 0) {
    return null;
  }

  const habitsById = new Map(localHabits.map((habit) => [habit.id, habit]));

  for (const epic of recentLocalEpics) {
    const [phases, milestones] = await Promise.all([
      getLocalJourneyPhases<LocalEpicPayload["phases"][number]>(epic.id),
      getLocalEpicMilestones<LocalEpicPayload["milestones"][number]>(epic.id),
    ]);

    const habits = epic.epic_habits
      .map((link) => habitsById.get(link.habit_id))
      .filter((habit): habit is LocalHabitRow => Boolean(habit));

    const payload: LocalEpicPayload = {
      epic,
      habits,
      epicHabits: epic.epic_habits.map((link) => ({
        id: `${epic.id}:${link.habit_id}`,
        epic_id: epic.id,
        habit_id: link.habit_id,
      })),
      phases,
      milestones,
    };

    if (buildCampaignCreateFingerprintFromPayload(userId, payload) === fingerprint) {
      return {
        epic,
        queued: false,
      };
    }
  }

  return null;
};

async function reconcileRecentEpicCreate(
  userId: string,
  fingerprint: string,
): Promise<EpicCreateMatch | null> {
  const queuedMatch = await findRecentMatchingQueuedEpicCreate(userId, fingerprint);
  if (queuedMatch) {
    return queuedMatch;
  }

  return findRecentMatchingLocalEpicCreate(userId, fingerprint);
}

async function applyLocalEpicPayload(payload: LocalEpicPayload) {
  await upsertPlannerRecords("habits", payload.habits);
  await upsertPlannerRecord("epics", payload.epic);
  await upsertPlannerRecords("epic_habits", payload.epicHabits);
  await upsertPlannerRecords("journey_phases", payload.phases);
  await upsertPlannerRecords("epic_milestones", payload.milestones);
}

function withNormalizedCampaignMilestonePercents(payload: LocalEpicPayload): LocalEpicPayload {
  const normalizedMilestonePercents = normalizeCampaignMilestonePercentArray(
    payload.milestones.map((milestone) => milestone.milestone_percent),
  );

  return {
    ...payload,
    milestones: payload.milestones.map((milestone, index) => ({
      ...milestone,
      milestone_percent: normalizedMilestonePercents[index] ?? milestone.milestone_percent,
    })),
  };
}

async function rollbackLocalEpicPayload(payload: LocalEpicPayload) {
  if (payload.epicHabits.length > 0) {
    await removePlannerRecords("epic_habits", payload.epicHabits.map((link) => link.id));
  }

  if (payload.phases.length > 0) {
    await removePlannerRecords("journey_phases", payload.phases.map((phase) => phase.id));
  }

  if (payload.milestones.length > 0) {
    await removePlannerRecords("epic_milestones", payload.milestones.map((milestone) => milestone.id));
  }

  await removePlannerRecord("epics", payload.epic.id);

  if (payload.habits.length > 0) {
    await removePlannerRecords("habits", payload.habits.map((habit) => habit.id));
  }
}

async function rollbackRemoteEpicPayload(userId: string, payload: LocalEpicPayload) {
  if (payload.epicHabits.length > 0) {
    const { error } = await supabase
      .from("epic_habits")
      .delete()
      .in("id", payload.epicHabits.map((link) => link.id));
    if (error) throw error;
  }

  if (payload.phases.length > 0) {
    const { error } = await supabase
      .from("journey_phases")
      .delete()
      .in("id", payload.phases.map((phase) => phase.id))
      .eq("user_id", userId);
    if (error) throw error;
  }

  if (payload.milestones.length > 0) {
    const { error } = await supabase
      .from("epic_milestones")
      .delete()
      .in("id", payload.milestones.map((milestone) => milestone.id))
      .eq("user_id", userId);
    if (error) throw error;
  }

  const { error: epicError } = await supabase
    .from("epics")
    .delete()
    .eq("id", payload.epic.id)
    .eq("user_id", userId);
  if (epicError) throw epicError;

  if (payload.habits.length > 0) {
    const habitIds = payload.habits.map((habit) => habit.id);
    const { error: tasksError } = await supabase
      .from("daily_tasks")
      .delete()
      .in("habit_source_id", habitIds)
      .eq("user_id", userId)
      .is("completed_at", null)
      .or("completed.is.null,completed.eq.false");
    if (tasksError) throw tasksError;

    const { error } = await supabase
      .from("habits")
      .delete()
      .in("id", habitIds)
      .eq("user_id", userId);
    if (error) throw error;
  }
}

async function applyLocalCampaignRitualPayload(payload: LocalCampaignRitualPayload) {
  await upsertPlannerRecord("habits", payload.habit);
  await upsertPlannerRecord("epic_habits", payload.epicHabit);
}

async function rollbackLocalCampaignRitualPayload(payload: LocalCampaignRitualPayload) {
  await removePlannerRecord("epic_habits", payload.epicHabit.id);
  await removePlannerRecord("habits", payload.habit.id);
}

async function rollbackRemoteCampaignRitualPayload(userId: string, payload: LocalCampaignRitualPayload) {
  const { error: tasksError } = await supabase
    .from("daily_tasks")
    .delete()
    .eq("habit_source_id", payload.habit.id)
    .eq("user_id", userId)
    .is("completed_at", null)
    .or("completed.is.null,completed.eq.false");
  if (tasksError) throw tasksError;

  const { error: linkError } = await supabase
    .from("epic_habits")
    .delete()
    .eq("id", payload.epicHabit.id);
  if (linkError) throw linkError;

  const { error: habitError } = await supabase
    .from("habits")
    .delete()
    .eq("id", payload.habit.id)
    .eq("user_id", userId);
  if (habitError) throw habitError;
}

async function applyLocalCampaignRitualDelete(
  userId: string,
  { epicId, habitId }: DeleteCampaignRitualInput,
  epic: LocalEpicRow,
) {
  const [epicHabits, localTasks, habitCompletions, habits] = await Promise.all([
    getLocalEpicHabits<LocalEpicHabitRow>([epicId]),
    getAllLocalTasksForUser<LocalTaskCampaignCleanupRow>(userId),
    getLocalHabitCompletions<Array<{ id: string; habit_id: string | null; user_id: string; date: string }>[number]>(userId),
    getLocalHabits<LocalHabitRow>(userId),
  ]);

  const linkIdsToDelete = epicHabits
    .filter((link) => link.habit_id === habitId)
    .map((link) => link.id);
  if (linkIdsToDelete.length === 0) {
    throw new Error("Campaign ritual link not found");
  }

  const linkedTasks = localTasks.filter((task) => task.habit_source_id === habitId);
  const habit = habits.find((candidate) => candidate.id === habitId);
  const deletedPlannerEntities = normalizeDeletedPlannerEntities([
    {
      entityType: "ritual",
      entityId: habitId,
      title: habit?.title ?? null,
      metadata: {
        campaignId: epicId,
        campaignTitle: epic.title,
      },
    },
    ...linkedTasks.map((task) => ({
      entityType: "task" as const,
      entityId: task.id,
      title: task.task_text ?? null,
      metadata: {
        campaignId: epicId,
        campaignTitle: epic.title,
        habitSourceId: habitId,
        ritualTitle: habit?.title ?? null,
        taskDate: task.task_date ?? null,
      },
    })),
  ]);
  const excludedFromPlannerAt = new Date().toISOString();
  const tasksToDelete = linkedTasks
    .filter((task) => task.completed !== true && !task.completed_at)
    .map((task) => task.id);
  const taskIdsToDelete = new Set(tasksToDelete);
  const tasksToDetach = linkedTasks
    .filter((task) => !taskIdsToDelete.has(task.id))
    .map((task) => ({
      ...task,
      epic_id: null,
      epic_title: null,
      habit_source_id: null,
      excluded_from_planner_at: task.excluded_from_planner_at ??
        excludedFromPlannerAt,
    }));
  const completionsToDelete = habitCompletions
    .filter((completion) => completion.habit_id === habitId)
    .map((completion) => completion.id);

  if (tasksToDetach.length > 0) {
    await upsertPlannerRecords("daily_tasks", tasksToDetach);
  }
  if (tasksToDelete.length > 0) {
    await removePlannerRecords("daily_tasks", tasksToDelete);
  }
  if (linkIdsToDelete.length > 0) {
    await removePlannerRecords("epic_habits", linkIdsToDelete);
  }
  if (completionsToDelete.length > 0) {
    await removePlannerRecords("habit_completions", completionsToDelete);
  }

  await removePlannerRecord("habits", habitId);
  return { deletedPlannerEntities };
}

async function applyRemoteCampaignRitualDelete(
  userId: string,
  { epicId, habitId }: DeleteCampaignRitualInput,
) {
  const excludedFromPlannerAt = new Date().toISOString();
  const { data: matchingLinks, error: linkLookupError } = await supabase
    .from("epic_habits")
    .select("id")
    .eq("epic_id", epicId)
    .eq("habit_id", habitId);
  if (linkLookupError) throw linkLookupError;
  if (!matchingLinks || matchingLinks.length === 0) {
    const { data: matchingHabits, error: habitLookupError } = await supabase
      .from("habits")
      .select("id")
      .eq("id", habitId)
      .eq("user_id", userId);
    if (habitLookupError) throw habitLookupError;
    if (!matchingHabits || matchingHabits.length === 0) return;

    throw new Error("Campaign ritual link not found");
  }

  await runDailyTaskCleanupUpdate({
      epic_id: null,
      habit_source_id: null,
      excluded_from_planner_at: excludedFromPlannerAt,
    }, (update) =>
      supabase
        .from("daily_tasks")
        .update(update)
        .eq("habit_source_id", habitId)
        .eq("user_id", userId)
        .or("completed.eq.true,completed_at.not.is.null")
    );

  const { error: deleteIncompleteTasksError } = await supabase
    .from("daily_tasks")
    .delete()
    .eq("habit_source_id", habitId)
    .eq("user_id", userId)
    .is("completed_at", null)
    .or("completed.is.null,completed.eq.false");
  if (deleteIncompleteTasksError) throw deleteIncompleteTasksError;

  const { error: completionError } = await supabase
    .from("habit_completions")
    .delete()
    .eq("habit_id", habitId)
    .eq("user_id", userId);
  if (completionError) throw completionError;

  const { error: linkDeleteError } = await supabase
    .from("epic_habits")
    .delete()
    .in("id", matchingLinks.map((link) => link.id));
  if (linkDeleteError) throw linkDeleteError;

  const { error: habitError } = await supabase
    .from("habits")
    .delete()
    .eq("id", habitId)
    .eq("user_id", userId);
  if (habitError) throw habitError;
}

async function applyLocalCampaignHabitUnlink(
  userId: string,
  { epicId, habitId }: DeleteCampaignRitualInput,
) {
  const [epicHabits, localTasks] = await Promise.all([
    getLocalEpicHabits<LocalEpicHabitRow>([epicId]),
    getAllLocalTasksForUser<LocalTaskCampaignCleanupRow>(userId),
  ]);

  const linkIdsToDelete = epicHabits
    .filter((link) => link.habit_id === habitId)
    .map((link) => link.id);
  const tasksToDetach = localTasks
    .filter((task) => task.habit_source_id === habitId && task.epic_id === epicId)
    .map((task) => ({
      ...task,
      epic_id: null,
      epic_title: null,
    }));

  if (tasksToDetach.length > 0) {
    await upsertPlannerRecords("daily_tasks", tasksToDetach);
  }
  if (linkIdsToDelete.length > 0) {
    await removePlannerRecords("epic_habits", linkIdsToDelete);
  }
}

async function applyRemoteCampaignHabitUnlink(
  userId: string,
  { epicId, habitId }: DeleteCampaignRitualInput,
) {
  await runDailyTaskCleanupUpdate({
      epic_id: null,
    }, (update) =>
      supabase
        .from("daily_tasks")
        .update(update)
        .eq("user_id", userId)
        .eq("epic_id", epicId)
        .eq("habit_source_id", habitId)
    );

  const { error } = await supabase
    .from("epic_habits")
    .delete()
    .eq("epic_id", epicId)
    .eq("habit_id", habitId);
  if (error) throw error;
}

function buildTaskCreatePayload(task: DailyTask): Record<string, unknown> {
  return {
    id: task.id,
    user_id: task.user_id,
    task_text: task.task_text,
    difficulty: task.difficulty,
    xp_reward: task.xp_reward,
    task_date: task.task_date,
    completed: task.completed,
    completed_at: task.completed_at,
    is_main_quest: task.is_main_quest,
    scheduled_time: task.scheduled_time,
    estimated_duration: task.estimated_duration,
    recurrence_pattern: task.recurrence_pattern,
    recurrence_days: task.recurrence_days,
    recurrence_month_days: task.recurrence_month_days ?? null,
    recurrence_custom_period: task.recurrence_custom_period ?? null,
    recurrence_end_date: task.recurrence_end_date ?? null,
    is_recurring: task.is_recurring,
    reminder_enabled: task.reminder_enabled,
    reminder_minutes_before: task.reminder_minutes_before,
    category: task.category,
    notes: task.notes,
    contact_id: task.contact_id,
    auto_log_interaction: task.auto_log_interaction,
    image_url: task.image_url,
    location: task.location,
    source: task.source,
    habit_source_id: task.habit_source_id,
    epic_id: task.epic_id,
    parent_template_id: task.parent_template_id,
    sort_order: task.sort_order ?? null,
  };
}

function createEmptyHabitTaskReconciliation(): HabitTaskReconciliationAggregate {
  return {
    createdTasks: [],
    updatedTasks: [],
    deletedTasks: [],
    touchedDates: [],
  };
}

function mergeHabitTaskReconciliation(
  aggregate: HabitTaskReconciliationAggregate,
  next: HabitTaskReconciliationResult,
): HabitTaskReconciliationAggregate {
  return {
    createdTasks: [...aggregate.createdTasks, ...next.createdTasks],
    updatedTasks: [...aggregate.updatedTasks, ...next.updatedTasks],
    deletedTasks: [...aggregate.deletedTasks, ...next.deletedTasks],
    touchedDates: [...new Set([...aggregate.touchedDates, ...next.touchedDates])].sort(),
  };
}

function toHabitTaskTemplate(userId: string, habit: LocalHabitRow): HabitTaskTemplate {
  const normalizedSchedule = normalizeRitualSchedule({
    frequency: habit.frequency,
    customDays: habit.custom_days,
    customMonthDays: habit.custom_month_days,
  });

  return {
    habitId: habit.id,
    userId,
    title: habit.title,
    difficulty: habit.difficulty,
    estimated_minutes: habit.estimated_minutes,
    preferred_time: habit.preferred_time,
    category: habit.category,
    reminder_enabled: habit.reminder_enabled,
    reminder_minutes_before: habit.reminder_minutes_before,
    frequency: normalizedSchedule.frequency,
    custom_days: normalizedSchedule.custom_days,
    custom_month_days: normalizedSchedule.custom_month_days,
    customPeriod: normalizedSchedule.customPeriod,
  };
}

async function applyLocalHabitTaskReconciliation(reconciliation: HabitTaskReconciliationResult): Promise<void> {
  const nextTasks = [
    ...reconciliation.createdTasks,
    ...reconciliation.updatedTasks.map(({ nextTask }) => nextTask),
  ];

  if (nextTasks.length > 0) {
    await upsertPlannerRecords("daily_tasks", nextTasks);
  }

  if (reconciliation.deletedTasks.length > 0) {
    await removePlannerRecords("daily_tasks", reconciliation.deletedTasks.map((task) => task.id));
  }
}

async function rollbackLocalHabitTaskReconciliation(
  reconciliation: HabitTaskReconciliationAggregate | null,
): Promise<void> {
  if (!reconciliation) return;

  if (reconciliation.createdTasks.length > 0) {
    await removePlannerRecords("daily_tasks", reconciliation.createdTasks.map((task) => task.id));
  }

  const restoredTasks = [
    ...reconciliation.updatedTasks.map(({ existingTask }) => existingTask),
    ...reconciliation.deletedTasks,
  ];

  if (restoredTasks.length > 0) {
    await upsertPlannerRecords("daily_tasks", restoredTasks);
  }
}

async function reconcileAndApplyLocalCampaignHabitTasks(
  userId: string,
  habits: LocalHabitRow[],
): Promise<HabitTaskReconciliationAggregate> {
  let aggregate = createEmptyHabitTaskReconciliation();

  for (const habit of habits) {
    const reconciliation = await reconcileHabitLinkedTasks(toHabitTaskTemplate(userId, habit));
    await applyLocalHabitTaskReconciliation(reconciliation);
    aggregate = mergeHabitTaskReconciliation(aggregate, reconciliation);
  }

  return aggregate;
}

async function queueHabitTaskReconciliation(
  reconciliation: HabitTaskReconciliationAggregate,
  queueTaskAction: TaskQueueAction,
): Promise<void> {
  await Promise.all([
    ...reconciliation.createdTasks.map((task) =>
      queueTaskAction("CREATE_TASK", buildTaskCreatePayload(task)),
    ),
    ...reconciliation.updatedTasks.map(({ existingTask, updates }) =>
      queueTaskAction("UPDATE_TASK", {
        taskId: existingTask.id,
        updates,
      }),
    ),
    ...reconciliation.deletedTasks.map((task) =>
      queueTaskAction("DELETE_TASK", {
        taskId: task.id,
      }),
    ),
  ]);
}

async function persistRemoteHabitTaskReconciliation(
  userId: string,
  reconciliation: HabitTaskReconciliationAggregate,
  options: {
    queueTaskAction: TaskQueueAction;
    retryNow: () => void | Promise<unknown>;
  },
): Promise<boolean> {
  let queued = false;

  if (reconciliation.createdTasks.length > 0) {
    const { error } = await supabase
      .from("daily_tasks")
      .upsert(
        reconciliation.createdTasks.map((task) => buildTaskCreatePayload(task)) as never,
        {
          onConflict: "user_id,task_date,habit_source_id",
          ignoreDuplicates: true,
        },
      );

    if (error) {
      if (!isQueueableWriteError(error)) throw error;
      await Promise.all(
        reconciliation.createdTasks.map((task) =>
          options.queueTaskAction("CREATE_TASK", buildTaskCreatePayload(task)),
        ),
      );
      queued = true;
    }
  }

  for (const { existingTask, updates } of reconciliation.updatedTasks) {
    const { error } = await supabase
      .from("daily_tasks")
      .update(updates)
      .eq("id", existingTask.id)
      .eq("user_id", userId);

    if (!error) continue;
    if (!isQueueableWriteError(error)) throw error;

    await options.queueTaskAction("UPDATE_TASK", {
      taskId: existingTask.id,
      updates,
    });
    queued = true;
  }

  for (const task of reconciliation.deletedTasks) {
    const { error } = await supabase
      .from("daily_tasks")
      .delete()
      .eq("id", task.id)
      .eq("user_id", userId);

    if (!error) continue;
    if (!isQueueableWriteError(error)) throw error;

    await options.queueTaskAction("DELETE_TASK", {
      taskId: task.id,
    });
    queued = true;
  }

  if (queued) {
    void options.retryNow();
  }

  return queued;
}

async function refreshEpicsQueryFromLocalStore(queryClient: ReturnType<typeof useQueryClient>, userId: string) {
  const nextEpics = await loadLocalEpics(userId);
  queryClient.setQueryData(getEpicsQueryKey(userId), nextEpics);
  return nextEpics;
}

async function applyLocalEpicStatusChange(userId: string, epicId: string, status: "completed" | "abandoned") {
  const localEpics = await loadLocalEpics(userId);
  const epic = localEpics.find((candidate) => candidate.id === epicId);
  if (!epic) {
    throw new Error("Epic not found");
  }

  await upsertPlannerRecord("epics", {
    ...epic,
    status,
    completed_at: status === "completed" ? new Date().toISOString() : null,
  });

  if (status !== "abandoned") {
    return;
  }

  const [epicHabits, habits, milestones, tasks] = await Promise.all([
    getLocalEpicHabits<Array<{ id: string; epic_id: string; habit_id: string }>[number]>([epicId]),
    getLocalHabits<LocalHabitRow>(userId),
    getLocalEpicMilestones<Array<{ id: string; epic_id: string; user_id: string }>[number]>(epicId),
    getAllLocalTasksForUser<LocalTaskCampaignCleanupRow>(userId),
  ]);

  const today = format(new Date(), "yyyy-MM-dd");
  const habitIds = epicHabits.map((link) => link.habit_id);

  await Promise.all(
    habits
      .filter((habit) => habitIds.includes(habit.id))
      .map((habit) =>
        upsertPlannerRecord("habits", {
          ...habit,
          is_active: false,
        }),
      ),
  );

  const tasksToDelete = tasks
    .filter((task) =>
      (task.epic_id === epicId ||
        (task.habit_source_id && habitIds.includes(task.habit_source_id)))
      && task.task_date
      && task.task_date >= today
      && task.completed !== true)
    .map((task) => task.id);
  const taskIdsToDelete = new Set(tasksToDelete);
  const tasksToDetach = tasks
    .filter((task) => {
      const linkedToCampaign = task.epic_id === epicId ||
        (task.habit_source_id ? habitIds.includes(task.habit_source_id) : false);
      return linkedToCampaign && !taskIdsToDelete.has(task.id);
    })
    .map((task) => ({
      ...task,
      epic_id: null,
      epic_title: null,
      habit_source_id: null,
    }));

  if (tasksToDetach.length > 0) {
    await upsertPlannerRecords("daily_tasks", tasksToDetach);
  }

  if (tasksToDelete.length > 0) {
    await removePlannerRecords("daily_tasks", tasksToDelete);
  }

  if (epicHabits.length > 0) {
    await removePlannerRecords("epic_habits", epicHabits.map((link) => link.id));
  }
  if (milestones.length > 0) {
    await removePlannerRecords("epic_milestones", milestones.map((milestone) => milestone.id));
  }
}

async function applyLocalEpicUpdate(
  userId: string,
  epicId: string,
  updates: {
    title?: string;
    description?: string | null;
  },
) {
  const localEpics = await loadLocalEpics(userId);
  const epic = localEpics.find((candidate) => candidate.id === epicId);
  if (!epic) {
    throw new Error("Epic not found");
  }

  const nextEpic: LocalEpicRow = {
    ...epic,
    ...(updates.title !== undefined ? { title: updates.title } : {}),
    ...(updates.description !== undefined ? { description: updates.description } : {}),
  };

  await upsertPlannerRecord("epics", nextEpic);

  if (updates.title !== undefined) {
    const localTasks = await getAllLocalTasksForUser<LocalTaskEpicTitleRow>(userId);
    const tasksToUpdate = localTasks
      .filter((task) => task.epic_id === epicId && task.epic_title !== updates.title)
      .map((task) => ({
        ...task,
        epic_title: updates.title ?? null,
      }));

    if (tasksToUpdate.length > 0) {
      await upsertPlannerRecords("daily_tasks", tasksToUpdate);
    }
  }

  return nextEpic;
}

async function applyLocalEpicDelete(userId: string, epicId: string) {
  const [localEpics, epicHabits, habits, phases, milestones, journeyPaths, localTasks, habitCompletions] = await Promise.all([
    loadLocalEpics(userId),
    getLocalEpicHabits<LocalEpicHabitRow>([epicId]),
    getLocalHabits<LocalHabitRow>(userId),
    getLocalJourneyPhases<Array<{ id: string; epic_id: string; user_id: string }>[number]>(epicId),
    getLocalEpicMilestones<Array<{ id: string; epic_id: string; user_id: string }>[number]>(epicId),
    getLocalJourneyPaths<Array<{ id: string; epic_id: string; user_id: string }>[number]>(userId),
    getAllLocalTasksForUser<LocalTaskCampaignCleanupRow>(userId),
    getLocalHabitCompletions<Array<{ id: string; habit_id: string | null; user_id: string; date: string }>[number]>(userId),
  ]);

  const epic = localEpics.find((candidate) => candidate.id === epicId);
  if (!epic) {
    throw new Error("Epic not found");
  }

  const habitIds = epicHabits.map((link) => link.habit_id);
  const habitIdSet = new Set(habitIds);
  const linkedCampaignTasks = localTasks
    .filter((task) =>
      task.epic_id === epicId ||
      (task.habit_source_id ? habitIdSet.has(task.habit_source_id) : false)
    );
  const linkedCampaignHabits = habits
    .filter((habit) => habitIdSet.has(habit.id));
  const deletedPlannerEntities = buildDeletedPlannerEntitiesForCampaign({
    epic,
    habits: linkedCampaignHabits,
    tasks: linkedCampaignTasks,
  });
  const excludedFromPlannerAt = new Date().toISOString();

  const tasksToDelete = linkedCampaignTasks
    .filter((task) => {
      if (task.completed === true || task.completed_at) return false;
      return true;
    })
    .map((task) => task.id);

  const tasksToDetach = linkedCampaignTasks
    .filter((task) => {
      return !tasksToDelete.includes(task.id);
    })
    .map((task) => ({
      ...task,
      epic_id: null,
      epic_title: null,
      habit_source_id: null,
      excluded_from_planner_at: task.excluded_from_planner_at ??
        excludedFromPlannerAt,
    }));

  const habitsToDelete = linkedCampaignHabits.map((habit) => habit.id);

  const completionsToDelete = habitCompletions
    .filter((completion) => completion.habit_id && habitIdSet.has(completion.habit_id))
    .map((completion) => completion.id);

  const journeyPathIdsToDelete = journeyPaths
    .filter((snapshot) => snapshot.epic_id === epicId)
    .map((snapshot) => snapshot.id);

  if (tasksToDetach.length > 0) {
    await upsertPlannerRecords("daily_tasks", tasksToDetach);
  }
  if (tasksToDelete.length > 0) {
    await removePlannerRecords("daily_tasks", tasksToDelete);
  }
  if (journeyPathIdsToDelete.length > 0) {
    await removePlannerRecords("epic_journey_paths", journeyPathIdsToDelete);
  }
  if (phases.length > 0) {
    await removePlannerRecords("journey_phases", phases.map((phase) => phase.id));
  }
  if (milestones.length > 0) {
    await removePlannerRecords("epic_milestones", milestones.map((milestone) => milestone.id));
  }
  if (epicHabits.length > 0) {
    await removePlannerRecords("epic_habits", epicHabits.map((link) => link.id));
  }
  if (completionsToDelete.length > 0) {
    await removePlannerRecords("habit_completions", completionsToDelete);
  }
  if (habitsToDelete.length > 0) {
    await removePlannerRecords("habits", habitsToDelete);
  }

  await removePlannerRecord("epics", epicId);

  return {
    epic,
    habitIds,
    deletedPlannerEntities,
  };
}

async function applyRemoteEpicStatusChange(userId: string, epicId: string, status: "completed" | "abandoned") {
  const { error } = await supabase
    .from("epics")
    .update({
      status,
      completed_at: status === "completed" ? new Date().toISOString() : null,
    })
    .eq("id", epicId)
    .eq("user_id", userId);

  if (error) throw error;

  if (status !== "abandoned") {
    return;
  }

  const { data: epicHabits, error: epicHabitsError } = await supabase
    .from("epic_habits")
    .select("id, habit_id")
    .eq("epic_id", epicId);

  if (epicHabitsError) throw epicHabitsError;

  const habitIds = epicHabits?.map((row) => row.habit_id) ?? [];
  if (habitIds.length > 0) {
    await runDailyTaskCleanupUpdate({
        epic_id: null,
        habit_source_id: null,
      }, (update) =>
        supabase
          .from("daily_tasks")
          .update(update)
          .in("habit_source_id", habitIds)
          .eq("user_id", userId)
          .or("completed.eq.true,completed_at.not.is.null")
      );

    const { error: habitsError } = await supabase
      .from("habits")
      .update({ is_active: false })
      .in("id", habitIds)
      .eq("user_id", userId);
    if (habitsError) throw habitsError;

    const today = format(new Date(), "yyyy-MM-dd");
    const { error: tasksError } = await supabase
      .from("daily_tasks")
      .delete()
      .in("habit_source_id", habitIds)
      .gte("task_date", today)
      .eq("user_id", userId)
      .is("completed_at", null)
      .or("completed.is.null,completed.eq.false");
    if (tasksError) throw tasksError;

    const linkIds = epicHabits?.map((row) => row.id) ?? [];
    if (linkIds.length > 0) {
      const { error: linksError } = await supabase
        .from("epic_habits")
        .delete()
        .in("id", linkIds);
      if (linksError) throw linksError;
    }
  }

  await runDailyTaskCleanupUpdate({
      epic_id: null,
      habit_source_id: null,
    }, (update) =>
      supabase
        .from("daily_tasks")
        .update(update)
        .eq("user_id", userId)
        .eq("epic_id", epicId)
        .or("completed.eq.true,completed_at.not.is.null")
    );

  const { error: milestonesError } = await supabase
    .from("epic_milestones")
    .delete()
    .eq("epic_id", epicId)
    .eq("user_id", userId);
  if (milestonesError) throw milestonesError;
}

async function applyRemoteEpicUpdate(
  userId: string,
  epicId: string,
  updates: {
    title?: string;
    description?: string | null;
  },
) {
  const { error } = await supabase
    .from("epics")
    .update(updates)
    .eq("id", epicId)
    .eq("user_id", userId);

  if (error) throw error;
}

async function applyRemoteEpicDelete(userId: string, epicId: string) {
  const excludedFromPlannerAt = new Date().toISOString();
  const { data: epicHabits, error: epicHabitsError } = await supabase
    .from("epic_habits")
    .select("id, habit_id")
    .eq("epic_id", epicId);
  if (epicHabitsError) throw epicHabitsError;

  const habitIds = epicHabits?.map((row) => row.habit_id) ?? [];
  const linkIds = epicHabits?.map((row) => row.id) ?? [];

  if (habitIds.length > 0) {
    await runDailyTaskCleanupUpdate({
        epic_id: null,
        habit_source_id: null,
        excluded_from_planner_at: excludedFromPlannerAt,
      }, (update) =>
        supabase
          .from("daily_tasks")
          .update(update)
          .in("habit_source_id", habitIds)
          .eq("user_id", userId)
          .or("completed.eq.true,completed_at.not.is.null")
      );

    const { error: deleteFutureTasksError } = await supabase
      .from("daily_tasks")
      .delete()
      .in("habit_source_id", habitIds)
      .eq("user_id", userId)
      .is("completed_at", null)
      .or("completed.is.null,completed.eq.false");
    if (deleteFutureTasksError) throw deleteFutureTasksError;

    const { error: deleteHabitsError } = await supabase
      .from("habits")
      .delete()
      .in("id", habitIds)
      .eq("user_id", userId);
    if (deleteHabitsError) throw deleteHabitsError;
  }

  await runDailyTaskCleanupUpdate({
      epic_id: null,
      habit_source_id: null,
      excluded_from_planner_at: excludedFromPlannerAt,
    }, (update) =>
      supabase
        .from("daily_tasks")
        .update(update)
        .eq("user_id", userId)
        .eq("epic_id", epicId)
        .or("completed.eq.true,completed_at.not.is.null")
    );

  const { error: milestonesError } = await supabase
    .from("epic_milestones")
    .delete()
    .eq("epic_id", epicId)
    .eq("user_id", userId);
  if (milestonesError) throw milestonesError;

  const { error: phasesError } = await supabase
    .from("journey_phases")
    .delete()
    .eq("epic_id", epicId)
    .eq("user_id", userId);
  if (phasesError) throw phasesError;

  if (linkIds.length > 0) {
    const { error: linksError } = await supabase
      .from("epic_habits")
      .delete()
      .in("id", linkIds);
    if (linksError) throw linksError;
  }

  const { error: deleteEpicError } = await supabase
    .from("epics")
    .delete()
    .eq("id", epicId)
    .eq("user_id", userId);
  if (deleteEpicError) throw deleteEpicError;
}

export const useEpics = (options: EpicsOptions = {}) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { awardCustomXP } = useXPRewards();
  const { checkFirstTimeAchievements, checkStoryCompletionAchievement } = useAchievements();
  const { trackEpicOutcome } = useAIInteractionTracker();
  const { queueAction, queueTaskAction, shouldQueueWrites, retryNow, reportApiFailure } = useResilience();
  const { enabled = true } = options;
  const [hasHydratedFromRemote, setHasHydratedFromRemote] = useState(() => !enabled || !user?.id);

  const epicsQuery = useQuery({
    queryKey: ["epics", user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      return loadLocalEpics(user.id);
    },
    enabled: enabled && !!user?.id,
    placeholderData: (previousData) => previousData,
    refetchOnWindowFocus: false,
  });

  useEffect(() => {
    if (!enabled || !user?.id) {
      setHasHydratedFromRemote(true);
      return;
    }

    let disposed = false;
    setHasHydratedFromRemote(false);

    const refreshFromRemote = async () => {
      try {
        await warmEpicsQueryFromRemote(queryClient, user.id);
        if (disposed) return;
      } catch (error) {
        console.warn("Failed to sync local epics from remote:", error);
      } finally {
        if (!disposed) {
          setHasHydratedFromRemote(true);
        }
      }
    };

    void refreshFromRemote();

    const handlePlannerSync = () => {
      void refreshFromRemote();
    };

    window.addEventListener(PLANNER_SYNC_EVENT, handlePlannerSync);
    return () => {
      disposed = true;
      window.removeEventListener(PLANNER_SYNC_EVENT, handlePlannerSync);
    };
  }, [enabled, queryClient, user?.id]);

  const epics = epicsQuery.data ?? [];

  const createEpicMutation = useMutation({
    mutationFn: async (epicData: CreateEpicInput): Promise<CreateEpicMutationResult> => {
      if (!user?.id) {
        throw new Error("Not authenticated. Please refresh and try again.");
      }

      return withPlannerRemoteSyncLock(user.id, async () => {
        const createAttemptId = `epic-create-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        const createStartedAt = Date.now();
        let localPersistMs: number | null = null;
        let remotePersistMs: number | null = null;

        if (!epicData.habits || epicData.habits.length === 0) {
          throw new Error("Campaign must have at least one ritual");
        }

        const invalidPhase = (epicData.phases ?? []).find(
          (phase) => !phase.start_date || !phase.end_date || !Number.isFinite(Number(phase.phase_order)),
        );
        if (invalidPhase) {
          throw new Error("Campaign phase dates are missing. Please rebuild the plan and try again.");
        }

        const normalizedInputMilestonePercents = normalizeCampaignMilestonePercentArray(
          (epicData.milestones ?? []).map((milestone) => milestone.milestone_percent),
        );
        if (normalizedInputMilestonePercents.some((percent) => !isValidCampaignMilestonePercent(percent))) {
          throw new Error("Campaign milestone percentages must be whole numbers from 1 to 100.");
        }

        const fingerprint = buildCampaignCreateFingerprint(user.id, epicData);
        const recentMatch = await reconcileRecentEpicCreate(user.id, fingerprint);
        if (recentMatch) {
          trackResilienceEvent("campaign_create_result", {
            attemptId: createAttemptId,
            result: recentMatch.queued ? "reused_queued" : "reused_existing",
            fingerprint,
            totalMs: Date.now() - createStartedAt,
          });
          return {
            queued: recentMatch.queued,
            epic: recentMatch.epic,
            isNewCreate: false,
          };
        }

        if (hasReachedActiveCampaignLimit(epics.filter((epic) => epic.status === "active").length)) {
          throw new Error(ACTIVE_CAMPAIGN_LIMIT_MESSAGE);
        }

        const rememberedPayload = getRememberedEpicCreatePayload(fingerprint);
        const existingCampaignRitualSchedulingBlocks = rememberedPayload
          ? []
          : collectActiveCampaignRitualSchedulingBlocks(await loadLocalEpics(user.id));
        const payload: LocalEpicPayload = rememberedPayload
          ? withNormalizedCampaignMilestonePercents(rememberedPayload)
          : (() => {
            const nowIso = new Date().toISOString();
            const startDate = nowIso.split("T")[0];
            const epicId = createOfflinePlannerId("epic");
            const inviteCode = `EPIC-${Math.random().toString(36).substring(2, 10).toUpperCase()}`;
            const occupiedRitualBlocks = [...existingCampaignRitualSchedulingBlocks];
            const habits = epicData.habits.map((habit, index) => {
              const frequency = normalizeFrequency(habit.frequency);
              const customDays = habit.custom_days?.length ? habit.custom_days : null;
              const customMonthDays = habit.custom_month_days?.length ? habit.custom_month_days : null;
              const estimatedMinutes = normalizeCampaignHabitEstimatedMinutes(
                habit.estimated_minutes,
                habit.estimatedMinutes,
              );
              const preferredTime = chooseSmartCampaignRitualTime({
                preferredTime: normalizeCampaignHabitPreferredTime([habit.preferred_time, habit.preferredTime], null),
                fallbackTime: CAMPAIGN_RITUAL_TIME_FALLBACKS[index % CAMPAIGN_RITUAL_TIME_FALLBACKS.length],
                estimatedMinutes,
                scheduleInput: {
                  frequency,
                  custom_days: customDays,
                  custom_month_days: customMonthDays,
                },
                occupied: occupiedRitualBlocks,
              });
              const nextHabit: LocalHabitRow = {
                id: createOfflinePlannerId("habit"),
                user_id: user.id,
                title: habit.title,
                description: habit.description || null,
                difficulty: normalizeDifficulty(habit.difficulty),
                frequency,
                custom_days: customDays,
                custom_month_days: customMonthDays,
                preferred_time: preferredTime,
                reminder_enabled: habit.reminder_enabled || false,
                reminder_minutes_before: habit.reminder_minutes_before || 15,
                estimated_minutes: estimatedMinutes,
                category: habit.category?.trim() || null,
                is_active: true,
                current_streak: 0,
                longest_streak: 0,
                created_at: nowIso,
              };
              const block = buildCampaignRitualSchedulingBlock(nextHabit);
              if (block) occupiedRitualBlocks.push(block);

              return nextHabit;
            }) satisfies LocalHabitRow[];

            const epic: LocalEpicRow = {
              id: epicId,
              user_id: user.id,
              title: epicData.title,
              description: epicData.description || null,
              status: "active",
              progress_percentage: 0,
              target_days: epicData.target_days,
              start_date: startDate,
              end_date: resolveEpicEndDate({
                start_date: startDate,
                target_days: epicData.target_days,
              }),
              epic_habits: [],
              xp_reward: Math.floor(epicData.target_days * 10),
              is_public: epicData.is_public ?? false,
              invite_code: inviteCode,
              theme_color: normalizeThemeColor(epicData.theme_color),
              story_type_slug: epicData.story_type_slug || null,
              created_at: nowIso,
              completed_at: null,
            } as LocalEpicRow;

            const epicHabits = habits.map((habit) => ({
              id: createOfflinePlannerId("epic-habit"),
              epic_id: epicId,
              habit_id: habit.id,
            }));

            const phases = (epicData.phases ?? []).map((phase) => ({
              id: createOfflinePlannerId("journey-phase"),
              epic_id: epicId,
              user_id: user.id,
              name: phase.name,
              description: phase.description,
              start_date: phase.start_date,
              end_date: phase.end_date,
              phase_order: phase.phase_order,
            }));

            const milestones = (epicData.milestones ?? []).map((milestone, index) => ({
              id: createOfflinePlannerId("epic-milestone"),
              epic_id: epicId,
              user_id: user.id,
              title: milestone.title,
              description: milestone.description || null,
              target_date: milestone.target_date,
              milestone_percent: normalizedInputMilestonePercents[index] ?? milestone.milestone_percent,
              is_postcard_milestone: milestone.is_postcard_milestone ?? false,
              phase_order: index + 1,
              phase_name: milestone.phase_name || milestone.phaseName || null,
            }));

            return {
              epic,
              habits,
              epicHabits,
              phases,
              milestones,
            };
          })();

        if (!rememberedPayload) {
          rememberEpicCreateAttempt(fingerprint, payload);
        }

        const { epic, habits, epicHabits, phases, milestones } = payload;
        const shouldUseIdempotentRemoteWrite = Boolean(rememberedPayload);
        let taskReconciliation: HabitTaskReconciliationAggregate | null = null;

        const reconcileAfterRemoteRefresh = async (): Promise<EpicCreateMatch | null> => {
          const retryDelaysMs = [0, 350, 1200];

          for (const delayMs of retryDelaysMs) {
            if (delayMs > 0) {
              await wait(delayMs);
            }

            const directMatch = await reconcileRecentEpicCreate(user.id, fingerprint);
            if (directMatch) {
              return directMatch;
            }

            try {
              await warmEpicsQueryFromRemote(queryClient, user.id);
            } catch (refreshError) {
              console.warn("Failed to refresh remote campaigns during create reconciliation:", refreshError);
            }

            const refreshedMatch = await reconcileRecentEpicCreate(user.id, fingerprint);
            if (refreshedMatch) {
              return refreshedMatch;
            }
          }

          return null;
        };

        if (shouldQueueWrites) {
          const localPersistStartedAt = Date.now();
          await applyLocalEpicPayload(payload);
          taskReconciliation = await reconcileAndApplyLocalCampaignHabitTasks(user.id, habits);
          localPersistMs = Date.now() - localPersistStartedAt;
          await queueAction({
            actionKind: "EPIC_CREATE",
            entityType: "epic",
            entityId: epic.id,
            payload,
          });
          await queueHabitTaskReconciliation(taskReconciliation, queueTaskAction);
          trackResilienceEvent("campaign_create_result", {
            attemptId: createAttemptId,
            result: "queued_offline",
            fingerprint,
            localPersistMs,
            totalMs: Date.now() - createStartedAt,
          });
          return { queued: true, epic, isNewCreate: true };
        }

        const { data: activeCampaignCount, error: countError } = await supabase.rpc("count_user_epics", {
          p_user_id: user.id,
        });
        if (countError) {
          console.error("Failed to check active campaign limit (continuing):", countError);
        } else if (hasReachedActiveCampaignLimit(activeCampaignCount ?? 0)) {
          throw new Error(ACTIVE_CAMPAIGN_LIMIT_MESSAGE);
        }

        const localPersistStartedAt = Date.now();
        await applyLocalEpicPayload(payload);
        taskReconciliation = await reconcileAndApplyLocalCampaignHabitTasks(user.id, habits);
        localPersistMs = Date.now() - localPersistStartedAt;

        try {
          const remotePersistStartedAt = Date.now();
          const { error: habitsError } = shouldUseIdempotentRemoteWrite
            ? await supabase.from("habits").upsert(habits)
            : await supabase.from("habits").insert(habits);
          if (habitsError) throw habitsError;

          const { error: epicError } = shouldUseIdempotentRemoteWrite
            ? await supabase.from("epics").upsert(toRemoteEpicInsertPayload(epic))
            : await supabase.from("epics").insert(toRemoteEpicInsertPayload(epic));
          if (epicError) throw epicError;

          if (epicHabits.length > 0) {
            const { error: linkError } = shouldUseIdempotentRemoteWrite
              ? await supabase.from("epic_habits").upsert(epicHabits)
              : await supabase.from("epic_habits").insert(epicHabits);
            if (linkError) throw linkError;
          }

          if (phases.length > 0) {
            const { error: phasesError } = shouldUseIdempotentRemoteWrite
              ? await supabase.from("journey_phases").upsert(phases)
              : await supabase.from("journey_phases").insert(phases);
            if (phasesError) throw phasesError;
          }

          if (milestones.length > 0) {
            const { error: milestonesError } = shouldUseIdempotentRemoteWrite
              ? await supabase.from("epic_milestones").upsert(milestones)
              : await supabase.from("epic_milestones").insert(milestones);
            if (milestonesError) throw milestonesError;
          }

          await persistRemoteHabitTaskReconciliation(user.id, taskReconciliation, {
            queueTaskAction,
            retryNow,
          });

          remotePersistMs = Date.now() - remotePersistStartedAt;
          trackResilienceEvent("campaign_create_result", {
            attemptId: createAttemptId,
            result: "created",
            fingerprint,
            localPersistMs,
            remotePersistMs,
            totalMs: Date.now() - createStartedAt,
          });
          return { queued: false, epic, isNewCreate: true };
        } catch (error) {
          if (isQueueableWriteError(error)) {
            const queuedMatch = await findRecentMatchingQueuedEpicCreate(user.id, fingerprint);
            if (!queuedMatch) {
              await queueAction({
                actionKind: "EPIC_CREATE",
                entityType: "epic",
                entityId: epic.id,
                payload,
              });
            }
            if (taskReconciliation) {
              await queueHabitTaskReconciliation(taskReconciliation, queueTaskAction);
            }
            void retryNow();
            trackResilienceEvent("campaign_create_result", {
              attemptId: createAttemptId,
              result: "queued_after_network_error",
              fingerprint,
              localPersistMs,
              remotePersistMs,
              totalMs: Date.now() - createStartedAt,
            });
            return { queued: true, epic, isNewCreate: true };
          }

          try {
            await rollbackLocalHabitTaskReconciliation(taskReconciliation);
            await rollbackLocalEpicPayload(payload);
            await refreshEpicsQueryFromLocalStore(queryClient, user.id);
          } catch (rollbackError) {
            console.warn("Failed to roll back local campaign after create error:", rollbackError);
          }

          try {
            await rollbackRemoteEpicPayload(user.id, payload);
          } catch (rollbackError) {
            console.warn("Failed to roll back remote campaign after create error:", rollbackError);
          }

          const recoveredMatch = await reconcileAfterRemoteRefresh();
          if (recoveredMatch) {
            trackResilienceEvent("campaign_create_result", {
              attemptId: createAttemptId,
              result: recoveredMatch.queued ? "recovered_queued" : "recovered_remote",
              fingerprint,
              localPersistMs,
              remotePersistMs,
              totalMs: Date.now() - createStartedAt,
            });
            return {
              queued: recoveredMatch.queued,
              epic: recoveredMatch.epic,
              isNewCreate: false,
            };
          }

          reportApiFailure(error, {
            source: "campaign_create_nonqueueable",
            attemptId: createAttemptId,
            fingerprint,
            localPersistMs,
            remotePersistMs,
          });
          trackResilienceEvent("campaign_create_result", {
            attemptId: createAttemptId,
            result: "failed",
            fingerprint,
            localPersistMs,
            remotePersistMs,
            totalMs: Date.now() - createStartedAt,
          });
          throw error;
        }
      });
    },
    onSuccess: async ({ queued, epic, isNewCreate }) => {
      queryClient.invalidateQueries({ queryKey: ["epics"] });
      queryClient.invalidateQueries({ queryKey: ["habits"] });
      queryClient.invalidateQueries({ queryKey: ["habit-surfacing"] });
      queryClient.invalidateQueries({ queryKey: ["daily-tasks"] });
      queryClient.invalidateQueries({ queryKey: ["user-ai-context"] });
      queryClient.invalidateQueries({ queryKey: DAILY_PLAN_OPTIMIZATION_QUERY_KEY });

      if (!queued && isNewCreate) {
        try {
          await awardCustomXP(
            CAMPAIGN_XP_REWARDS.CREATE,
            "campaign_create",
            "Campaign Created!",
            {
              epic_id: epic.id,
              campaign_title: epic.title,
            },
            `campaign_create:${epic.id}`,
          );
        } catch (error) {
          console.error("Failed to award campaign creation XP:", error);
        }
      }

      if (!queued && isNewCreate && user?.id) {
        const { count } = await supabase
          .from("epics")
          .select("*", { count: "exact", head: true })
          .eq("user_id", user.id);

        if ((count ?? 0) === 1) {
          await checkFirstTimeAchievements("epic");
        }
      }

      if (!queued && isNewCreate && user?.id) {
        void requestJourneyPathGeneration({
          epicId: epic.id,
          milestoneIndex: 0,
          queryClient,
          userId: user.id,
        }).catch((error) => {
          console.error("Failed to generate initial journey path:", error);
        });
      }

      window.dispatchEvent(new CustomEvent("campaign-created"));
      toast.success(queued ? "Campaign saved offline" : "Campaign created! 🎯", {
        description: queued
          ? "Your campaign will sync when you're back online."
          : "Your companion is excited for this new journey!",
      });
    },
    onError: (error) => {
      console.error("Failed to create campaign:", error);
      reportApiFailure(error, { source: "campaign_create_onError" });
      const normalized = normalizeCreateCampaignError(error);
      toast.error(normalized.title, {
        description: normalized.description,
      });
    },
  });

  const createEpic = useCallback((epicData: CreateEpicInput) => {
    if (!user?.id) {
      return createEpicMutation.mutateAsync(epicData);
    }

    const fingerprint = buildCampaignCreateFingerprint(user.id, epicData);
    const existingRequest = inFlightEpicCreateRequests.get(fingerprint);
    if (existingRequest) {
      trackResilienceEvent("campaign_create_result", {
        result: "deduped_inflight",
        fingerprint,
      });
      return existingRequest;
    }

    const nextRequest = createEpicMutation
      .mutateAsync(epicData)
      .finally(() => {
        if (inFlightEpicCreateRequests.get(fingerprint) === nextRequest) {
          inFlightEpicCreateRequests.delete(fingerprint);
        }
      });

    inFlightEpicCreateRequests.set(fingerprint, nextRequest);
    return nextRequest;
  }, [createEpicMutation, user?.id]);

  const updateEpicStatus = useMutation({
    mutationFn: async ({
      epicId,
      status,
    }: {
      epicId: string;
      status: "completed" | "abandoned";
    }) => {
      if (!user?.id) {
        throw new Error("User not authenticated");
      }

      return withPlannerRemoteSyncLock(user.id, async () => {
        const epic = epics.find((candidate) => candidate.id === epicId);
        if (!epic) {
          throw new Error("Epic not found or you don't have permission");
        }

        if (epic.status === "completed" && status === "completed") {
          throw new Error("Epic is already completed");
        }

        await applyLocalEpicStatusChange(user.id, epicId, status);
        await refreshEpicsQueryFromLocalStore(queryClient, user.id);

        if (shouldQueueWrites) {
          await queueAction({
            actionKind: "EPIC_STATUS_UPDATE",
            entityType: "epic",
            entityId: epicId,
            payload: { epicId, status },
          });
          return { epic, status, wasAlreadyCompleted: epic.status === "completed", queued: true };
        }

        try {
          await applyRemoteEpicStatusChange(user.id, epicId, status);
        } catch (error) {
          await queueAction({
            actionKind: "EPIC_STATUS_UPDATE",
            entityType: "epic",
            entityId: epicId,
            payload: { epicId, status },
          });
          void retryNow();
          return { epic, status, wasAlreadyCompleted: epic.status === "completed", queued: true };
        }

        return { epic, status, wasAlreadyCompleted: epic.status === "completed", queued: false };
      });
    },
    onSuccess: async ({ epic, status, wasAlreadyCompleted, queued }, variables) => {
      queryClient.invalidateQueries({ queryKey: ["epics"] });
      queryClient.invalidateQueries({ queryKey: ["habits"] });
      queryClient.invalidateQueries({ queryKey: ["habit-surfacing"] });
      queryClient.invalidateQueries({ queryKey: ["daily-tasks"] });
      queryClient.invalidateQueries({ queryKey: ["calendar-tasks"] });
      queryClient.invalidateQueries({ queryKey: ["user-ai-context"] });
      queryClient.resetQueries({ queryKey: DAILY_PLAN_OPTIMIZATION_QUERY_KEY });
      dispatchPlannerSyncFinished();

      if (status === "completed" || status === "abandoned") {
        trackEpicOutcome(variables.epicId, status).catch((err) => {
          console.error("Failed to track epic outcome:", err);
        });
      }

      if (queued) {
        toast(status === "abandoned" ? "Campaign abandoned offline" : "Campaign completed offline", {
          description: "We'll sync this campaign change when you're back online.",
        });
        return;
      }

      if (status === "completed" && !wasAlreadyCompleted) {
        try {
          await awardCustomXP(
            epic.xp_reward ?? 0,
            "epic_complete",
            `Epic "${epic.title}" Completed!`,
            { epic_id: variables?.epicId },
          );
        } catch (error) {
          console.error("Failed to award epic completion XP:", error);
        }
        await checkStoryCompletionAchievement(epic.story_type_slug);
        toast.success("Epic Completed! 🏆", {
          description: `You've conquered the ${epic.title} epic! Your companion grows stronger!`,
        });
      } else if (status === "abandoned") {
        toast("Epic abandoned", {
          description: "You can always start a new epic when ready.",
        });
      }
    },
    onError: (error) => {
      console.error("Failed to update epic:", error);
      toast.error("Failed to update epic status");
    },
  });

  const updateEpic = useMutation({
    mutationFn: async ({
      epicId,
      updates,
    }: {
      epicId: string;
      updates: {
        title?: string;
        description?: string | null;
      };
    }) => {
      if (!user?.id) {
        throw new Error("User not authenticated");
      }

      return withPlannerRemoteSyncLock(user.id, async () => {
        const normalizedUpdates: { title?: string; description?: string | null } = {};
        if (updates.title !== undefined) {
          const trimmedTitle = updates.title.trim();
          if (!trimmedTitle) {
            throw new Error("Campaign title cannot be empty");
          }
          normalizedUpdates.title = trimmedTitle;
        }

        if (updates.description !== undefined) {
          const trimmedDescription = updates.description?.trim() ?? "";
          normalizedUpdates.description = trimmedDescription.length > 0 ? trimmedDescription : null;
        }

        if (Object.keys(normalizedUpdates).length === 0) {
          throw new Error("No campaign changes were provided");
        }

        if (normalizedUpdates.title !== undefined && normalizedUpdates.title.length === 0) {
          throw new Error("Campaign title cannot be empty");
        }

        const epic = epics.find((candidate) => candidate.id === epicId);
        if (!epic) {
          throw new Error("Epic not found or you don't have permission");
        }

        if (epic.status !== "active") {
          throw new Error("Only active campaigns can be edited");
        }

        const hasTitleChange = normalizedUpdates.title !== undefined && epic.title !== normalizedUpdates.title;
        const hasDescriptionChange = normalizedUpdates.description !== undefined && (epic.description ?? null) !== normalizedUpdates.description;

        if (!hasTitleChange && !hasDescriptionChange) {
          return { epic, updates: normalizedUpdates, queued: false };
        }

        const nextEpic = await applyLocalEpicUpdate(user.id, epicId, normalizedUpdates);

        queryClient.setQueryData<EpicRecord[] | undefined>(getEpicsQueryKey(user.id), (previous) =>
          previous?.map((candidate) => (
            candidate.id === epicId
              ? {
                  ...candidate,
                  ...(normalizedUpdates.title !== undefined ? { title: normalizedUpdates.title } : {}),
                  ...(normalizedUpdates.description !== undefined ? { description: normalizedUpdates.description } : {}),
                }
              : candidate
          )) ?? previous,
        );

        if (shouldQueueWrites) {
          await queueAction({
            actionKind: "EPIC_UPDATE",
            entityType: "epic",
            entityId: epicId,
            payload: {
              epicId,
              updates: normalizedUpdates,
            },
          });
          return { epic: nextEpic, updates: normalizedUpdates, queued: true };
        }

        try {
          await applyRemoteEpicUpdate(user.id, epicId, normalizedUpdates);
        } catch (error) {
          await queueAction({
            actionKind: "EPIC_UPDATE",
            entityType: "epic",
            entityId: epicId,
            payload: {
              epicId,
              updates: normalizedUpdates,
            },
          });
          void retryNow();
          return { epic: nextEpic, updates: normalizedUpdates, queued: true };
        }

        return { epic: nextEpic, updates: normalizedUpdates, queued: false };
      });
    },
    onSuccess: ({ queued, updates }) => {
      queryClient.invalidateQueries({ queryKey: ["epics"] });
      queryClient.invalidateQueries({ queryKey: ["daily-tasks"] });
      queryClient.invalidateQueries({ queryKey: ["calendar-tasks"] });
      queryClient.invalidateQueries({ queryKey: ["habit-surfacing"] });
      queryClient.invalidateQueries({ queryKey: ["user-ai-context"] });
      queryClient.invalidateQueries({ queryKey: DAILY_PLAN_OPTIMIZATION_QUERY_KEY });
      dispatchPlannerSyncFinished();

      const changedKeys = Object.keys(updates);
      const titleOnly = changedKeys.length === 1 && changedKeys[0] === "title";
      const title = typeof updates.title === "string" ? updates.title : null;

      toast.success(
        queued
          ? (titleOnly ? "Campaign rename saved offline" : "Campaign update saved offline")
          : (titleOnly ? "Campaign renamed" : "Campaign updated"),
        {
          description: queued
            ? "Your campaign changes will sync when you're back online."
            : titleOnly && title
              ? `Now titled "${title}".`
              : "Your campaign details are up to date.",
        },
      );
    },
    onError: (error) => {
      console.error("Failed to update epic:", error);
      toast.error("Failed to update campaign");
    },
  });

  const deleteEpic = useMutation({
    mutationFn: async ({
      epicId,
    }: {
      epicId: string;
    }) => {
      if (!user?.id) {
        throw new Error("User not authenticated");
      }

      return withPlannerRemoteSyncLock(user.id, async () => {
        const epic = epics.find((candidate) => candidate.id === epicId);
        if (!epic) {
          throw new Error("Epic not found or you don't have permission");
        }

        if (epic.status !== "active") {
          throw new Error("Only active campaigns can be deleted");
        }

        const localDelete = await applyLocalEpicDelete(user.id, epicId);
        await forgetDeletedPlannerEntities({
          userId: user.id,
          source: "campaign_delete",
          entities: localDelete.deletedPlannerEntities,
        });
        await refreshEpicsQueryFromLocalStore(queryClient, user.id);

        const epicCreatedAt = typeof epic.created_at === "string"
          ? epic.created_at
          : null;

        if (shouldQueueWrites) {
          await queueAction({
            actionKind: "EPIC_DELETE",
            entityType: "epic",
            entityId: epicId,
            payload: {
              epicId,
              epicTitle: epic.title,
              epicCreatedAt,
              deletedPlannerEntities: localDelete.deletedPlannerEntities,
            },
          });
          return { epic, queued: true };
        }

        try {
          await applyRemoteEpicDelete(user.id, epicId);
        } catch (error) {
          await queueAction({
            actionKind: "EPIC_DELETE",
            entityType: "epic",
            entityId: epicId,
            payload: {
              epicId,
              epicTitle: epic.title,
              epicCreatedAt,
              deletedPlannerEntities: localDelete.deletedPlannerEntities,
            },
          });
          void retryNow();
          return { epic, queued: true };
        }

        return { epic, queued: false };
      });
    },
    onSuccess: ({ epic, queued }) => {
      queryClient.invalidateQueries({ queryKey: ["epics"] });
      queryClient.invalidateQueries({ queryKey: ["habits"] });
      queryClient.invalidateQueries({ queryKey: ["daily-tasks"] });
      queryClient.invalidateQueries({ queryKey: ["calendar-tasks"] });
      queryClient.invalidateQueries({ queryKey: ["habit-surfacing"] });
      queryClient.invalidateQueries({ queryKey: ["user-ai-context"] });
      queryClient.invalidateQueries({ queryKey: ["milestones", epic.id] });
      queryClient.resetQueries({ queryKey: DAILY_PLAN_OPTIMIZATION_QUERY_KEY });
      dispatchPlannerSyncFinished();

      toast.success(queued ? "Campaign deletion saved offline" : "Campaign deleted", {
        description: queued
          ? `We'll remove "${epic.title}" from the cloud when you're back online.`
          : `"${epic.title}" and its linked rituals were removed.`,
      });
    },
    onError: (error) => {
      console.error("Failed to delete epic:", error);
      toast.error("Failed to delete campaign");
    },
  });

  const deleteCampaignRitual = useMutation({
    mutationFn: async (input: DeleteCampaignRitualInput): Promise<{ queued: boolean }> => {
      if (!user?.id) {
        throw new Error("User not authenticated");
      }

      return withPlannerRemoteSyncLock(user.id, async () => {
        const localEpics = await loadLocalEpics(user.id);
        const epic = localEpics.find((candidate) => candidate.id === input.epicId);
        if (!epic) {
          throw new Error("Campaign not found");
        }

        if (epic.status !== "active") {
          throw new Error("Only active campaign rituals can be deleted");
        }

        const localDelete = await applyLocalCampaignRitualDelete(
          user.id,
          input,
          epic,
        );
        await forgetDeletedPlannerEntities({
          userId: user.id,
          source: "campaign_ritual_delete",
          entities: localDelete.deletedPlannerEntities,
        });
        await refreshEpicsQueryFromLocalStore(queryClient, user.id);
        scrubCampaignRitualTaskCaches(queryClient, input.habitId);

        if (shouldQueueWrites) {
          await queueAction({
            actionKind: "EPIC_RITUAL_DELETE",
            entityType: "epic",
            entityId: input.epicId,
            payload: {
              ...input,
              deletedPlannerEntities: localDelete.deletedPlannerEntities,
            },
          });
          return { queued: true };
        }

        try {
          await applyRemoteCampaignRitualDelete(user.id, input);
        } catch (error) {
          await queueAction({
            actionKind: "EPIC_RITUAL_DELETE",
            entityType: "epic",
            entityId: input.epicId,
            payload: {
              ...input,
              deletedPlannerEntities: localDelete.deletedPlannerEntities,
            },
          });
          void retryNow();
          return { queued: true };
        }

        return { queued: false };
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["epics"] });
      queryClient.invalidateQueries({ queryKey: ["habits"] });
      queryClient.invalidateQueries({ queryKey: ["daily-tasks"] });
      queryClient.invalidateQueries({ queryKey: ["calendar-tasks"] });
      queryClient.invalidateQueries({ queryKey: ["habit-surfacing"] });
      queryClient.invalidateQueries({ queryKey: ["user-ai-context"] });
      queryClient.resetQueries({ queryKey: DAILY_PLAN_OPTIMIZATION_QUERY_KEY });
      dispatchPlannerSyncFinished();
    },
    onError: (error) => {
      console.error("Failed to delete campaign ritual:", error);
      toast.error("Failed to delete ritual");
    },
  });

  const createCampaignRitual = useMutation({
    mutationFn: async (input: CreateCampaignRitualInput): Promise<CreateCampaignRitualResult> => {
      if (!user?.id) {
        throw new Error("User not authenticated");
      }

      return withPlannerRemoteSyncLock(user.id, async () => {
        const trimmedTitle = input.title.trim();
        if (!trimmedTitle) {
          throw new Error("Ritual title cannot be empty");
        }

        const localEpics = await loadLocalEpics(user.id);
        const epic = localEpics.find((candidate) => candidate.id === input.epicId);
        if (!epic) {
          throw new Error("Campaign not found");
        }

        if (epic.status !== "active") {
          throw new Error("Only active campaigns can receive new rituals");
        }

        const frequency = normalizeFrequency(input.frequency);
        const customDays = input.customDays?.length ? [...input.customDays] : null;
        const customMonthDays = input.customMonthDays?.length ? [...input.customMonthDays] : null;
        const estimatedMinutes = normalizeCampaignHabitEstimatedMinutes(input.estimatedMinutes);
        const occupiedRitualBlocks = collectActiveCampaignRitualSchedulingBlocks(localEpics);
        const preferredTime = chooseSmartCampaignRitualTime({
          preferredTime: normalizeCampaignHabitPreferredTime([input.preferredTime], null),
          fallbackTime: CAMPAIGN_RITUAL_TIME_FALLBACKS[
            (epic.epic_habits?.length ?? occupiedRitualBlocks.length) % CAMPAIGN_RITUAL_TIME_FALLBACKS.length
          ],
          estimatedMinutes,
          scheduleInput: {
            frequency,
            custom_days: customDays,
            custom_month_days: customMonthDays,
          },
          occupied: occupiedRitualBlocks,
        });

        const payload: LocalCampaignRitualPayload = {
          habit: {
            id: createOfflinePlannerId("habit"),
            user_id: user.id,
            title: trimmedTitle,
            description: input.description?.trim() ? input.description.trim() : null,
            difficulty: normalizeDifficulty(input.difficulty),
            frequency,
            estimated_minutes: estimatedMinutes,
            preferred_time: preferredTime,
            category: input.category ?? null,
            custom_days: customDays,
            custom_month_days: customMonthDays,
            reminder_enabled: input.reminderEnabled ?? false,
            reminder_minutes_before: input.reminderMinutesBefore ?? 15,
            is_active: true,
            current_streak: 0,
            longest_streak: 0,
            created_at: new Date().toISOString(),
            sort_order: null,
          },
          epicHabit: {
            id: createOfflinePlannerId("epic-habit"),
            epic_id: input.epicId,
            habit_id: "",
          },
        };
        payload.epicHabit.habit_id = payload.habit.id;

        await applyLocalCampaignRitualPayload(payload);
        const taskReconciliation = await reconcileAndApplyLocalCampaignHabitTasks(user.id, [payload.habit]);
        await refreshEpicsQueryFromLocalStore(queryClient, user.id);
        await queryClient.invalidateQueries({ queryKey: ["epics"] });
        dispatchPlannerSyncFinished();

        if (shouldQueueWrites) {
          await queueAction({
            actionKind: "EPIC_RITUAL_CREATE",
            entityType: "epic",
            entityId: input.epicId,
            payload,
          });
          await queueHabitTaskReconciliation(taskReconciliation, queueTaskAction);
          return {
            queued: true,
            habit: payload.habit,
            epicHabit: payload.epicHabit,
          };
        }

        try {
          const { error: habitError } = await supabase
            .from("habits")
            .insert(payload.habit);
          if (habitError) throw habitError;

          const { error: epicHabitError } = await supabase
            .from("epic_habits")
            .insert(payload.epicHabit);
          if (epicHabitError) throw epicHabitError;

          await persistRemoteHabitTaskReconciliation(user.id, taskReconciliation, {
            queueTaskAction,
            retryNow,
          });

          return {
            queued: false,
            habit: payload.habit,
            epicHabit: payload.epicHabit,
          };
        } catch (error) {
          if (!isQueueableWriteError(error)) {
            try {
              await rollbackLocalHabitTaskReconciliation(taskReconciliation);
              await rollbackLocalCampaignRitualPayload(payload);
              await refreshEpicsQueryFromLocalStore(queryClient, user.id);
              await queryClient.invalidateQueries({ queryKey: ["epics"] });
              dispatchPlannerSyncFinished();
            } catch (rollbackError) {
              console.warn("Failed to roll back local campaign ritual after create error:", rollbackError);
            }

            try {
              await rollbackRemoteCampaignRitualPayload(user.id, payload);
            } catch (rollbackError) {
              console.warn("Failed to roll back remote campaign ritual after create error:", rollbackError);
            }

            throw error;
          }

          await queueAction({
            actionKind: "EPIC_RITUAL_CREATE",
            entityType: "epic",
            entityId: input.epicId,
            payload,
          });
          await queueHabitTaskReconciliation(taskReconciliation, queueTaskAction);
          void retryNow();
          return {
            queued: true,
            habit: payload.habit,
            epicHabit: payload.epicHabit,
          };
        }
      });
    },
    onSuccess: ({ queued, habit }) => {
      queryClient.invalidateQueries({ queryKey: ["epics"] });
      queryClient.invalidateQueries({ queryKey: ["habits"] });
      queryClient.invalidateQueries({ queryKey: ["habit-surfacing"] });
      queryClient.invalidateQueries({ queryKey: ["daily-tasks"] });
      queryClient.invalidateQueries({ queryKey: ["calendar-tasks"] });
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      queryClient.invalidateQueries({ queryKey: ["user-ai-context"] });

      toast.success(queued ? "Ritual saved offline" : "Ritual added to campaign!", {
        description: queued
          ? "Your new ritual will sync when you're back online."
          : `"${habit.title}" is now part of this campaign.`,
      });
    },
    onError: (error) => {
      console.error("Failed to create campaign ritual:", error);
      toast.error("Failed to add ritual");
    },
  });

  const addHabitToEpic = useMutation({
    mutationFn: async ({
      epicId,
      habitId,
    }: {
      epicId: string;
      habitId: string;
    }) => {
      if (!epicId || !habitId) {
        throw new Error("Invalid epic or habit ID");
      }

      const existing = await getLocalEpicHabits<Array<{ id: string; epic_id: string; habit_id: string }>[number]>([epicId]);
      if (existing.some((row) => row.habit_id === habitId)) {
        throw new Error("Habit is already linked to this epic");
      }

      const row = {
        id: createOfflinePlannerId("epic-habit"),
        epic_id: epicId,
        habit_id: habitId,
      };
      await upsertPlannerRecord("epic_habits", row);

      const { error } = await supabase
        .from("epic_habits")
        .insert(row);

      if (error) {
        console.error("Failed to link habit to epic:", error);
        throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["epics"] });
      toast.success("Habit linked to epic! ⚔️");
    },
    onError: (error) => {
      console.error("Failed to link habit:", error);
      toast.error("Failed to link habit to epic");
    },
  });

  const removeHabitFromEpic = useMutation({
    mutationFn: async ({
      epicId,
      habitId,
    }: {
      epicId: string;
      habitId: string;
    }) => {
      if (!epicId || !habitId) {
        throw new Error("Invalid epic or habit ID");
      }

      if (!user?.id) {
        throw new Error("User not authenticated");
      }

      return withPlannerRemoteSyncLock(user.id, async () => {
        const input = { epicId, habitId };
        await applyLocalCampaignHabitUnlink(user.id, input);
        await refreshEpicsQueryFromLocalStore(queryClient, user.id);
        scrubUnlinkedCampaignHabitTaskCaches(queryClient, input);

        if (shouldQueueWrites) {
          await queueAction({
            actionKind: "EPIC_HABIT_UNLINK",
            entityType: "epic",
            entityId: epicId,
            payload: input,
          });
          return { queued: true };
        }

        try {
          await applyRemoteCampaignHabitUnlink(user.id, input);
        } catch (error) {
          await queueAction({
            actionKind: "EPIC_HABIT_UNLINK",
            entityType: "epic",
            entityId: epicId,
            payload: input,
          });
          void retryNow();
          return { queued: true };
        }

        return { queued: false };
      });
    },
    onSuccess: ({ queued }) => {
      queryClient.invalidateQueries({ queryKey: ["epics"] });
      queryClient.invalidateQueries({ queryKey: ["daily-tasks"] });
      queryClient.invalidateQueries({ queryKey: ["calendar-tasks"] });
      queryClient.invalidateQueries({ queryKey: ["habit-surfacing"] });
      queryClient.invalidateQueries({ queryKey: ["user-ai-context"] });
      queryClient.resetQueries({ queryKey: DAILY_PLAN_OPTIMIZATION_QUERY_KEY });
      dispatchPlannerSyncFinished();
      toast(queued ? "Habit unlink saved offline" : "Habit removed from epic");
    },
    onError: (error) => {
      console.error("Failed to remove habit:", error);
      toast.error("Failed to remove habit from epic");
    },
  });

  const activeEpics = epics.filter((epic) => epic.status === "active");
  const completedEpics = epics.filter((epic) => epic.status === "completed");
  const isAwaitingInitialHydration = enabled && !!user?.id && !hasHydratedFromRemote && epics.length === 0;

  return {
    epics,
    activeEpics,
    completedEpics,
    isLoading: (epicsQuery.isLoading && epics.length === 0) || isAwaitingInitialHydration,
    error: epicsQuery.error,
    createEpic,
    isCreating: createEpicMutation.isPending,
    isCreateSuccess: createEpicMutation.isSuccess,
    updateEpic: updateEpic.mutateAsync,
    renameEpic: ({ epicId, title }: { epicId: string; title: string }) =>
      updateEpic.mutateAsync({ epicId, updates: { title } }),
    deleteEpic: deleteEpic.mutateAsync,
    updateEpicStatus: updateEpicStatus.mutate,
    deleteCampaignRitual: deleteCampaignRitual.mutateAsync,
    createCampaignRitual: createCampaignRitual.mutateAsync,
    isDeletingCampaignRitual: deleteCampaignRitual.isPending,
    isCreatingCampaignRitual: createCampaignRitual.isPending,
    addHabitToEpic: addHabitToEpic.mutate,
    removeHabitFromEpic: removeHabitFromEpic.mutate,
  };
};
