import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";

import { useAuth } from "@/hooks/useAuth";
import { useCalendarTasks } from "@/hooks/useCalendarTasks";
import { useEpics } from "@/hooks/useEpics";
import { useExternalCalendarEvents } from "@/hooks/useExternalCalendarEvents";
import { useInboxTasks } from "@/hooks/useInboxTasks";
import { useTasksQuery } from "@/hooks/useTasksQuery";
import { useUserAIContext } from "@/hooks/useUserAIContext";
import { buildCompanionPlannerScheduleInsights } from "@/utils/companionPlannerSchedule";
import type { Json } from "@/integrations/supabase/types";
import { supabase } from "@/integrations/supabase/client";
import type { EpicRecord } from "@/hooks/epicsQuery";
import type {
  CompanionPlannerProposal,
  CompanionPlannerProposalKind,
  CompanionPlannerRequest,
  CompanionPlannerResponse,
  CompanionPlannerSessionState,
  PlannerContextCalendarEvent,
  PlannerContextEpic,
  PlannerContextRitual,
  PlannerContextTask,
  PlannerHorizon,
  PlannerMemoryProfile,
  PlannerScheduleInsights,
  PlannerTonePack,
} from "@/types/companionPlanner";

export const COMPANION_PLANNER_STORAGE_KEY = "companion-planner-preferences-v1";
const MAX_CONTEXT_TASKS = 18;

export type StoredPlannerPreferences = {
  tonePack?: PlannerTonePack;
  preferredTimeOfDay?: string | null;
  preferredTimeReason?: string | null;
  reminderPreference?: string | null;
};

export type PlannerMemoryQueryResult = {
  preferredWorkBlocks: Json | null;
  wakeTime: string | null;
  windDownTime: string | null;
  peakProductivityTimes: string[];
  schedulingPatterns: Json | null;
  successfulPatterns: Json | null;
};

export const readStoredPlannerPreferences = (): StoredPlannerPreferences => {
  if (typeof window === "undefined") return {};

  try {
    const raw = window.localStorage.getItem(COMPANION_PLANNER_STORAGE_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as StoredPlannerPreferences;
  } catch {
    return {};
  }
};

export const writeStoredPlannerPreferences = (value: StoredPlannerPreferences) => {
  if (typeof window === "undefined") return;

  window.localStorage.setItem(COMPANION_PLANNER_STORAGE_KEY, JSON.stringify(value));
};

const isRecord = (value: Json | null | undefined): value is Record<string, Json> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const asString = (value: Json | null | undefined): string | null =>
  typeof value === "string" ? value : null;

const asNumber = (value: Json | null | undefined): number | null =>
  typeof value === "number" && Number.isFinite(value) ? value : null;

const asStringArray = (value: Json | null | undefined): string[] =>
  Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === "string") : [];

const asNumberRecord = (value: Json | null | undefined): Record<string, number> => {
  if (!isRecord(value)) return {};

  return Object.fromEntries(
    Object.entries(value).filter(([, entry]) => typeof entry === "number" && Number.isFinite(entry)),
  );
};

export const mapTasksToPlannerContext = (tasks: PlannerContextTask[]) =>
  tasks.slice(0, MAX_CONTEXT_TASKS);

export const parsePlannerReminderPreferenceMinutes = (value: string | null | undefined): number | null => {
  if (!value) return null;
  const match = value.match(/(\d{1,3})/);
  return match?.[1] ? Number.parseInt(match[1], 10) : null;
};

export const parsePlannerTimeOfDayFromClock = (
  time: string | null | undefined,
): PlannerMemoryProfile["preferredTimeOfDay"] => {
  if (!time) return null;
  const hour = Number.parseInt(time.split(":")[0] ?? "", 10);
  if (Number.isNaN(hour)) return null;
  if (hour < 12) return "morning";
  if (hour < 17) return "afternoon";
  if (hour < 21) return "evening";
  return "night";
};

