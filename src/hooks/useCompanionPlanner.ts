import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { addDays, format } from "date-fns";
import { toast } from "@/components/ui/sonner";
import { useResilience } from "@/contexts/ResilienceContext";
import { applySubtaskTitlePlan } from "@/features/tasks/lib/subtaskWrites";
import { supabase } from "@/integrations/supabase/client";
import { useIntentClassifier } from "@/hooks/useIntentClassifier";
import type { IntentClassification } from "@/hooks/useIntentClassifier";
import { useVoiceInput } from "@/hooks/useVoiceInput";
import { useTasksQuery } from "@/hooks/useTasksQuery";
import { useCalendarTasks } from "@/hooks/useCalendarTasks";
import { useExternalCalendarEvents } from "@/hooks/useExternalCalendarEvents";
import { useInboxTasks } from "@/hooks/useInboxTasks";
import { useEpics } from "@/hooks/useEpics";
import { useTaskMutations } from "@/hooks/useTaskMutations";
import type { AddTaskParams } from "@/hooks/useTaskMutations";
import { useRitualUpdate } from "@/hooks/useRitualUpdate";
import { useUserAIContext } from "@/hooks/useUserAIContext";
import { useAIInteractionTracker } from "@/hooks/useAIInteractionTracker";
import { useSchedulingLearner } from "@/hooks/useSchedulingLearner";
import { useAuth } from "@/hooks/useAuth";
import { useCompanion } from "@/hooks/useCompanion";
import { useCompanionCareSignals } from "@/hooks/useCompanionCareSignals";
import { useCalendarIntegrations } from "@/hooks/useCalendarIntegrations";
import {
  type OutlookPlanningContextSyncResult,
  type PlannerSyncTaskSnapshot,
  useQuestCalendarSync,
} from "@/hooks/useQuestCalendarSync";
import { parseNaturalLanguage } from "@/features/tasks/hooks/useNaturalLanguageParser";
import { buildCompanionPlannerScheduleInsights } from "@/utils/companionPlannerSchedule";
import { resolveCompanionPlannerError } from "@/utils/companionPlannerErrors";
import { formatCurrentDateTimeWithOffset } from "@/utils/currentDateTime";
import type { Json } from "@/integrations/supabase/types";
import type { EpicRecord } from "@/hooks/epicsQuery";
import { stripMarkdown } from "@/lib/utils";
import {
  generateCompanionThreadSessionId,
  getCompanionChatThreadsQueryKey,
  persistCompanionThreadMessages,
} from "@/services/companionChatThreads";
import { getCompanionPlannerOpener } from "@/shared/companionPlannerCopy";
import { LOCKED_COMPANION_TONE_PACK } from "@/shared/companionChaosVoice";
import {
  buildConfirmReadyPlannerReply,
  getReadyQuestPlannerProposals,
  isQuestionLikePlannerReply,
} from "@/shared/companionPlannerReadyProposal";
import { computePlannerPriorityScores } from "@/shared/companionPlannerPriority";
import { buildCompanionStatInterpretation } from "@/shared/companionStatSignals";
import { normalizeUuidLikeId } from "@/utils/offlineId";
import type {
  CompanionChatSurface,
  CompanionChatThreadMessage,
  CompanionPlannerMessage,
  CompanionPlannerProposal,
  CompanionPlannerProposalKind,
  CompanionPlannerQuestion,
  CompanionPlannerRequest,
  CompanionPlannerResponse,
  CompanionPlannerSessionState,
  CompanionPlannerStarterIntent,
  PlannerBriefingContext,
  PlannerCareState,
  PlannerContactNeedingAttention,
  PlannerContextCalendarEvent,
  PlannerContextEpic,
  PlannerContextRitual,
  PlannerContextTask,
  PlannerHorizon,
  PlannerMemoryProfile,
  PlannerPriorityScore,
  PlannerReflectionSignal,
  PlannerScheduleInsights,
  PlannerTonePack,
} from "@/types/companionPlanner";

const STORAGE_KEY = "companion-planner-preferences-v1";
const MAX_CONTEXT_TASKS = 18;
const OUTLOOK_PLANNER_SYNC_INTERVAL_MS = 90_000;

type StoredPlannerPreferences = {
  tonePack?: PlannerTonePack;
  preferredTimeOfDay?: string | null;
  preferredTimeReason?: string | null;
  reminderPreference?: string | null;
};

type PlannerMemoryQueryResult = {
  preferredWorkBlocks: Json | null;
  wakeTime: string | null;
  windDownTime: string | null;
  coldContactThresholdDays: number | null;
  defaultEnergyLevel: string | null;
  includeRelationshipTasks: boolean | null;
  peakProductivityTimes: string[];
  schedulingPatterns: Json | null;
  successfulPatterns: Json | null;
};

type PlannerSubmissionContext = {
  starterIntent: CompanionPlannerStarterIntent | null;
  briefingContext: PlannerBriefingContext | null;
};

type CompanionPlannerQuestSubtaskPlan = {
  mode: "append" | "replace";
  titles: string[];
};

const DEFAULT_SESSION_STATE: CompanionPlannerSessionState = {
  draft: {},
  openQuestionIds: [],
  preferredTimeOfDay: null,
  preferredTimeReason: null,
  reminderPreference: null,
  pendingStarterIntent: null,
  lastClassification: null,
};

const DEFAULT_TONE_PACK: PlannerTonePack = LOCKED_COMPANION_TONE_PACK;

const generateId = () => {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
};

const createInitialSessionState = (
  storedPreferences: StoredPlannerPreferences,
): CompanionPlannerSessionState => ({
  ...DEFAULT_SESSION_STATE,
  preferredTimeOfDay: storedPreferences.preferredTimeOfDay ?? null,
  preferredTimeReason: storedPreferences.preferredTimeReason ?? null,
  reminderPreference: storedPreferences.reminderPreference ?? null,
});

const createMessage = (
  role: CompanionPlannerMessage["role"],
  content: string,
  extras: Partial<CompanionPlannerMessage> = {},
): CompanionPlannerMessage => ({
  id: generateId(),
  role,
  content,
  createdAt: new Date().toISOString(),
  ...extras,
});

const readStoredPreferences = (): StoredPlannerPreferences => {
  if (typeof window === "undefined") return {};

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as StoredPlannerPreferences;
  } catch {
    return {};
  }
};

const writeStoredPreferences = (value: StoredPlannerPreferences) => {
  if (typeof window === "undefined") return;

  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
};

const mapTasksToContext = (tasks: PlannerContextTask[]) =>
  tasks.slice(0, MAX_CONTEXT_TASKS);

const getPlannerSyncRange = (date: Date, horizon: PlannerHorizon) => {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);

  const end = addDays(
    start,
    horizon === "month" ? 30 : horizon === "week" ? 7 : 1,
  );
  end.setHours(0, 0, 0, 0);

  return {
    startDate: format(start, "yyyy-MM-dd"),
    endDate: format(addDays(end, -1), "yyyy-MM-dd"),
  };
};

const isRecord = (
  value: Json | null | undefined,
): value is Record<string, Json> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const asString = (value: Json | null | undefined): string | null =>
  typeof value === "string" ? value : null;

const asNumber = (value: Json | null | undefined): number | null =>
  typeof value === "number" && Number.isFinite(value) ? value : null;

const asStringArray = (value: Json | null | undefined): string[] =>
  Array.isArray(value)
    ? value.filter((entry): entry is string => typeof entry === "string")
    : [];

const asNumberRecord = (
  value: Json | null | undefined,
): Record<string, number> => {
  if (!isRecord(value)) return {};

  return Object.fromEntries(
    Object.entries(value).filter(([, entry]) =>
      typeof entry === "number" && Number.isFinite(entry)
    ),
  );
};

const parseReminderPreferenceMinutes = (
  value: string | null | undefined,
): number | null => {
  if (!value) return null;
  const match = value.match(/(\d{1,3})/);
  return match?.[1] ? Number.parseInt(match[1], 10) : null;
};