export const extractPlannerProfile = (
  preferredWorkBlocks: Json | null | undefined,
): Partial<PlannerMemoryProfile> & { preferredWorkBlocksRecord: Record<string, Json> } => {
  if (!isRecord(preferredWorkBlocks)) {
    return { preferredWorkBlocksRecord: {} };
  }

  const profile = isRecord(preferredWorkBlocks.planner_profile)
    ? preferredWorkBlocks.planner_profile
    : {};
  const rawWindows = Array.isArray(profile.preferredWindows)
    ? profile.preferredWindows
    : [];

  return {
    preferredWorkBlocksRecord: preferredWorkBlocks,
    tonePack: asString(profile.tonePack) as PlannerTonePack | null | undefined,
    preferredTimeOfDay: asString(profile.preferredTimeOfDay),
    preferredTimeReason: asString(profile.preferredTimeReason),
    reminderMinutesBefore: asNumber(profile.reminderMinutesBefore),
    wakeTime: asString(profile.wakeTime),
    windDownTime: asString(profile.windDownTime),
    peakProductivityTimes: asStringArray(profile.peakProductivityTimes),
    preferredWindows: rawWindows
      .filter(isRecord)
      .map((window) => ({
        timeOfDay: asString(window.timeOfDay) ?? "morning",
        time: asString(window.time),
        reason: asString(window.reason),
        sourceCount: asNumber(window.sourceCount) ?? 1,
      })),
    cadencePatterns: asNumberRecord(profile.cadencePatterns),
    lastConfirmedAt: asString(profile.lastConfirmedAt),
  };
};

export const mergePlannerPreferredWindows = (
  existing: NonNullable<PlannerMemoryProfile["preferredWindows"]>,
  nextWindow: NonNullable<PlannerMemoryProfile["preferredWindows"]>[number] | null,
) => {
  if (!nextWindow?.timeOfDay) return existing;

  let matched = false;
  const merged = existing.map((window) => {
    const sameWindow = window.timeOfDay === nextWindow.timeOfDay && (window.time ?? null) === (nextWindow.time ?? null);
    if (!sameWindow) return window;

    matched = true;
    return {
      ...window,
      reason: nextWindow.reason ?? window.reason ?? null,
      sourceCount: (window.sourceCount ?? 1) + 1,
    };
  });

  if (!matched) {
    merged.push({
      ...nextWindow,
      sourceCount: nextWindow.sourceCount ?? 1,
    });
  }

  return merged
    .slice()
    .sort((left, right) => (right.sourceCount ?? 1) - (left.sourceCount ?? 1))
    .slice(0, 6);
};

export const inferPlannerCadenceKeyFromProposal = (
  kind: CompanionPlannerProposalKind,
  payload: Record<string, unknown>,
): string | null => {
  if (kind === "create_campaign" || kind === "update_campaign") {
    const habits = Array.isArray(payload.habits) ? payload.habits : [];
    const firstHabit = habits[0];
    if (firstHabit && typeof firstHabit === "object" && firstHabit !== null) {
      const frequency = (firstHabit as Record<string, unknown>).frequency;
      return typeof frequency === "string" ? frequency : null;
    }
    return null;
  }

  const recurrencePattern = payload.recurrencePattern;
  if (typeof recurrencePattern === "string" && recurrencePattern.length > 0) {
    return recurrencePattern;
  }

  const frequency = payload.frequency;
  return typeof frequency === "string" && frequency.length > 0 ? frequency : null;
};

export const inferPlannerReminderMinutesFromProposal = (
  kind: CompanionPlannerProposalKind,
  payload: Record<string, unknown>,
): number | null => {
  if (kind === "create_campaign" || kind === "update_campaign") {
    const habits = Array.isArray(payload.habits) ? payload.habits : [];
    const firstHabit = habits[0];
    if (firstHabit && typeof firstHabit === "object" && firstHabit !== null) {
      const reminder = (firstHabit as Record<string, unknown>).reminder_minutes_before;
      return typeof reminder === "number" ? reminder : null;
    }
  }

  const keys = ["reminderMinutesBefore", "reminder_minutes_before"] as const;
  for (const key of keys) {
    const value = payload[key];
    if (typeof value === "number" && Number.isFinite(value)) {
      return value;
    }
  }

  return null;
};

export const inferPlannerScheduledTimeFromProposal = (
  kind: CompanionPlannerProposalKind,
  payload: Record<string, unknown>,
): string | null => {
  if (kind === "create_campaign" || kind === "update_campaign") {
    const habits = Array.isArray(payload.habits) ? payload.habits : [];
    const firstHabit = habits[0];
    if (firstHabit && typeof firstHabit === "object" && firstHabit !== null) {
      const preferredTime = (firstHabit as Record<string, unknown>).preferred_time;
      return typeof preferredTime === "string" ? preferredTime : null;
    }
  }

  const keys = ["scheduledTime", "preferredTime"] as const;
  for (const key of keys) {
    const value = payload[key];
    if (typeof value === "string" && value.length > 0) {
      return value;
    }
  }

  if (kind === "update_quest" || kind === "suggest_reminder") {
    const updates = payload.updates;
    if (updates && typeof updates === "object" && !Array.isArray(updates)) {
      const scheduledTime = (updates as Record<string, unknown>).scheduled_time;
      return typeof scheduledTime === "string" ? scheduledTime : null;
    }
  }

  return null;
};

export const serializeTaskToPlannerContext = (task: {
  id: string;
  task_text: string;
  task_date: string | null;
  scheduled_time: string | null;
  estimated_duration?: number | null;
  notes?: string | null;
  subtasks?: Array<{ title: string | null } | null> | null;
  recurrence_pattern: string | null;
  recurrence_end_date?: string | null;
  completed?: boolean | null;
  priority?: string | null;
  source?: string | null;
  epic_id?: string | null;
  epic_title?: string | null;
}): PlannerContextTask => ({
  id: task.id,
  title: task.task_text,
  taskDate: task.task_date,
  scheduledTime: task.scheduled_time,
  estimatedDuration: task.estimated_duration ?? null,
  notes: task.notes ?? null,
  subtaskTitles: (task.subtasks ?? [])
    .map((subtask) => subtask?.title?.trim() ?? "")
    .filter((title) => title.length > 0),
  recurrencePattern: task.recurrence_pattern,
  recurrenceEndDate: task.recurrence_end_date ?? null,
  completed: task.completed ?? null,
  priority: task.priority ?? null,
  source: task.source ?? null,
  epicId: task.epic_id ?? null,
  epicTitle: task.epic_title ?? null,
});

export const mapEpicsToPlannerContext = (epics: EpicRecord[]): PlannerContextEpic[] =>
  epics.map((epic) => ({
    id: epic.id,
    title: epic.title,
    endDate: epic.end_date,
  }));

export const mapRitualsToPlannerContext = (epics: EpicRecord[]): PlannerContextRitual[] =>
  epics.flatMap((epic) =>
    (epic.epic_habits ?? [])
      .filter((link) => link.habits)
      .map((link) => ({
        id: link.habits?.id ?? link.habit_id,
        epicId: epic.id,
        epicTitle: epic.title,
        title: link.habits?.title ?? "Untitled ritual",
        frequency: link.habits?.frequency ?? null,
        preferredTime: link.habits?.preferred_time ?? null,
      })),
  );

export const applyPlannerMemoryUpdates = (
  previous: CompanionPlannerSessionState,
  updates: CompanionPlannerResponse["memoryUpdates"],
): CompanionPlannerSessionState => ({
  ...previous,
  preferredTimeOfDay: updates.preferredTimeOfDay ?? previous.preferredTimeOfDay ?? null,
  preferredTimeReason: updates.preferredTimeReason ?? previous.preferredTimeReason ?? null,
  reminderPreference: updates.reminderPreference ?? previous.reminderPreference ?? null,
});

export const findPlannerProposalById = (
  proposals: CompanionPlannerProposal[],
  proposalId: string,
) => proposals.find((proposal) => proposal.id === proposalId) ?? null;

interface UseCompanionPlanningContextOptions {
  horizon: PlannerHorizon;
  tonePack: PlannerTonePack;
  storedPreferences: StoredPlannerPreferences;
  sessionState: CompanionPlannerSessionState;
  plannerMemoryOverride?: Partial<PlannerMemoryProfile> | null;
}