const parseTimeOfDayFromClock = (
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

const normalizeTimeReason = (
  value: string | null | undefined,
): string | null => {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const resolveTimeReasonFromSources = (input: {
  resolvedTimeOfDay: PlannerMemoryProfile["preferredTimeOfDay"];
  sources: Array<{
    timeOfDay: string | null | undefined;
    timeReason: string | null | undefined;
  }>;
}): string | null => {
  for (const source of input.sources) {
    const timeReason = normalizeTimeReason(source.timeReason);
    if (!timeReason) continue;

    const sourceTimeOfDay = source.timeOfDay ?? null;
    if (
      !input.resolvedTimeOfDay ||
      !sourceTimeOfDay ||
      sourceTimeOfDay === input.resolvedTimeOfDay
    ) {
      return timeReason;
    }
  }

  return null;
};

const extractPlannerProfile = (
  preferredWorkBlocks: Json | null | undefined,
): Partial<PlannerMemoryProfile> & {
  preferredWorkBlocksRecord: Record<string, Json>;
} => {
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
    workloadTolerance: (asString(
      profile.workloadTolerance,
    ) as PlannerMemoryProfile["workloadTolerance"]) ?? null,
    contactCadencePatterns: asNumberRecord(profile.contactCadencePatterns),
    lastConfirmedAt: asString(profile.lastConfirmedAt),
  };
};

const mergePreferredWindows = (
  existing: NonNullable<PlannerMemoryProfile["preferredWindows"]>,
  nextWindow:
    | NonNullable<PlannerMemoryProfile["preferredWindows"]>[number]
    | null,
) => {
  if (!nextWindow?.timeOfDay) return existing;

  let matched = false;
  const merged = existing.map((window) => {
    const sameWindow = window.timeOfDay === nextWindow.timeOfDay &&
      (window.time ?? null) === (nextWindow.time ?? null);
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

const inferCadenceKeyFromProposal = (
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
  return typeof frequency === "string" && frequency.length > 0
    ? frequency
    : null;
};

const inferReminderMinutesFromProposal = (
  kind: CompanionPlannerProposalKind,
  payload: Record<string, unknown>,
): number | null => {
  if (kind === "create_campaign" || kind === "update_campaign") {
    const habits = Array.isArray(payload.habits) ? payload.habits : [];
    const firstHabit = habits[0];
    if (firstHabit && typeof firstHabit === "object" && firstHabit !== null) {
      const reminder =
        (firstHabit as Record<string, unknown>).reminder_minutes_before;
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

const asUnknownRecord = (value: unknown): Record<string, unknown> | null =>
  value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;

const asUnknownStringArray = (value: unknown): string[] =>
  Array.isArray(value)
    ? value
      .filter((entry): entry is string =>
        typeof entry === "string" && entry.trim().length > 0
      )
      .map((entry) => entry.trim())
    : [];

const extractQuestSubtaskPlan = (
  payload: Record<string, unknown>,
): CompanionPlannerQuestSubtaskPlan | null => {
  const subtaskPlan = asUnknownRecord(payload.subtaskPlan);
  const mode = subtaskPlan?.mode === "append" || subtaskPlan?.mode === "replace"
    ? subtaskPlan.mode
    : null;

  if (!mode) return null;

  return {
    mode,
    titles: asUnknownStringArray(subtaskPlan.titles),
  };
};

const mapMoodToEnergy = (
  mood: string | null | undefined,
): PlannerReflectionSignal["energy"] => {
  if (!mood) return null;
  const normalizedMood = mood.toLowerCase();
  if (
    /\b(tired|drained|fried|exhausted|overwhelmed|low)\b/.test(normalizedMood)
  ) {
    return "low";
  }
  if (
    /\b(great|good|energized|strong|locked in|sharp|high)\b/.test(
      normalizedMood,
    )
  ) {
    return "high";
  }
  return "medium";
};

const deriveStarterIntentFromMessage = (
  message: string,
): CompanionPlannerStarterIntent => {
  const normalizedMessage = message.trim().toLowerCase();

  if (normalizedMessage === "quest?") {
    return "quest_capture";
  }
  if (
    /\b(tired|drained|fried|make it light|light day|low energy)\b/.test(
      normalizedMessage,
    )
  ) {
    return "low_energy_adjust";
  }
  if (/\b(free me up|make room|clear space)\b/.test(normalizedMessage)) {
    return "make_room";
  }
  if (
    /\b(what matters most|top priority|prioritize|focus on)\b/.test(
      normalizedMessage,
    )
  ) {
    return "what_matters";
  }
  if (
    /\b(plan my day|what does today look like|show me today|today look like)\b/
      .test(normalizedMessage)
  ) {
    return "plan_day";
  }
  if (
    /\b(relationship touch|who should i (?:text|call|reach out to)|who needs attention|follow up with|reach out to someone)\b/
      .test(normalizedMessage)
  ) {
    return "relationship_touch";
  }
  if (
    /\b(adjust today|rework today|reschedule today|move today around)\b/.test(
      normalizedMessage,
    )
  ) {
    return "adjust_today";
  }
  if (
    /\b(break this goal down|break a big goal|turn this into steps)\b/.test(
      normalizedMessage,
    )
  ) {
    return "goal_breakdown";
  }

  return "general";
};

const inferScheduledTimeFromProposal = (
  kind: CompanionPlannerProposalKind,
  payload: Record<string, unknown>,
): string | null => {
  if (kind === "create_campaign" || kind === "update_campaign") {
    const habits = Array.isArray(payload.habits) ? payload.habits : [];
    const firstHabit = habits[0];
    if (firstHabit && typeof firstHabit === "object" && firstHabit !== null) {
      const preferredTime =
        (firstHabit as Record<string, unknown>).preferred_time;
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

  if (kind === "update_quest") {
    const updates = payload.updates;
    if (updates && typeof updates === "object" && !Array.isArray(updates)) {
      const scheduledTime = (updates as Record<string, unknown>).scheduled_time;
      return typeof scheduledTime === "string" ? scheduledTime : null;
    }
  }

  return null;
};

const sanitizeCreateQuestProposalPayload = (
  payload: Record<string, unknown>,
): AddTaskParams => {
  const reminderMinutesBefore =
    typeof payload.reminderMinutesBefore === "number"
      ? payload.reminderMinutesBefore
      : 15;

  return {
    taskText: typeof payload.taskText === "string" ? payload.taskText : "Quest",
    difficulty: payload.difficulty === "easy" || payload.difficulty === "hard"
      ? payload.difficulty
      : "medium",
    source: typeof payload.questSource === "string"
      ? payload.questSource
      : typeof payload.taskDate === "string"
      ? "manual"
      : "inbox",
    taskDate: typeof payload.taskDate === "string" ? payload.taskDate : null,
    scheduledTime: typeof payload.scheduledTime === "string"
      ? payload.scheduledTime
      : null,
    estimatedDuration: typeof payload.estimatedDuration === "number"
      ? payload.estimatedDuration
      : null,
    reminderEnabled: Boolean(payload.reminderEnabled),
    reminderMinutesBefore,
    category: typeof payload.category === "string"
      ? payload.category
      : undefined,
    notes: typeof payload.notes === "string" ? payload.notes : null,
    contactId: typeof payload.contactId === "string" ? payload.contactId : null,
    autoLogInteraction: typeof payload.autoLogInteraction === "boolean"
      ? payload.autoLogInteraction
      : true,
    imageUrl: typeof payload.imageUrl === "string" ? payload.imageUrl : null,
    location: typeof payload.location === "string" ? payload.location : null,
    subtasks: Array.isArray(payload.subtasks)
      ? payload.subtasks.filter((entry): entry is string =>
        typeof entry === "string"
      )
      : [],
  };
};

const extractOptimizerTelemetry = (
  proposal: CompanionPlannerProposal,
): Record<string, unknown> => {
  const payload = asUnknownRecord(proposal.payload);
  if (!payload) return {};

  const draftStatus = typeof payload.draftStatus === "string"
    ? payload.draftStatus
    : null;
  const schedulingConfidence = typeof payload.schedulingConfidence === "string"
    ? payload.schedulingConfidence
    : null;
  const slotScore = typeof payload.slotScore === "number"
    ? payload.slotScore
    : null;
  const reasonSummary = typeof payload.reasonSummary === "string"
    ? payload.reasonSummary
    : null;
  const reasonCodes = asUnknownStringArray(payload.reasonCodes);
  const softConflicts = asUnknownStringArray(payload.softConflicts);
  const hardConflict = typeof payload.hardConflict === "boolean"
    ? payload.hardConflict
    : null;
  const fallbackToInbox = typeof payload.fallbackToInbox === "boolean"
    ? payload.fallbackToInbox
    : null;
  const optimizerSource = typeof payload.source === "string"
    ? payload.source
    : null;

  return {
    ...(optimizerSource ? { optimizerSource } : {}),
    ...(draftStatus ? { draftStatus } : {}),
    ...(schedulingConfidence ? { schedulingConfidence } : {}),
    ...(typeof slotScore === "number" ? { slotScore } : {}),
    ...(reasonSummary ? { reasonSummary } : {}),
    ...(reasonCodes.length > 0 ? { reasonCodes } : {}),
    ...(softConflicts.length > 0 ? { softConflicts } : {}),
    ...(typeof hardConflict === "boolean" ? { hardConflict } : {}),
    ...(typeof fallbackToInbox === "boolean" ? { fallbackToInbox } : {}),
  };
};

const serializeTaskContext = (task: {
  id: string;
  task_text: string;
  task_date: string | null;
  category?: string | null;
  scheduled_time: string | null;
  estimated_duration?: number | null;
  notes?: string | null;
  subtasks?: Array<{ title: string | null } | null> | null;
  difficulty?: string | null;
  recurrence_pattern: string | null;
  recurrence_end_date?: string | null;
  completed?: boolean | null;
  priority?: string | null;
  source?: string | null;
  habit_source_id?: string | null;
  epic_id?: string | null;
  epic_title?: string | null;
  contact_id?: string | null;
}): PlannerContextTask => ({
  id: task.id,
  title: task.task_text,
  taskDate: task.task_date,
  category: task.category ?? null,
  scheduledTime: task.scheduled_time,
  estimatedDuration: task.estimated_duration ?? null,
  notes: task.notes ?? null,
  subtaskTitles: (task.subtasks ?? [])
    .map((subtask) => subtask?.title?.trim() ?? "")
    .filter((title) => title.length > 0),
  difficulty: task.difficulty ?? null,
  recurrencePattern: task.recurrence_pattern,
  recurrenceEndDate: task.recurrence_end_date ?? null,
  completed: task.completed ?? null,
  priority: task.priority ?? null,
  source: task.source ?? null,
  habitSourceId: task.habit_source_id ?? null,
  epicId: task.epic_id ?? null,
  epicTitle: task.epic_title ?? null,
  contactId: task.contact_id ?? null,
});

const mergePlannerTasks = (
  currentTasks: PlannerContextTask[],
  syncedTasks: PlannerSyncTaskSnapshot[],
  removedTaskIds: string[],
  mode: "scheduled" | "inbox",
): PlannerContextTask[] => {
  const removed = new Set(removedTaskIds);
  const nextTasks = currentTasks.filter((task) => !removed.has(task.id));
  const indexById = new Map(nextTasks.map((task, index) => [task.id, index]));

  syncedTasks
    .filter((
      task,
    ) => (mode === "inbox" ? task.task_date === null : task.task_date !== null))
    .forEach((task) => {
      const serialized = serializeTaskContext(task);
      const existingIndex = indexById.get(task.id);

      if (existingIndex === undefined) {
        indexById.set(task.id, nextTasks.length);
        nextTasks.push(serialized);
        return;
      }

      nextTasks[existingIndex] = serialized;
    });

  return mapTasksToContext(nextTasks);
};

const mergePlannerContextWithOutlookSync = (
  baseContext: CompanionPlannerRequest["plannerContext"],
  syncResult: OutlookPlanningContextSyncResult | null,
): CompanionPlannerRequest["plannerContext"] => {
  if (!syncResult) return baseContext;

  return {
    ...baseContext,
    tasks: mergePlannerTasks(
      baseContext.tasks,
      syncResult.tasks,
      syncResult.removedTaskIds,
      "scheduled",
    ),
    inboxTasks: mergePlannerTasks(
      baseContext.inboxTasks,
      syncResult.tasks,
      syncResult.removedTaskIds,
      "inbox",
    ),
    calendarEvents: [
      ...baseContext.calendarEvents.filter((event) =>
        event.provider !== "outlook"
      ),
      ...syncResult.calendarEvents,
    ].sort((left, right) => left.start.localeCompare(right.start)),
  };
};

const mapEpicsToContext = (
  epics: EpicRecord[],
  currentDate: string,
): PlannerContextEpic[] =>
  epics.map((epic) => ({
    id: epic.id,
    title: epic.title,
    endDate: epic.end_date,
    progressPercentage: epic.progress_percentage ?? null,
    daysRemaining: epic.end_date
      ? Math.round(
        (new Date(`${epic.end_date}T00:00:00`).getTime() -
          new Date(`${currentDate}T00:00:00`).getTime()) /
          (1000 * 60 * 60 * 24),
      )
      : null,
    habitCount: epic.epic_habits?.length ?? 0,
  }));

const mapRitualsToContext = (epics: EpicRecord[]): PlannerContextRitual[] =>
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
        currentStreak: null,
      }))
  );

const hasOwnMemoryUpdate = (
  updates: CompanionPlannerResponse["memoryUpdates"],
  key: keyof CompanionPlannerResponse["memoryUpdates"],
): boolean => Object.prototype.hasOwnProperty.call(updates, key);

const applyMemoryUpdates = (
  previous: CompanionPlannerSessionState,
  updates: CompanionPlannerResponse["memoryUpdates"],
): CompanionPlannerSessionState => ({
  ...previous,
  preferredTimeOfDay: hasOwnMemoryUpdate(updates, "preferredTimeOfDay")
    ? updates.preferredTimeOfDay ?? null
    : previous.preferredTimeOfDay ?? null,
  preferredTimeReason: hasOwnMemoryUpdate(updates, "preferredTimeReason")
    ? updates.preferredTimeReason ?? null
    : previous.preferredTimeReason ?? null,
  reminderPreference: hasOwnMemoryUpdate(updates, "reminderPreference")
    ? updates.reminderPreference ?? null
    : previous.reminderPreference ?? null,
});

const normalizeClassificationHint = (
  classification: IntentClassification | null,
): CompanionPlannerRequest["classificationHint"] => {
  if (!classification) return null;

  const normalized: NonNullable<CompanionPlannerRequest["classificationHint"]> =
    {
      type: classification.type,
      confidence: classification.confidence,
      reasoning: classification.reasoning,
    };

  if (typeof classification.suggestedDeadline === "string") {
    normalized.suggestedDeadline = classification.suggestedDeadline;
  }

  if (typeof classification.suggestedDuration === "number") {
    normalized.suggestedDuration = classification.suggestedDuration;
  }

  if (classification.timelineAnalysis) {
    normalized.timelineAnalysis = classification.timelineAnalysis;
  }

  return normalized;
};

const findProposalById = (
  proposals: CompanionPlannerProposal[],
  proposalId: string,
) => proposals.find((proposal) => proposal.id === proposalId) ?? null;

const getPendingPlannerProposals = (
  response: Pick<CompanionPlannerResponse, "proposals" | "suggestedReminders">,
): CompanionPlannerProposal[] =>
  [
    ...response.proposals,
    ...response.suggestedReminders,
  ].filter((proposal) => proposal.status === "pending");

const normalizePlannerResponse = (
  response: CompanionPlannerResponse,
): CompanionPlannerResponse => {
  const pendingProposals = getPendingPlannerProposals(response);
  if (pendingProposals.length === 0) return response;

  const readyQuestProposals = getReadyQuestPlannerProposals(pendingProposals);
  if (readyQuestProposals.length === 0) return response;

  const shouldReplaceReply = response.followUpQuestions.length > 0 ||
    response.sessionState.openQuestionIds.length > 0 ||
    isQuestionLikePlannerReply(response.reply);

  return {
    ...response,
    reply: shouldReplaceReply
      ? buildConfirmReadyPlannerReply(readyQuestProposals[0]?.kind ?? "")
      : response.reply,
    followUpQuestions: [],
    sessionState: {
      ...response.sessionState,
      openQuestionIds: [],
    },
  };
};

interface UseCompanionPlannerOptions {
  bootstrapGreeting?: boolean;
  threadPersistence?: {
    enabled?: boolean;
    surface?: CompanionChatSurface;
  };
}

export function useCompanionPlanner({
  bootstrapGreeting = true,
  threadPersistence,
}: UseCompanionPlannerOptions = {}) {
  const { user } = useAuth();
  const { companion } = useCompanion();
  const { care } = useCompanionCareSignals();
  const queryClient = useQueryClient();
  const storedPreferences = useMemo(readStoredPreferences, []);
  const [horizon, setHorizon] = useState<PlannerHorizon>("day");
  const { classify, isClassifying } = useIntentClassifier({
    minInputLength: 1,
    useOrchestrator: true,
  });
  const today = new Date();
  const todayIso = format(today, "yyyy-MM-dd");
  const plannerGreeting = useMemo(
    () => getCompanionPlannerOpener({ userId: user?.id ?? null }),
    [user?.id],
  );
  const todayTasksQuery = useTasksQuery(today);
  const weekTasksQuery = useCalendarTasks(today, "week");
  const monthTasksQuery = useCalendarTasks(today, "month");
  const activeEventsQuery = useExternalCalendarEvents(today, horizon);
  const contextEventsQuery = useExternalCalendarEvents(
    today,
    horizon === "month" ? "month" : "week",
  );
  const { inboxTasks } = useInboxTasks();
  const { activeEpics, createEpic, renameEpic, createCampaignRitual } =
    useEpics();
  const { addTask, updateTask } = useTaskMutations();
  const { saveRitual } = useRitualUpdate();
  const { connectedByProvider, defaultProvider } = useCalendarIntegrations();
  const { sendTaskToCalendar, syncPlanningContext } = useQuestCalendarSync();
  const { enrichedContext } = useUserAIContext();
  const { trackInteraction } = useAIInteractionTracker();
  const { trackTaskCreation, trackScheduleModification } =
    useSchedulingLearner();
  const { queueAction, shouldQueueWrites, retryNow } = useResilience();
  const outlookConnection = connectedByProvider.outlook ?? null;
  const shouldAutoPublishToOutlook = defaultProvider === "outlook" &&
    outlookConnection?.sync_mode === "full_sync";

  const tonePack: PlannerTonePack = threadPersistence?.surface === "journeys"
    ? "soft"
    : DEFAULT_TONE_PACK;
  const setTonePack = useCallback((_nextTonePack: PlannerTonePack) => {
    return;
  }, []);
  const sessionIdRef = useRef<string>(generateCompanionThreadSessionId());
  const [messages, setMessages] = useState<CompanionPlannerMessage[]>([]);
  const [proposals, setProposals] = useState<CompanionPlannerProposal[]>([]);
  const [questions, setQuestions] = useState<CompanionPlannerQuestion[]>([]);
  const [sessionState, setSessionState] = useState<
    CompanionPlannerSessionState
  >(() => createInitialSessionState(storedPreferences));
  const [draftInput, setDraftInput] = useState("");
  const [interimText, setInterimText] = useState("");
  const [showPermissionDialog, setShowPermissionDialog] = useState(false);
  const [isRequestingPermission, setIsRequestingPermission] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [plannerMemoryOverride, setPlannerMemoryOverride] = useState<
    Partial<PlannerMemoryProfile> | null
  >(null);
  const bootstrappedGreetingRef = useRef(false);
  const lastSubmissionContextRef = useRef<PlannerSubmissionContext>({
    starterIntent: null,
    briefingContext: null,
  });
  const outlookPlannerSyncPromiseRef = useRef<
    Promise<OutlookPlanningContextSyncResult | null> | null
  >(null);

  const plannerMemoryQuery = useQuery({
    queryKey: ["companion-planner-memory", user?.id],
    enabled: !!user?.id,
    staleTime: 5 * 60 * 1000,
    queryFn: async (): Promise<PlannerMemoryQueryResult | null> => {
      if (!user?.id) return null;

      const [
        { data: preferenceRow, error: preferenceError },
        { data: learningRow, error: learningError },
      ] = await Promise.all([
        supabase
          .from("daily_planning_preferences")
          .select(
            "preferred_work_blocks, wake_time, wind_down_time, cold_contact_threshold_days, default_energy_level, include_relationship_tasks",
          )
          .eq("user_id", user.id)
          .maybeSingle(),
        supabase
          .from("user_ai_learning")
          .select(
            "peak_productivity_times, scheduling_patterns, successful_patterns",
          )
          .eq("user_id", user.id)
          .maybeSingle(),
      ]);

      if (preferenceError) throw preferenceError;
      if (learningError) throw learningError;

      return {
        preferredWorkBlocks: preferenceRow?.preferred_work_blocks ?? null,
        wakeTime: preferenceRow?.wake_time ?? null,
        windDownTime: preferenceRow?.wind_down_time ?? null,
        coldContactThresholdDays: preferenceRow?.cold_contact_threshold_days ??
          null,
        defaultEnergyLevel: preferenceRow?.default_energy_level ?? null,
        includeRelationshipTasks: preferenceRow?.include_relationship_tasks ??
          null,
        peakProductivityTimes: learningRow?.peak_productivity_times ?? [],
        schedulingPatterns: learningRow?.scheduling_patterns ?? null,
        successfulPatterns: learningRow?.successful_patterns ?? null,
      };
    },
  });

  const contactsAttentionQuery = useQuery({
    queryKey: [
      "companion-planner-contacts",
      user?.id,
      plannerMemoryQuery.data?.coldContactThresholdDays ?? 14,
    ],
    enabled: !!user?.id,
    staleTime: 5 * 60 * 1000,
    queryFn: async (): Promise<PlannerContactNeedingAttention[]> => {
      if (!user?.id) return [];

      const thresholdDays = plannerMemoryQuery.data?.coldContactThresholdDays ??
        14;
      const nowIso = new Date().toISOString();
      const { data: overdueReminders } = await supabase
        .from("contact_reminders")
        .select("contact_id, reason")
        .eq("user_id", user.id)
        .eq("sent", false)
        .lt("reminder_at", nowIso);

      const { data: contacts, error: contactsError } = await supabase
        .from("contacts")
        .select("id, name, avatar_url")
        .eq("user_id", user.id);

      const { data: interactions, error: interactionsError } = await supabase
        .from("contact_interactions")
        .select("contact_id, occurred_at")
        .eq("user_id", user.id)
        .order("occurred_at", { ascending: false });

      if (contactsError) throw contactsError;
      if (interactionsError) throw interactionsError;

      const lastInteractionMap = new Map<string, string>();
      (interactions ?? []).forEach((interaction) => {
        if (!lastInteractionMap.has(interaction.contact_id)) {
          lastInteractionMap.set(
            interaction.contact_id,
            interaction.occurred_at,
          );
        }
      });

      const overdueMap = new Map<string, string>();
      (overdueReminders ?? []).forEach((reminder) => {
        overdueMap.set(
          reminder.contact_id,
          reminder.reason || "Follow-up overdue",
        );
      });

      return (contacts ?? [])
        .map((contact) => {
          const lastInteractionAt = lastInteractionMap.get(contact.id);
          const hasOverdueReminder = overdueMap.has(contact.id);
          const daysSinceContact = lastInteractionAt
            ? Math.floor(
              (Date.now() - new Date(lastInteractionAt).getTime()) /
                (1000 * 60 * 60 * 24),
            )
            : 999;

          return {
            id: contact.id,
            name: contact.name,
            avatarUrl: contact.avatar_url,
            daysSinceContact,
            hasOverdueReminder,
            reminderReason: overdueMap.get(contact.id) ?? null,
          };
        })
        .filter((contact) =>
          contact.hasOverdueReminder ||
          contact.daysSinceContact >= thresholdDays
        )
        .sort((left, right) => {
          if (left.hasOverdueReminder && !right.hasOverdueReminder) return -1;
          if (!left.hasOverdueReminder && right.hasOverdueReminder) return 1;
          return right.daysSinceContact - left.daysSinceContact;
        });
    },
  });

  const reflectionSignalsQuery = useQuery({
    queryKey: ["companion-planner-reflections", user?.id],
    enabled: !!user?.id,
    staleTime: 5 * 60 * 1000,
    queryFn: async (): Promise<PlannerReflectionSignal[]> => {
      if (!user?.id) return [];

      const [
        { data: checkIns, error: checkInError },
        { data: reflections, error: reflectionError },
      ] = await Promise.all([
        supabase
          .from("daily_check_ins")
          .select("check_in_date, mood, reflection")
          .eq("user_id", user.id)
          .eq("check_in_type", "morning")
          .order("check_in_date", { ascending: false })
          .limit(3),
        supabase
          .from("evening_reflections")
          .select("reflection_date, mood, wins, tomorrow_adjustment")
          .eq("user_id", user.id)
          .order("reflection_date", { ascending: false })
          .limit(2),
      ]);

      if (checkInError) throw checkInError;
      if (reflectionError) throw reflectionError;

      const checkInSignals: PlannerReflectionSignal[] = (checkIns ?? []).map((
        checkIn,
      ) => ({
        date: checkIn.check_in_date,
        source: "check_in",
        mood: checkIn.mood ?? "unknown",
        energy: mapMoodToEnergy(checkIn.mood),
        wins: checkIn.reflection ?? null,
        tomorrowAdjustment: null,
      }));
      const reflectionSignals: PlannerReflectionSignal[] = (reflections ?? [])
        .map((reflection) => ({
          date: reflection.reflection_date,
          source: "reflection",
          mood: reflection.mood ?? "unknown",
          energy: mapMoodToEnergy(reflection.mood),
          wins: reflection.wins ?? null,
          tomorrowAdjustment: reflection.tomorrow_adjustment ?? null,
        }));

      return [...checkInSignals, ...reflectionSignals]
        .sort((left, right) => right.date.localeCompare(left.date))
        .slice(0, 5);
    },
  });

  const recentStatSignalsQuery = useQuery({
    queryKey: ["companion-planner-stat-signals", user?.id, todayIso],
    enabled: !!user?.id,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      if (!user?.id) {
        return {
          recentEvents: [],
          recentTasks: [],
        };
      }

      const eventsStartDate = format(addDays(today, -13), "yyyy-MM-dd");
      const tasksStartDate = format(addDays(today, -6), "yyyy-MM-dd");
      const [
        { data: recentEvents, error: recentEventsError },
        { data: recentTasks, error: recentTasksError },
      ] = await Promise.all([
        supabase
          .from("companion_attribute_events")
          .select(
            "attribute, source_event, amount_awarded, echo_amount, created_at",
          )
          .eq("user_id", user.id)
          .gte("created_at", `${eventsStartDate}T00:00:00.000Z`)
          .lte("created_at", `${todayIso}T23:59:59.999Z`),
        supabase
          .from("daily_tasks")
          .select(
            "id, task_text, task_date, category, difficulty, priority, completed, scheduled_time, completed_at, contact_id, habit_source_id",
          )
          .eq("user_id", user.id)
          .gte("task_date", tasksStartDate)
          .lte("task_date", todayIso),
      ]);

      if (recentEventsError) throw recentEventsError;
      if (recentTasksError) throw recentTasksError;

      return {
        recentEvents: recentEvents ?? [],
        recentTasks: recentTasks ?? [],
      };
    },
  });

  const activeTasks = useMemo(() => {
    if (horizon === "month") return monthTasksQuery.tasks;
    if (horizon === "week") return weekTasksQuery.tasks;
    return todayTasksQuery.tasks;
  }, [
    horizon,
    monthTasksQuery.tasks,
    todayTasksQuery.tasks,
    weekTasksQuery.tasks,
  ]);

  const contextTasks = useMemo(() => (
    horizon === "month" ? monthTasksQuery.tasks : weekTasksQuery.tasks
  ), [horizon, monthTasksQuery.tasks, weekTasksQuery.tasks]);

  const plannerMemory = useMemo<PlannerMemoryProfile>(() => {
    const remoteProfile = extractPlannerProfile(
      plannerMemoryQuery.data?.preferredWorkBlocks,
    );
    const preferredTimeOfDay = plannerMemoryOverride?.preferredTimeOfDay ??
      sessionState.preferredTimeOfDay ??
      remoteProfile.preferredTimeOfDay ??
      storedPreferences.preferredTimeOfDay ??
      null;
    const preferredTimeReason = resolveTimeReasonFromSources({
      resolvedTimeOfDay: preferredTimeOfDay,
      sources: [
        {
          timeOfDay: plannerMemoryOverride?.preferredTimeOfDay ?? null,
          timeReason: plannerMemoryOverride?.preferredTimeReason ?? null,
        },
        {
          timeOfDay: sessionState.preferredTimeOfDay ?? null,
          timeReason: sessionState.preferredTimeReason ?? null,
        },
        {
          timeOfDay: remoteProfile.preferredTimeOfDay ?? null,
          timeReason: remoteProfile.preferredTimeReason ?? null,
        },
        {
          timeOfDay: storedPreferences.preferredTimeOfDay ?? null,
          timeReason: storedPreferences.preferredTimeReason ?? null,
        },
      ],
    });
    const reminderMinutesBefore =
      plannerMemoryOverride?.reminderMinutesBefore ??
        remoteProfile.reminderMinutesBefore ??
        parseReminderPreferenceMinutes(sessionState.reminderPreference) ??
        parseReminderPreferenceMinutes(storedPreferences.reminderPreference) ??
        null;
    const preferredWindows = plannerMemoryOverride?.preferredWindows ??
      remoteProfile.preferredWindows ??
      (preferredTimeOfDay
        ? [{
          timeOfDay: preferredTimeOfDay,
          reason: preferredTimeReason,
          sourceCount: 1,
        }]
        : []);
    const cadencePatterns = plannerMemoryOverride?.cadencePatterns ??
      {
        ...asNumberRecord(plannerMemoryQuery.data?.schedulingPatterns),
        ...asNumberRecord(plannerMemoryQuery.data?.successfulPatterns),
        ...remoteProfile.cadencePatterns,
      };

    return {
      tonePack: plannerMemoryOverride?.tonePack ?? tonePack,
      preferredTimeOfDay,
      preferredTimeReason,
      reminderMinutesBefore,
      wakeTime: plannerMemoryOverride?.wakeTime ??
        plannerMemoryQuery.data?.wakeTime ??
        remoteProfile.wakeTime ??
        null,
      windDownTime: plannerMemoryOverride?.windDownTime ??
        plannerMemoryQuery.data?.windDownTime ??
        remoteProfile.windDownTime ??
        null,
      peakProductivityTimes: plannerMemoryOverride?.peakProductivityTimes ??
        plannerMemoryQuery.data?.peakProductivityTimes ??
        remoteProfile.peakProductivityTimes ??
        [],
      preferredWindows,
      cadencePatterns,
      workloadTolerance: plannerMemoryOverride?.workloadTolerance ??
        remoteProfile.workloadTolerance ??
        (plannerMemoryQuery.data?.defaultEnergyLevel === "low"
          ? "light"
          : plannerMemoryQuery.data?.defaultEnergyLevel === "high"
          ? "heavy"
          : null),
      contactCadencePatterns: plannerMemoryOverride?.contactCadencePatterns ??
        remoteProfile.contactCadencePatterns ??
        {},
      lastConfirmedAt: plannerMemoryOverride?.lastConfirmedAt ??
        remoteProfile.lastConfirmedAt ?? null,
    };
  }, [
    plannerMemoryOverride,
    plannerMemoryQuery.data?.defaultEnergyLevel,
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

  const scheduleInsights = useMemo<PlannerScheduleInsights>(
    () =>
      buildCompanionPlannerScheduleInsights({
        tasks: activeTasks.map(serializeTaskContext),
        calendarEvents: activeEventsQuery.events,
        horizon,
        selectedDate: todayIso,
        plannerMemory,
      }),
    [activeEventsQuery.events, activeTasks, horizon, plannerMemory, todayIso],
  );

  const careSignals = useMemo<PlannerCareState>(() => ({
    overallCare: care.overallCare,
    hasDormancyWarning: care.hasDormancyWarning,
    dialogueTone: care.dialogueTone,
    inactiveDays: care.dormancy.inactiveDays,
    daysUntilDormancy: care.dormancy.daysUntilDormancy,
  }), [
    care.dialogueTone,
    care.dormancy.daysUntilDormancy,
    care.dormancy.inactiveDays,
    care.hasDormancyWarning,
    care.overallCare,
  ]);

  const statInterpretation = useMemo(() =>
    buildCompanionStatInterpretation({
      currentDate: todayIso,
      scores: {
        vitality: companion?.vitality,
        wisdom: companion?.wisdom,
        discipline: companion?.discipline,
        resolve: companion?.resolve,
        creativity: companion?.creativity,
        alignment: companion?.alignment,
      },
      recentEvents: (recentStatSignalsQuery.data?.recentEvents ?? []).map((
        event,
      ) => ({
        attribute: event.attribute,
        sourceEvent: event.source_event,
        amountAwarded: event.amount_awarded,
        echoAmount: event.echo_amount,
        createdAt: event.created_at,
      })),
      recentTasks: (recentStatSignalsQuery.data?.recentTasks ?? []).map((
        task,
      ) => ({
        id: task.id,
        title: task.task_text,
        taskDate: task.task_date,
        category: task.category,
        difficulty: task.difficulty,
        priority: task.priority,
        completed: task.completed,
        scheduledTime: task.scheduled_time,
        completedAt: task.completed_at,
        contactId: task.contact_id,
        habitSourceId: task.habit_source_id,
      })),
      reflectionSignals: reflectionSignalsQuery.data ?? [],
      scheduleSummary: {
        selectedDateStatus: scheduleInsights.dayLoads.find((entry) =>
          entry.date === todayIso
        )?.status ?? null,
        overloadedDates: scheduleInsights.overloadedDates,
      },
    }), [
    companion?.alignment,
    companion?.creativity,
    companion?.discipline,
    companion?.resolve,
    companion?.vitality,
    companion?.wisdom,
    recentStatSignalsQuery.data?.recentEvents,
    recentStatSignalsQuery.data?.recentTasks,
    reflectionSignalsQuery.data,
    scheduleInsights.dayLoads,
    scheduleInsights.overloadedDates,
    todayIso,
  ]);

  const strongestPlannerNeed = useMemo(() => {
    const rankedNeed = Object.entries(statInterpretation.statNeeds)
      .sort((left, right) => {
        const weight = (level: string) =>
          level === "high" ? 3 : level === "medium" ? 2 : 1;
        const diff = weight(right[1].level) - weight(left[1].level);
        if (diff !== 0) return diff;
        return right[1].reasons.length - left[1].reasons.length;
      })[0];

    return rankedNeed?.[1].level === "low" ? null : rankedNeed?.[0] ?? null;
  }, [statInterpretation]);

  const priorityScores = useMemo<PlannerPriorityScore[]>(
    () =>
      computePlannerPriorityScores({
        currentDate: todayIso,
        tasks: contextTasks.map(serializeTaskContext),
        inboxTasks: inboxTasks.map(serializeTaskContext),
        activeEpics: mapEpicsToContext(activeEpics, todayIso),
        rituals: mapRitualsToContext(activeEpics),
        calendarEvents: contextEventsQuery
          .events as PlannerContextCalendarEvent[],
        contactsNeedingAttention: contactsAttentionQuery.data ?? [],
        reflectionSignals: reflectionSignalsQuery.data ?? [],
        careSignals,
        scheduleInsights,
        plannerMemory,
        statInterpretation,
        aiSignals: enrichedContext
          ? {
            suggestedWorkload: enrichedContext.suggestedWorkload,
          }
          : undefined,
        starterIntent: "general",
      }),
    [
      activeEpics,
      careSignals,
      contactsAttentionQuery.data,
      contextEventsQuery.events,
      contextTasks,
      enrichedContext,
      inboxTasks,
      plannerMemory,
      statInterpretation,
      reflectionSignalsQuery.data,
      scheduleInsights,
      todayIso,
    ],
  );

  const plannerContext = useMemo<CompanionPlannerRequest["plannerContext"]>(
    () => ({
      tasks: mapTasksToContext(contextTasks.map(serializeTaskContext)),
      inboxTasks: mapTasksToContext(inboxTasks.map(serializeTaskContext)),
      activeEpics: mapEpicsToContext(activeEpics, todayIso),
      rituals: mapRitualsToContext(activeEpics),
      calendarEvents: contextEventsQuery
        .events as PlannerContextCalendarEvent[],
      contactsNeedingAttention: contactsAttentionQuery.data ?? [],
      reflectionSignals: reflectionSignalsQuery.data ?? [],
      careSignals,
      priorityScores,
      scheduleInsights,
      plannerMemory,
      statInterpretation,
      aiSignals: enrichedContext
        ? {
          preferredDifficulty: enrichedContext.preferredDifficulty,
          preferredHabitFrequency: enrichedContext.preferredHabitFrequency,
          preferredEpicDuration: enrichedContext.preferredEpicDuration,
          commonContexts: enrichedContext.commonContexts,
          suggestedWorkload: enrichedContext.suggestedWorkload,
        }
        : undefined,
    }),
    [
      activeEpics,
      careSignals,
      contactsAttentionQuery.data,
      contextEventsQuery.events,
      contextTasks,
      enrichedContext,
      inboxTasks,
      plannerMemory,
      priorityScores,
      statInterpretation,
      reflectionSignalsQuery.data,
      scheduleInsights,
      todayIso,
    ],
  );

  const conversationHistory = useMemo<
    CompanionPlannerRequest["conversationHistory"]
  >(() => (
    messages
      .slice(-16)
      .map((message) => ({
        role: message.role === "companion" ? "assistant" : "user",
        content: message.content,
      }))
  ), [messages]);

  const plannerSyncRange = useMemo(
    () => getPlannerSyncRange(today, horizon),
    [horizon, todayIso],
  );

  const syncOutlookPlanningContext = useCallback(async () => {
    if (!outlookConnection) return null;

    if (!outlookPlannerSyncPromiseRef.current) {
      outlookPlannerSyncPromiseRef.current = (async () => {
        try {
          return await syncPlanningContext.mutateAsync({
            startDate: plannerSyncRange.startDate,
            endDate: plannerSyncRange.endDate,
          });
        } catch (error) {
          console.warn("Failed to sync Outlook planning context:", error);
          return null;
        } finally {
          outlookPlannerSyncPromiseRef.current = null;
        }
      })();
    }

    return await outlookPlannerSyncPromiseRef.current;
  }, [
    outlookConnection?.id,
    plannerSyncRange.endDate,
    plannerSyncRange.startDate,
    syncPlanningContext,
  ]);

  useEffect(() => {
    if (!bootstrapGreeting) return;
    if (bootstrappedGreetingRef.current) return;
    if (!plannerGreeting) return;

    bootstrappedGreetingRef.current = true;
    setMessages([
      createMessage("companion", plannerGreeting, {
        questions: [],
        proposalIds: [],
      }),
    ]);
  }, [bootstrapGreeting, plannerGreeting]);

  useEffect(() => {
    writeStoredPreferences({
      tonePack,
      preferredTimeOfDay: sessionState.preferredTimeOfDay ?? null,
      preferredTimeReason: sessionState.preferredTimeReason ?? null,
      reminderPreference: sessionState.reminderPreference ?? null,
    });
  }, [
    sessionState.preferredTimeOfDay,
    sessionState.preferredTimeReason,
    sessionState.reminderPreference,
    tonePack,
  ]);

  useEffect(() => {
    if (!outlookConnection) return;
    void syncOutlookPlanningContext();
  }, [
    outlookConnection?.id,
    plannerSyncRange.endDate,
    plannerSyncRange.startDate,
    syncOutlookPlanningContext,
  ]);

  useEffect(() => {
    if (!outlookConnection) return;

    const handleFocus = () => {
      void syncOutlookPlanningContext();
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        void syncOutlookPlanningContext();
      }
    };

    const intervalId = window.setInterval(() => {
      void syncOutlookPlanningContext();
    }, OUTLOOK_PLANNER_SYNC_INTERVAL_MS);

    window.addEventListener("focus", handleFocus);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener("focus", handleFocus);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [outlookConnection?.id, syncOutlookPlanningContext]);

  const persistPlannerThreadRows = useCallback(async (
    rows: Array<{
      role: "assistant" | "user";
      content: string;
      createdAt: string;
      inputMode?: CompanionPlannerMessage["inputMode"];
    }>,
  ) => {
    if (
      !threadPersistence?.enabled || threadPersistence.surface !== "journeys"
    ) return;
    if (!user?.id || !companion?.id) return;
    if (rows.length === 0) return;

    try {
      await persistCompanionThreadMessages({
        userId: user.id,
        companionId: companion.id,
        sessionId: sessionIdRef.current,
        surface: threadPersistence.surface,
        source: "plan",
        rows,
      });

      await queryClient.invalidateQueries({
        queryKey: getCompanionChatThreadsQueryKey(
          user.id,
          companion.id,
          threadPersistence.surface,
        ),
      });
    } catch (error) {
      console.warn("Failed to persist journeys planner thread rows:", error);
    }
  }, [
    companion?.id,
    queryClient,
    threadPersistence?.enabled,
    threadPersistence?.surface,
    user?.id,
  ]);

  const appendAssistantTurn = useCallback(
    (response: CompanionPlannerResponse) => {
      const assistantMessage = createMessage(
        "companion",
        stripMarkdown(response.reply),
        {
          questions: response.followUpQuestions,
          proposalIds: [...response.proposals, ...response.suggestedReminders]
            .map((proposal) => proposal.id),
        },
      );

      setQuestions(response.followUpQuestions);
      setProposals((previous) => {
        const settled = previous.filter((proposal) =>
          proposal.status !== "pending"
        );
        const incoming = [
          ...response.proposals,
          ...response.suggestedReminders,
        ];
        return [...settled, ...incoming];
      });
      setMessages((previous) => [
        ...previous,
        assistantMessage,
      ]);
      setSessionState(response.sessionState);
      return assistantMessage;
    },
    [],
  );

  const primeQuestCapture = useCallback((prompt = "Quest?") => {
    const trimmedPrompt = stripMarkdown(prompt).trim();
    if (!trimmedPrompt) return;

    setMessages((previous) => [
      ...previous,
      createMessage("companion", trimmedPrompt, {
        questions: [],
        proposalIds: [],
      }),
    ]);
    setProposals([]);
    setQuestions([]);
    setSessionState((previous) => ({
      ...previous,
      draft: {
        draftKind: "create_quest",
      },
      openQuestionIds: [],
      pendingStarterIntent: "quest_capture",
    }));
    setDraftInput("");
    setInterimText("");
    setIsSubmitting(false);
  }, []);

  const persistPlannerMemory = useCallback(async (
    proposal: CompanionPlannerProposal,
    nextSessionState: CompanionPlannerSessionState,
  ) => {
    if (!user?.id) return;

    const remoteProfile = extractPlannerProfile(
      plannerMemoryQuery.data?.preferredWorkBlocks,
    );
    const latestSubmission = lastSubmissionContextRef.current;
    const proposalTime = inferScheduledTimeFromProposal(
      proposal.kind,
      proposal.payload,
    );
    const preferredTimeOfDay = nextSessionState.preferredTimeOfDay ??
      parseTimeOfDayFromClock(proposalTime) ??
      plannerMemory.preferredTimeOfDay ??
      remoteProfile.preferredTimeOfDay ??
      storedPreferences.preferredTimeOfDay ??
      null;
    const preferredTimeReason = resolveTimeReasonFromSources({
      resolvedTimeOfDay: preferredTimeOfDay,
      sources: [
        {
          timeOfDay: nextSessionState.preferredTimeOfDay ?? null,
          timeReason: nextSessionState.preferredTimeReason ?? null,
        },
        {
          timeOfDay: plannerMemoryOverride?.preferredTimeOfDay ?? null,
          timeReason: plannerMemoryOverride?.preferredTimeReason ?? null,
        },
        {
          timeOfDay: remoteProfile.preferredTimeOfDay ?? null,
          timeReason: remoteProfile.preferredTimeReason ?? null,
        },
        {
          timeOfDay: storedPreferences.preferredTimeOfDay ?? null,
          timeReason: storedPreferences.preferredTimeReason ?? null,
        },
      ],
    });
    const reminderMinutesBefore =
      inferReminderMinutesFromProposal(proposal.kind, proposal.payload) ??
        plannerMemory.reminderMinutesBefore ??
        remoteProfile.reminderMinutesBefore ??
        null;
    const cadenceKey = inferCadenceKeyFromProposal(
      proposal.kind,
      proposal.payload,
    );
    const cadencePatterns = {
      ...(plannerMemory.cadencePatterns ?? {}),
    };

    if (cadenceKey) {
      cadencePatterns[cadenceKey] = (cadencePatterns[cadenceKey] ?? 0) + 1;
    }

    const contactCadencePatterns = {
      ...(plannerMemory.contactCadencePatterns ?? {}),
      ...(remoteProfile.contactCadencePatterns ?? {}),
    };
    const contactId = (
      typeof proposal.payload.contactId === "string"
        ? proposal.payload.contactId
        : proposal.kind === "update_quest"
        ? (
          proposal.payload.updates &&
            typeof proposal.payload.updates === "object" &&
            !Array.isArray(proposal.payload.updates) &&
            typeof (proposal.payload.updates as Record<string, unknown>)
                .contact_id === "string"
            ? (proposal.payload.updates as Record<string, string>).contact_id
            : null
        )
        : null
    ) ?? null;

    if (contactId) {
      contactCadencePatterns[contactId] =
        (contactCadencePatterns[contactId] ?? 0) + 1;
    }

    const workloadTolerance =
      latestSubmission.starterIntent === "low_energy_adjust"
        ? "light"
        : plannerMemory.workloadTolerance ??
          remoteProfile.workloadTolerance ??
          plannerContext.aiSignals?.suggestedWorkload ??
          null;

    const preferredWindows = mergePreferredWindows(
      plannerMemory.preferredWindows ?? [],
      preferredTimeOfDay
        ? {
          timeOfDay: preferredTimeOfDay,
          time: proposalTime,
          reason: preferredTimeReason,
          sourceCount: 1,
        }
        : null,
    );

    const nextMemory: PlannerMemoryProfile = {
      ...plannerMemory,
      tonePack,
      preferredTimeOfDay,
      preferredTimeReason,
      reminderMinutesBefore,
      preferredWindows,
      cadencePatterns,
      workloadTolerance,
      contactCadencePatterns,
      lastConfirmedAt: new Date().toISOString(),
    };

    setPlannerMemoryOverride(nextMemory);

    const nextPreferredWorkBlocks = {
      ...remoteProfile.preferredWorkBlocksRecord,
      planner_profile: {
        tonePack,
        preferredTimeOfDay: nextMemory.preferredTimeOfDay ?? null,
        preferredTimeReason: nextMemory.preferredTimeReason ?? null,
        reminderMinutesBefore: nextMemory.reminderMinutesBefore ?? null,
        wakeTime: nextMemory.wakeTime ?? null,
        windDownTime: nextMemory.windDownTime ?? null,
        peakProductivityTimes: nextMemory.peakProductivityTimes ?? [],
        preferredWindows: nextMemory.preferredWindows ?? [],
        cadencePatterns: nextMemory.cadencePatterns ?? {},
        workloadTolerance: nextMemory.workloadTolerance ?? null,
        contactCadencePatterns: nextMemory.contactCadencePatterns ?? {},
        lastConfirmedAt: nextMemory.lastConfirmedAt ?? null,
      },
    } satisfies Record<string, Json>;

    const { error } = await supabase
      .from("daily_planning_preferences")
      .upsert({
        user_id: user.id,
        preferred_work_blocks: nextPreferredWorkBlocks,
        wake_time: nextMemory.wakeTime ?? null,
        wind_down_time: nextMemory.windDownTime ?? null,
      }, { onConflict: "user_id" });

    if (error) {
      console.warn("Failed to persist companion planner memory:", error);
    }
  }, [
    plannerContext.aiSignals?.suggestedWorkload,
    plannerMemory,
    plannerMemoryOverride?.preferredTimeOfDay,
    plannerMemoryOverride?.preferredTimeReason,
    plannerMemoryQuery.data?.preferredWorkBlocks,
    storedPreferences.preferredTimeOfDay,
    storedPreferences.preferredTimeReason,
    tonePack,
    user?.id,
  ]);

  const submitMessage = useCallback(async (
    rawMessage: string,
    inputMode: CompanionPlannerMessage["inputMode"],
    options?: {
      skipUserEcho?: boolean;
      starterIntent?: CompanionPlannerStarterIntent;
      briefingContext?: PlannerBriefingContext | null;
    },
  ) => {
    const message = rawMessage.trim();
    if (!message || isSubmitting) return;

    const resolvedStarterIntent = options?.starterIntent ??
      deriveStarterIntentFromMessage(message);
    if (resolvedStarterIntent === "quest_capture" && !options?.skipUserEcho) {
      primeQuestCapture(message);
      return;
    }

    setIsSubmitting(true);
    setDraftInput("");
    setInterimText("");
    const userMessage = createMessage("user", message, { inputMode });
    if (!options?.skipUserEcho) {
      setMessages((previous) => [
        ...previous,
        userMessage,
      ]);
    }

    const parsedInput = parseNaturalLanguage(message);

    try {
      const resolvedBriefingContext = options?.briefingContext ?? null;
      const syncedPlannerContext = mergePlannerContextWithOutlookSync(
        plannerContext,
        await syncOutlookPlanningContext(),
      );
      const requestPriorityScores = computePlannerPriorityScores({
        currentDate: todayIso,
        tasks: syncedPlannerContext.tasks,
        inboxTasks: syncedPlannerContext.inboxTasks,
        activeEpics: syncedPlannerContext.activeEpics,
        rituals: syncedPlannerContext.rituals,
        calendarEvents: syncedPlannerContext
          .calendarEvents as PlannerContextCalendarEvent[],
        contactsNeedingAttention: contactsAttentionQuery.data ?? [],
        reflectionSignals: reflectionSignalsQuery.data ?? [],
        careSignals,
        briefingContext: resolvedBriefingContext,
        starterIntent: resolvedStarterIntent,
        scheduleInsights,
        plannerMemory,
        aiSignals: enrichedContext
          ? {
            suggestedWorkload: enrichedContext.suggestedWorkload,
          }
          : undefined,
      });
      lastSubmissionContextRef.current = {
        starterIntent: resolvedStarterIntent,
        briefingContext: resolvedBriefingContext,
      };
      const classification = await classify(message);
      const classificationHint = normalizeClassificationHint(classification);
      const { data, error } = await supabase.functions.invoke(
        "companion-planner-chat",
        {
          body: {
            message,
            currentDate: todayIso,
            currentDateTime: formatCurrentDateTimeWithOffset(new Date()),
            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
            horizon,
            tonePack,
            conversationHistory,
            sessionState,
            parsedInput: {
              text: parsedInput.text,
              scheduledTime: parsedInput.scheduledTime,
              scheduledDate: parsedInput.scheduledDate,
              estimatedDuration: parsedInput.estimatedDuration,
              recurrencePattern: parsedInput.recurrencePattern,
              recurrenceDays: parsedInput.recurrenceDays,
              recurrenceMonthDays: parsedInput.recurrenceMonthDays,
              recurrenceCustomPeriod: parsedInput.recurrenceCustomPeriod,
              recurrenceEndDate: parsedInput.recurrenceEndDate,
              notes: parsedInput.notes,
              category: parsedInput.category,
              newTitle: parsedInput.newTitle,
            },
            classificationHint,
            plannerContext: {
              ...syncedPlannerContext,
              starterIntent: resolvedStarterIntent,
              briefingContext: resolvedBriefingContext,
              priorityScores: requestPriorityScores,
            },
          } satisfies CompanionPlannerRequest,
        },
      );

      if (error) throw error;

      const response = normalizePlannerResponse(
        data as CompanionPlannerResponse,
      );
      const nextSession = applyMemoryUpdates(
        response.sessionState,
        response.memoryUpdates,
      );
      const assistantMessage = appendAssistantTurn({
        ...response,
        sessionState: nextSession,
      });

      await persistPlannerThreadRows([
        ...(
          options?.skipUserEcho ? [] : [{
            role: "user" as const,
            content: userMessage.content,
            createdAt: userMessage.createdAt,
            inputMode: userMessage.inputMode,
          }]
        ),
        {
          role: "assistant",
          content: assistantMessage.content,
          createdAt: assistantMessage.createdAt,
        },
      ]);

      await trackInteraction({
        interactionType: "companion_planner",
        inputText: message,
        detectedIntent: response.sessionState.lastClassification ??
          classification?.type,
        aiResponse: {
          reply: response.reply,
          questions: response.followUpQuestions.map((question) =>
            question.field
          ),
          proposalKinds: response.proposals.map((proposal) => proposal.kind),
        },
        userAction: "accepted",
      });
    } catch (error) {
      console.error("Failed to submit planner message:", error);
      const userMessage = await resolveCompanionPlannerError(error);
      toast.error(userMessage);
      setMessages((previous) => [
        ...previous,
        createMessage("companion", userMessage),
      ]);
    } finally {
      setIsSubmitting(false);
    }
  }, [
    activeEpics,
    appendAssistantTurn,
    careSignals,
    classify,
    contactsAttentionQuery.data,
    contextEventsQuery.events,
    contextTasks,
    conversationHistory,
    enrichedContext,
    horizon,
    inboxTasks,
    isSubmitting,
    persistPlannerThreadRows,
    plannerContext,
    plannerMemory,
    reflectionSignalsQuery.data,
    scheduleInsights,
    sessionState,
    syncOutlookPlanningContext,
    todayIso,
    tonePack,
    trackInteraction,
  ]);

  const autoPublishConfirmedQuestToOutlook = useCallback(async (
    proposal: CompanionPlannerProposal,
    taskId: string | null,
    mutationResult?: { queued?: boolean } | null,
  ) => {
    if (!shouldAutoPublishToOutlook) return true;
    if (!taskId || mutationResult?.queued) return true;
    if (
      !["create_quest", "update_quest", "suggest_reminder"].includes(
        proposal.kind,
      )
    ) return true;

    try {
      await sendTaskToCalendar.mutateAsync({
        taskId,
        options: {
          provider: "outlook",
        },
      });
      return true;
    } catch (error) {
      console.error("Failed to auto-publish planner quest to Outlook:", error);
      toast("Saved locally. Outlook still needs another sync pass.");
      return false;
    }
  }, [sendTaskToCalendar, shouldAutoPublishToOutlook]);

  const handleConfirmProposal = useCallback(async (proposalId: string) => {
    const proposal = findProposalById(proposals, proposalId);
    if (!proposal) return;
    if (!proposal.readyToConfirm) {
      toast("I still need a bit more detail before I can save that.");
      return;
    }

    try {
      let confirmationContent = `Saved: ${proposal.title}.`;
      let localTaskId: string | null = null;
      let mutationResult: { queued?: boolean } | null = null;

      switch (proposal.kind) {
        case "create_quest": {
          const payload = sanitizeCreateQuestProposalPayload(proposal.payload);
          const createResult = await addTask(payload);
          localTaskId = typeof createResult?.id === "string"
            ? createResult.id
            : null;
          mutationResult = createResult as { queued?: boolean } | null;
          await trackTaskCreation(
            payload.scheduledTime ?? null,
            payload.difficulty ?? "medium",
            payload.category,
            payload.taskText,
          );
          break;
        }
        case "update_quest": {
          const payload = proposal.payload as {
            taskId?: unknown;
            updates?: unknown;
            subtaskPlan?: unknown;
          };
          const taskId = typeof payload.taskId === "string"
            ? payload.taskId
            : null;
          if (!taskId) {
            throw new Error("Missing quest id for update proposal");
          }

          const updates = asUnknownRecord(payload.updates) as
            | Parameters<typeof updateTask>[0]["updates"]
            | null;
          const taskUpdatePayload = {
            taskId,
            updates: updates ?? {},
          } satisfies Parameters<typeof updateTask>[0];
          const subtaskPlan = extractQuestSubtaskPlan(proposal.payload);
          const previousTask = activeTasks.find((task) => task.id === taskId) ??
            inboxTasks.find((task) => task.id === taskId);

          mutationResult = await updateTask(taskUpdatePayload) as {
            queued?: boolean;
          } | null;
          localTaskId = taskId;

          const nextScheduledTime = typeof updates?.scheduled_time === "string"
            ? updates.scheduled_time
            : null;
          if (
            previousTask?.scheduled_time && nextScheduledTime &&
            previousTask.scheduled_time !== nextScheduledTime
          ) {
            await trackScheduleModification(
              previousTask.scheduled_time,
              nextScheduledTime,
              previousTask.difficulty ?? "medium",
            );
          }

          if (subtaskPlan) {
            if (!user?.id) {
              throw new Error("User not authenticated");
            }

            try {
              await applySubtaskTitlePlan({
                mode: subtaskPlan.mode,
                taskId,
                userId: user.id,
                titles: subtaskPlan.titles,
                shouldQueueWrites,
                queueAction,
                retryNow,
              });

              await Promise.all([
                queryClient.invalidateQueries({
                  queryKey: ["subtasks", normalizeUuidLikeId(taskId)],
                }),
                queryClient.invalidateQueries({ queryKey: ["daily-tasks"] }),
                queryClient.invalidateQueries({ queryKey: ["calendar-tasks"] }),
                queryClient.invalidateQueries({ queryKey: ["inbox-tasks"] }),
              ]);
            } catch (subtaskError) {
              console.error(
                "Failed to apply quest subtask plan:",
                subtaskError,
              );
              confirmationContent =
                `Saved: ${proposal.title}. I couldn't finish the step breakdown yet.`;
              toast(
                "Quest updated, but I couldn't finish the step breakdown yet.",
              );
            }
          }
          break;
        }
        case "create_campaign": {
          const payload = proposal.payload as Parameters<typeof createEpic>[0];
          await createEpic(payload);
          const starterHabit = payload.habits?.[0];
          if (starterHabit?.preferred_time) {
            await trackTaskCreation(
              starterHabit.preferred_time,
              starterHabit.difficulty ?? "medium",
              starterHabit.category ?? undefined,
              starterHabit.title,
            );
          }
          break;
        }
        case "update_campaign": {
          const payload = proposal.payload as { epicId: string; title: string };
          await renameEpic(payload);
          break;
        }
        case "adjust_campaign_plan": {
          const payload = proposal.payload as {
            epicId: string;
            adjustmentType?:
              | "extend_deadline"
              | "reduce_scope"
              | "add_habits"
              | "remove_habits"
              | "reschedule"
              | "custom";
            reason?: string | null;
          };

          const { data: adjustmentResult, error: adjustmentError } =
            await supabase.functions.invoke("adjust-epic-plan", {
              body: {
                epicId: payload.epicId,
                adjustmentType: payload.adjustmentType ?? "custom",
                reason: payload.reason ?? undefined,
                customRequest: payload.reason ?? undefined,
              },
            });

          if (adjustmentError) throw adjustmentError;

          const suggestions = Array.isArray(
              (adjustmentResult as { suggestions?: unknown[] } | null)
                ?.suggestions,
            )
            ? (adjustmentResult as { suggestions: unknown[] }).suggestions
            : [];

          if (suggestions.length === 0) {
            throw new Error("No campaign adjustments were generated.");
          }

          const { error: applyError } = await supabase.functions.invoke(
            "apply-epic-adjustments",
            {
              body: {
                epicId: payload.epicId,
                adjustments: suggestions,
                adjustmentType: payload.adjustmentType ?? "custom",
                reason: payload.reason ?? undefined,
              },
            },
          );

          if (applyError) throw applyError;
          break;
        }
        case "create_ritual": {
          const payload = proposal.payload as Parameters<
            typeof createCampaignRitual
          >[0];
          await createCampaignRitual(payload);
          if (payload.preferredTime) {
            await trackTaskCreation(
              payload.preferredTime,
              payload.difficulty ?? "medium",
              payload.category ?? undefined,
              payload.title,
            );
          }
          break;
        }
        case "update_ritual": {
          const payload = proposal.payload as Parameters<typeof saveRitual>[0];
          await saveRitual(payload);
          if (payload.preferredTime) {
            await trackTaskCreation(
              payload.preferredTime,
              payload.difficulty ?? "medium",
              payload.category ?? undefined,
              payload.title,
            );
          }
          break;
        }
        case "suggest_reminder": {
          const payload = proposal.payload as Parameters<typeof updateTask>[0];
          mutationResult = await updateTask(payload) as
            | { queued?: boolean }
            | null;
          localTaskId = payload.taskId;
          break;
        }
        default:
          return;
      }

      const autoPublishSucceeded = await autoPublishConfirmedQuestToOutlook(
        proposal,
        localTaskId,
        mutationResult,
      );
      if (!autoPublishSucceeded) {
        confirmationContent =
          `Saved: ${proposal.title}. Outlook still needs another sync pass.`;
      }

      setProposals((previous) =>
        previous.map((candidate) =>
          candidate.id === proposalId
            ? {
              ...candidate,
              status: "confirmed",
            }
            : candidate
        )
      );
      setQuestions([]);
      const confirmationMessage = createMessage(
        "companion",
        confirmationContent,
      );
      setMessages((previous) => [
        ...previous,
        confirmationMessage,
      ]);
      await persistPlannerThreadRows([
        {
          role: "assistant",
          content: confirmationMessage.content,
          createdAt: confirmationMessage.createdAt,
        },
      ]);
      const nextSessionState = {
        ...sessionState,
      };
      await persistPlannerMemory(proposal, nextSessionState);
      const optimizerTelemetry = extractOptimizerTelemetry(proposal);
      await trackInteraction({
        interactionType: "companion_planner_confirmation",
        inputText: proposal.title,
        detectedIntent: proposal.kind,
        aiResponse: { proposalKind: proposal.kind },
        userAction: "accepted",
        modifications: {
          proposalId: proposal.id,
          proposalKind: proposal.kind,
          statDrivenNeed: strongestPlannerNeed,
          ...optimizerTelemetry,
        },
      });
    } catch (error) {
      console.error("Failed to confirm planner proposal:", error);
      toast.error("I couldn't save that change yet.");
    }
  }, [
    activeTasks,
    addTask,
    createCampaignRitual,
    createEpic,
    inboxTasks,
    queryClient,
    proposals,
    queueAction,
    renameEpic,
    retryNow,
    saveRitual,
    sessionState,
    persistPlannerMemory,
    persistPlannerThreadRows,
    shouldQueueWrites,
    autoPublishConfirmedQuestToOutlook,
    strongestPlannerNeed,
    trackInteraction,
    trackScheduleModification,
    trackTaskCreation,
    updateTask,
    user?.id,
  ]);

  const handleRejectProposal = useCallback(async (proposalId: string) => {
    const proposal = findProposalById(proposals, proposalId);
    if (!proposal) return;

    setProposals((previous) =>
      previous.map((candidate) =>
        candidate.id === proposalId
          ? {
            ...candidate,
            status: "rejected",
          }
          : candidate
      )
    );
    setQuestions([]);
    const rejectionMessage = createMessage(
      "companion",
      `No problem. I won't save "${proposal.title}" as-is.`,
    );
    setMessages((previous) => [
      ...previous,
      rejectionMessage,
    ]);
    await persistPlannerThreadRows([
      {
        role: "assistant",
        content: rejectionMessage.content,
        createdAt: rejectionMessage.createdAt,
      },
    ]);
    const optimizerTelemetry = extractOptimizerTelemetry(proposal);
    await trackInteraction({
      interactionType: "companion_planner_confirmation",
      inputText: proposal.title,
      detectedIntent: proposal.kind,
      aiResponse: { proposalKind: proposal.kind },
      userAction: "rejected",
      modifications: {
        proposalId: proposal.id,
        proposalKind: proposal.kind,
        statDrivenNeed: strongestPlannerNeed,
        decisionOverride: true,
        ...optimizerTelemetry,
      },
    });
  }, [
    persistPlannerThreadRows,
    proposals,
    strongestPlannerNeed,
    trackInteraction,
  ]);

  const handleCompleteProposalEdit = useCallback(async (
    proposalId: string,
    options?: { savedTitle?: string | null },
  ) => {
    const proposal = findProposalById(proposals, proposalId);
    if (!proposal) return;

    const resolvedTitle = options?.savedTitle?.trim() || proposal.title;

    setProposals((previous) =>
      previous.map((candidate) =>
        candidate.id === proposalId
          ? {
            ...candidate,
            status: "modified",
            title: resolvedTitle,
          }
          : candidate
      )
    );
    setQuestions([]);
    const confirmationMessage = createMessage(
      "companion",
      `Saved your edits for "${resolvedTitle}".`,
    );
    setMessages((previous) => [
      ...previous,
      confirmationMessage,
    ]);
    await persistPlannerThreadRows([
      {
        role: "assistant",
        content: confirmationMessage.content,
        createdAt: confirmationMessage.createdAt,
      },
    ]);
    const optimizerTelemetry = extractOptimizerTelemetry(proposal);
    await trackInteraction({
      interactionType: "companion_planner_confirmation",
      inputText: proposal.title,
      detectedIntent: proposal.kind,
      aiResponse: { proposalKind: proposal.kind },
      userAction: "modified",
      modifications: {
        proposalId: proposal.id,
        proposalKind: proposal.kind,
        statDrivenNeed: strongestPlannerNeed,
        savedTitle: resolvedTitle,
        editedExternally: true,
        ...optimizerTelemetry,
      },
    });
  }, [
    persistPlannerThreadRows,
    proposals,
    strongestPlannerNeed,
    trackInteraction,
  ]);

  const handleConfirmAll = useCallback(async () => {
    const readyProposals = proposals.filter((proposal) =>
      proposal.status === "pending" && proposal.readyToConfirm
    );
    for (const proposal of readyProposals) {
      // Sequential saves keep the confirmation flow predictable and mutation-safe.
      await handleConfirmProposal(proposal.id);
    }
    setQuestions([]);
  }, [handleConfirmProposal, proposals]);

  const {
    isRecording,
    isAutoStopping,
    isSupported,
    permissionStatus,
    toggleRecording,
    requestPermission,
  } = useVoiceInput({
    onInterimResult: (text) => {
      setInterimText(text);
    },
    onFinalResult: (text) => {
      const nextMessage = text.trim();
      if (!nextMessage) return;
      void submitMessage(nextMessage, "voice");
    },
    onError: (message) => {
      toast.error(message);
    },
    onPermissionNeeded: () => {
      setShowPermissionDialog(true);
    },
  });

  const requestMicrophonePermission = useCallback(async () => {
    setIsRequestingPermission(true);
    try {
      const status = await requestPermission();
      if (status === "granted") {
        setShowPermissionDialog(false);
        toggleRecording();
      }
    } finally {
      setIsRequestingPermission(false);
    }
  }, [requestPermission, toggleRecording]);

  const pendingProposals = useMemo(
    () => proposals.filter((proposal) => proposal.status === "pending"),
    [proposals],
  );

  const readyProposalCount =
    pendingProposals.filter((proposal) => proposal.readyToConfirm).length;

  const resetThread = useCallback((options?: { sessionId?: string }) => {
    sessionIdRef.current = options?.sessionId ??
      generateCompanionThreadSessionId();
    setMessages(
      bootstrapGreeting && plannerGreeting
        ? [
          createMessage("companion", plannerGreeting, {
            questions: [],
            proposalIds: [],
          }),
        ]
        : [],
    );
    setProposals([]);
    setQuestions([]);
    setSessionState(createInitialSessionState(storedPreferences));
    setDraftInput("");
    setInterimText("");
    setShowPermissionDialog(false);
    setIsRequestingPermission(false);
    setIsSubmitting(false);
    setPlannerMemoryOverride(null);
  }, [bootstrapGreeting, plannerGreeting, storedPreferences]);

  const hydrateThread = useCallback((options: {
    sessionId: string;
    messages: CompanionChatThreadMessage[];
  }) => {
    sessionIdRef.current = options.sessionId;
    setMessages(options.messages.map((message) => ({
      id: message.id,
      role: message.role === "assistant" ? "companion" : "user",
      content: message.content,
      createdAt: message.createdAt,
      inputMode: message.inputMode,
    })));
    setProposals([]);
    setQuestions([]);
    setSessionState(createInitialSessionState(storedPreferences));
    setDraftInput("");
    setInterimText("");
    setShowPermissionDialog(false);
    setIsRequestingPermission(false);
    setIsSubmitting(false);
    setPlannerMemoryOverride(null);
  }, [storedPreferences]);

  return {
    greeting: plannerGreeting,
    sessionId: sessionIdRef.current,
    currentDate: todayIso,
    tonePack,
    setTonePack,
    horizon,
    setHorizon,
    messages,
    hasRealMessages: messages.length > 0,
    questions,
    proposals,
    pendingProposals,
    readyProposalCount,
    draftInput,
    setDraftInput,
    interimText,
    isSubmitting,
    isClassifying,
    isRecording,
    isAutoStopping,
    isVoiceSupported: isSupported,
    permissionStatus,
    showPermissionDialog,
    setShowPermissionDialog,
    isRequestingPermission,
    submitTypedMessage: () => submitMessage(draftInput, "text"),
    submitMessage,
    primeQuestCapture,
    resetThread,
    hydrateThread,
    toggleRecording,
    requestMicrophonePermission,
    confirmProposal: handleConfirmProposal,
    rejectProposal: handleRejectProposal,
    completeProposalEdit: handleCompleteProposalEdit,
    confirmAll: handleConfirmAll,
    sessionState,
    plannerContext,
    plannerMemory,
    statInterpretation,
    scheduleInsights,
    todayLabel: format(today, "EEEE, MMMM d"),
    isLoadingContext: todayTasksQuery.isLoading ||
      weekTasksQuery.isLoading ||
      monthTasksQuery.isLoading ||
      activeEventsQuery.isLoading ||
      contextEventsQuery.isLoading ||
      plannerMemoryQuery.isLoading ||
      contactsAttentionQuery.isLoading ||
      reflectionSignalsQuery.isLoading ||
      recentStatSignalsQuery.isLoading,
  };
}