export function useCompanionPlanningContext({
  horizon,
  tonePack,
  storedPreferences,
  sessionState,
  plannerMemoryOverride = null,
}: UseCompanionPlanningContextOptions) {
  const { user } = useAuth();
  const today = new Date();
  const todayIso = format(today, "yyyy-MM-dd");
  const todayTasksQuery = useTasksQuery(today);
  const weekTasksQuery = useCalendarTasks(today, "week");
  const monthTasksQuery = useCalendarTasks(today, "month");
  const activeEventsQuery = useExternalCalendarEvents(today, horizon);
  const contextEventsQuery = useExternalCalendarEvents(today, horizon === "month" ? "month" : "week");
  const { inboxTasks } = useInboxTasks();
  const { activeEpics } = useEpics();
  const { enrichedContext } = useUserAIContext();

  const plannerMemoryQuery = useQuery({
    queryKey: ["companion-planner-memory", user?.id],
    enabled: !!user?.id,
    staleTime: 5 * 60 * 1000,
    queryFn: async (): Promise<PlannerMemoryQueryResult | null> => {
      if (!user?.id) return null;

      const [{ data: preferenceRow, error: preferenceError }, { data: learningRow, error: learningError }] = await Promise.all([
        supabase
          .from("daily_planning_preferences")
          .select("preferred_work_blocks, wake_time, wind_down_time")
          .eq("user_id", user.id)
          .maybeSingle(),
        supabase
          .from("user_ai_learning")
          .select("peak_productivity_times, scheduling_patterns, successful_patterns")
          .eq("user_id", user.id)
          .maybeSingle(),
      ]);

      if (preferenceError) throw preferenceError;
      if (learningError) throw learningError;

      return {
        preferredWorkBlocks: preferenceRow?.preferred_work_blocks ?? null,
        wakeTime: preferenceRow?.wake_time ?? null,
        windDownTime: preferenceRow?.wind_down_time ?? null,
        peakProductivityTimes: learningRow?.peak_productivity_times ?? [],
        schedulingPatterns: learningRow?.scheduling_patterns ?? null,
        successfulPatterns: learningRow?.successful_patterns ?? null,
      };
    },
  });

  const activeTasks = useMemo(() => {
    if (horizon === "month") return monthTasksQuery.tasks;
    if (horizon === "week") return weekTasksQuery.tasks;
    return todayTasksQuery.tasks;
  }, [horizon, monthTasksQuery.tasks, todayTasksQuery.tasks, weekTasksQuery.tasks]);

  const contextTasks = useMemo(() => (
    horizon === "month" ? monthTasksQuery.tasks : weekTasksQuery.tasks
  ), [horizon, monthTasksQuery.tasks, weekTasksQuery.tasks]);

  const plannerMemory = useMemo<PlannerMemoryProfile>(() => {
    const remoteProfile = extractPlannerProfile(plannerMemoryQuery.data?.preferredWorkBlocks);
    const preferredTimeOfDay = plannerMemoryOverride?.preferredTimeOfDay
      ?? sessionState.preferredTimeOfDay
      ?? remoteProfile.preferredTimeOfDay
      ?? storedPreferences.preferredTimeOfDay
      ?? null;
    const preferredTimeReason = plannerMemoryOverride?.preferredTimeReason
      ?? sessionState.preferredTimeReason
      ?? remoteProfile.preferredTimeReason
      ?? storedPreferences.preferredTimeReason
      ?? null;
    const reminderMinutesBefore = plannerMemoryOverride?.reminderMinutesBefore
      ?? remoteProfile.reminderMinutesBefore
      ?? parsePlannerReminderPreferenceMinutes(sessionState.reminderPreference)
      ?? parsePlannerReminderPreferenceMinutes(storedPreferences.reminderPreference)
      ?? null;
    const preferredWindows = plannerMemoryOverride?.preferredWindows
      ?? remoteProfile.preferredWindows
      ?? (preferredTimeOfDay
        ? [{
            timeOfDay: preferredTimeOfDay,
            reason: preferredTimeReason,
            sourceCount: 1,
          }]
        : []);
    const cadencePatterns = plannerMemoryOverride?.cadencePatterns
      ?? {
        ...asNumberRecord(plannerMemoryQuery.data?.schedulingPatterns),
        ...asNumberRecord(plannerMemoryQuery.data?.successfulPatterns),
        ...remoteProfile.cadencePatterns,
      };

    return {
      tonePack: plannerMemoryOverride?.tonePack ?? tonePack,
      preferredTimeOfDay,
      preferredTimeReason,
      reminderMinutesBefore,
      wakeTime: plannerMemoryOverride?.wakeTime
        ?? plannerMemoryQuery.data?.wakeTime
        ?? remoteProfile.wakeTime
        ?? null,
      windDownTime: plannerMemoryOverride?.windDownTime
        ?? plannerMemoryQuery.data?.windDownTime
        ?? remoteProfile.windDownTime
        ?? null,
      peakProductivityTimes: plannerMemoryOverride?.peakProductivityTimes
        ?? plannerMemoryQuery.data?.peakProductivityTimes
        ?? remoteProfile.peakProductivityTimes
        ?? [],
      preferredWindows,
      cadencePatterns,
      lastConfirmedAt: plannerMemoryOverride?.lastConfirmedAt ?? remoteProfile.lastConfirmedAt ?? null,
    };
  }, [
    plannerMemoryOverride,
    plannerMemoryQuery.data?.peakProductivityTimes,
    plannerMemoryQuery.data?.preferredWorkBlocks,
    plannerMemoryQuery.data?.schedulingPatterns,
    plannerMemoryQuery.data?.successfulPatterns,
    plannerMemoryQuery.data?.wakeTime,
    plannerMemoryQuery.data?.windDownTime,
    sessionState.preferredTimeOfDay,
    sessionState.preferredTimeReason,
    sessionState.reminderPreference,
    storedPreferences.preferredTimeOfDay,
    storedPreferences.preferredTimeReason,
    storedPreferences.reminderPreference,
    tonePack,
  ]);

  const scheduleInsights = useMemo<PlannerScheduleInsights>(() =>
    buildCompanionPlannerScheduleInsights({
      tasks: activeTasks.map(serializeTaskToPlannerContext),
      calendarEvents: activeEventsQuery.events,
      horizon,
      selectedDate: todayIso,
      plannerMemory,
    }), [activeEventsQuery.events, activeTasks, horizon, plannerMemory, todayIso]);

  const plannerContext = useMemo<CompanionPlannerRequest["plannerContext"]>(() => ({
    tasks: mapTasksToPlannerContext(contextTasks.map(serializeTaskToPlannerContext)),
    inboxTasks: mapTasksToPlannerContext(inboxTasks.map(serializeTaskToPlannerContext)),
    activeEpics: mapEpicsToPlannerContext(activeEpics),
    rituals: mapRitualsToPlannerContext(activeEpics),
    calendarEvents: contextEventsQuery.events,
    scheduleInsights,
    plannerMemory,
    aiSignals: enrichedContext
      ? {
          preferredDifficulty: enrichedContext.preferredDifficulty,
          preferredHabitFrequency: enrichedContext.preferredHabitFrequency,
          preferredEpicDuration: enrichedContext.preferredEpicDuration,
          commonContexts: enrichedContext.commonContexts,
          suggestedWorkload: enrichedContext.suggestedWorkload,
        }
      : undefined,
  }), [activeEpics, contextEventsQuery.events, contextTasks, enrichedContext, inboxTasks, plannerMemory, scheduleInsights]);

  return {
    today,
    todayIso,
    todayLabel: format(today, "EEEE, MMMM d"),
    activeTasks,
    contextTasks,
    activeCalendarEvents: activeEventsQuery.events as PlannerContextCalendarEvent[],
    contextCalendarEvents: contextEventsQuery.events as PlannerContextCalendarEvent[],
    inboxTasks,
    activeEpics,
    plannerMemory,
    plannerMemoryQuery,
    plannerContext,
    scheduleInsights,
    isLoadingContext:
      todayTasksQuery.isLoading
      || weekTasksQuery.isLoading
      || monthTasksQuery.isLoading
      || activeEventsQuery.isLoading
      || contextEventsQuery.isLoading
      || plannerMemoryQuery.isLoading,
  };
}
