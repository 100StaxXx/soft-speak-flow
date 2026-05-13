import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { addDays, format } from "date-fns";
import { toast } from "@/components/ui/sonner";
import { useResilience } from "@/contexts/ResilienceContext";
import { applySubtaskTitlePlan } from "@/features/tasks/lib/subtaskWrites";
import type { Habit } from "@/features/habits/types";
import { supabase } from "@/integrations/supabase/client";
import { useIntentClassifier } from "@/hooks/useIntentClassifier";
import type { IntentClassification } from "@/hooks/useIntentClassifier";
import { useVoiceInput } from "@/hooks/useVoiceInput";
import { useTasksQuery } from "@/hooks/useTasksQuery";
import { useCalendarTasks } from "@/hooks/useCalendarTasks";
import { useInboxTasks } from "@/hooks/useInboxTasks";
import { useEpics } from "@/hooks/useEpics";
import { useTaskMutations } from "@/hooks/useTaskMutations";
import type { AddTaskParams } from "@/hooks/useTaskMutations";
import { useRitualUpdate } from "@/hooks/useRitualUpdate";
import { useUserAIContext } from "@/hooks/useUserAIContext";
import {
  attachActualDurationMinutes,
  attachRitualActualDurationMinutes,
} from "@/hooks/plannerActualDurations";
import { useAIInteractionTracker } from "@/hooks/useAIInteractionTracker";
import { useSchedulingLearner } from "@/hooks/useSchedulingLearner";
import { useAuth } from "@/hooks/useAuth";
import { useCompanion } from "@/hooks/useCompanion";
import { useCompanionCareSignals } from "@/hooks/useCompanionCareSignals";
import { parseNaturalLanguage } from "@/features/tasks/hooks/useNaturalLanguageParser";
import { normalizePlannerDurationBucket } from "@/shared/plannerDurationBuckets";
import { buildPlannerAISignals } from "@/utils/companionPlannerAiSignals";
import {
  sanitizePlannerContext,
  sanitizePlannerConversationHistory,
  sanitizePlannerParsedInput,
  sanitizePlannerSessionState,
  summarizePlannerRequestForDebug,
} from "@/utils/companionPlannerRequest";
import {
  DELETED_PLANNER_MEMORY_EVENT,
  loadDeletedPlannerEntities,
} from "@/utils/deletedPlannerMemory";
import {
  validateCompanionPlannerRequest,
} from "@/utils/companionPlannerRequestValidation";
import { buildCompanionPlannerScheduleInsights } from "@/utils/companionPlannerSchedule";
import {
  toUserFacingCompanionPlannerError,
} from "@/utils/companionPlannerErrors";
import { formatCurrentDateTimeWithOffset } from "@/utils/currentDateTime";
import { parseFunctionInvokeError } from "@/utils/supabaseFunctionErrors";
import type { Json } from "@/integrations/supabase/types";
import type { EpicRecord } from "@/hooks/epicsQuery";
import { stripMarkdown } from "@/lib/utils";
import type {
  CompanionChatSurface,
  CompanionChatThreadMessage,
} from "@/types/companionConversation";
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
import { getOnboardingScheduleArchetypeProfile } from "@/shared/onboardingScheduleArchetype";
import { computePlannerPriorityScores } from "@/shared/companionPlannerPriority";
import { buildCompanionStatInterpretation } from "@/shared/companionStatSignals";
import { isUpcomingScheduleDigestMessage } from "@/shared/schedulingIntent";
import { withTimeout } from "@/utils/asyncTimeout";
import { normalizeUuidLikeId } from "@/utils/offlineId";
import { loadLocalHabits } from "@/utils/plannerSync";
import type {
  CompanionPlannerContextStarterIntent,
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
const PLANNER_PREFLIGHT_TIMEOUT_MS = 3_000;
const DATE_KEY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const STANDALONE_RITUAL_EPIC_ID = "general";
const STANDALONE_RITUAL_EPIC_TITLE = "your goals";
const LOCAL_COMING_UP_DEFAULT_DURATION_MINUTES = 30;

const normalizeSelectedDateKey = (value: string | null | undefined) => {
  const trimmed = value?.trim() ?? "";
  return DATE_KEY_PATTERN.test(trimmed) ? trimmed : null;
};

const buildSelectedDateReferenceDateTime = (selectedDate: string) =>
  `${selectedDate}T12:00:00`;

type StoredPlannerPreferences = {
  tonePack?: PlannerTonePack;
  preferredTimeOfDay?: string | null;
  preferredTimeReason?: string | null;
  reminderPreference?: string | null;
};

type PlannerMemoryQueryResult = {
  preferredWorkBlocks: Json | null;
  onboardingData: Json | null;
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

type LocalComingUpStructuredOutput = NonNullable<
  NonNullable<CompanionPlannerResponse["structuredResponse"]>["comingUp"]
>;
type LocalComingUpScheduleItem =
  LocalComingUpStructuredOutput["remainingToday"][number] & {
    sortMinutes?: number | null;
  };
type LocalComingUpMissedItem =
  LocalComingUpStructuredOutput["missedItems"][number];

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
const EMPTY_CALENDAR_EVENTS: PlannerContextCalendarEvent[] = [];

const generateId = () => {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
};

const emitPlanDayActionSavedEvent = () => {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent("companion-plan-my-day-action-saved"));
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

const collectAllowedPlannerTitles = (
  context: CompanionPlannerRequest["plannerContext"],
): string[] =>
  Array.from(
    new Set([
      ...context.activeEpics.map((epic) => epic.title),
      ...context.rituals.map((ritual) => ritual.title),
      ...context.tasks.map((task) => task.title),
      ...context.inboxTasks.map((task) => task.title),
      ...(context.recentCompletedTasks ?? []).map((task) => task.title),
    ].filter((title): title is string => Boolean(title?.trim()))),
  );

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
  ) as Record<string, number>;
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
    scheduleArchetype: asString(
      profile.scheduleArchetype,
    ) as PlannerMemoryProfile["scheduleArchetype"],
    scheduleArchetypeLabel: asString(profile.scheduleArchetypeLabel),
    scheduleArchetypePlanningHint: asString(
      profile.scheduleArchetypePlanningHint,
    ),
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

const readPersistedPlannerProposals = (
  value: unknown,
): CompanionPlannerProposal[] =>
  Array.isArray(value)
    ? value.filter((entry): entry is CompanionPlannerProposal =>
      Boolean(entry) && typeof entry === "object" && !Array.isArray(entry)
    )
    : [];

const readPersistedPlannerQuestions = (
  value: unknown,
): CompanionPlannerQuestion[] =>
  Array.isArray(value)
    ? value.filter((entry): entry is CompanionPlannerQuestion =>
      Boolean(entry) && typeof entry === "object" && !Array.isArray(entry)
    )
    : [];

const readPersistedPlannerSessionState = (
  value: unknown,
): CompanionPlannerSessionState | null => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  return sanitizePlannerSessionState(value as CompanionPlannerSessionState);
};

const readPersistedQuestCaptureSelectedDate = (metadata: unknown) => {
  const record = asUnknownRecord(metadata);
  const value = record?.questCaptureSelectedDate;
  return typeof value === "string" ? normalizeSelectedDateKey(value) : null;
};

const readPersistedDayPlan = (
  metadata: unknown,
): NonNullable<CompanionPlannerResponse["dayPlan"]> | null => {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    return null;
  }
  const candidate = (metadata as Record<string, unknown>).dayPlan;
  if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) {
    return null;
  }
  const record = candidate as Record<string, unknown>;
  if (!Array.isArray(record.blocks) || typeof record.date !== "string") {
    return null;
  }
  if (record.status !== "draft" && record.status !== "committed") return null;
  return candidate as NonNullable<CompanionPlannerResponse["dayPlan"]>;
};

type PersistedPlannerProposalDecision = {
  proposalId: string;
  status: "confirmed" | "modified" | "rejected";
};

type PlannerEventType =
  | "plan_requested"
  | "briefing_requested"
  | "suggestion_generated"
  | "proposal_generated"
  | "proposal_confirmed"
  | "proposal_rejected"
  | "proposal_modified"
  | "clarification_requested"
  | "schedule_validation_failed";

const readPersistedPlannerProposalDecision = (
  value: unknown,
): PersistedPlannerProposalDecision | null => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const proposalDecision = value as Record<string, unknown>;
  const proposalId = typeof proposalDecision.proposalId === "string"
    ? proposalDecision.proposalId.trim()
    : "";
  const status = proposalDecision.status;

  if (
    proposalId.length === 0 ||
    (status !== "confirmed" && status !== "modified" && status !== "rejected")
  ) {
    return null;
  }

  return {
    proposalId,
    status,
  };
};

const findLatestPlannerSnapshotMetadata = (
  messages: CompanionChatThreadMessage[],
) => {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];
    if (message.role !== "assistant") continue;

    const metadata = asUnknownRecord(message.metadata);
    if (
      metadata &&
      (
        Array.isArray(metadata.proposals) ||
        Array.isArray(metadata.suggestedReminders) ||
        Array.isArray(metadata.followUpQuestions) ||
        (
          metadata.sessionState &&
          typeof metadata.sessionState === "object" &&
          !Array.isArray(metadata.sessionState)
        )
      )
    ) {
      return {
        index,
        metadata,
      };
    }
  }

  return null;
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
): CompanionPlannerContextStarterIntent => {
  const normalizedMessage = message.trim().toLowerCase();

  if (normalizedMessage === "quest?") {
    return "quest_capture";
  }
  if (isUpcomingScheduleDigestMessage(normalizedMessage)) {
    return "upcoming_start";
  }
  if (
    /\b(advance my campaign|move my campaign forward|progress my campaign|unstick my campaign|help me progress (?:this|my) campaign)\b/
      .test(normalizedMessage)
  ) {
    return "advance_campaign_start";
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
    /\b(prepare me for tomorrow|prep me for tomorrow|help me prepare for tomorrow|set me up for tomorrow|tomorrow prep)\b/
      .test(
        normalizedMessage,
      )
  ) {
    return "briefing_followup";
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
    /\b(break this goal down|break a big goal|turn this into steps)\b/.test(
      normalizedMessage,
    )
  ) {
    return "goal_breakdown";
  }

  return "general";
};

const normalizeStarterIntentForPlanner = (
  starterIntent: CompanionPlannerStarterIntent | null | undefined,
): CompanionPlannerContextStarterIntent | null => {
  if (!starterIntent || starterIntent === "thread_history") {
    return null;
  }

  return starterIntent;
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
        (firstHabit as Record<string, unknown>).preferred_time ??
          (firstHabit as Record<string, unknown>).preferredTime;
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
  const optimizerSource = typeof payload.optimizerSource === "string"
    ? payload.optimizerSource
    : typeof payload.source === "string"
    ? payload.source
    : null;
  const optimizerMode = typeof payload.optimizerMode === "string"
    ? payload.optimizerMode
    : null;
  const usedFallback = typeof payload.usedFallback === "boolean"
    ? payload.usedFallback
    : null;

  return {
    ...(optimizerSource ? { optimizerSource } : {}),
    ...(optimizerMode ? { optimizerMode } : {}),
    ...(typeof usedFallback === "boolean" ? { usedFallback } : {}),
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

const extractPlannerEventEntityIds = (
  proposal: CompanionPlannerProposal,
): {
  taskId: string | null;
  epicId: string | null;
} => {
  const payload = asUnknownRecord(proposal.payload) ?? {};
  const updates = asUnknownRecord(payload.updates) ?? {};

  return {
    taskId: typeof payload.taskId === "string"
      ? payload.taskId
      : typeof updates.task_id === "string"
      ? updates.task_id
      : null,
    epicId: typeof payload.epicId === "string"
      ? payload.epicId
      : typeof payload.epic_id === "string"
      ? payload.epic_id
      : null,
  };
};

const summarizeProposalGenerationTelemetry = (
  proposals: CompanionPlannerProposal[],
  horizon: PlannerHorizon,
): Record<string, unknown> => {
  const optimizerTelemetry = proposals
    .map((proposal) => extractOptimizerTelemetry(proposal))
    .filter((telemetry) => Object.keys(telemetry).length > 0);

  if (optimizerTelemetry.length === 0) {
    return {};
  }

  const optimizerSources = [
    ...new Set(
      optimizerTelemetry
        .map((telemetry) =>
          typeof telemetry.optimizerSource === "string"
            ? telemetry.optimizerSource
            : null
        )
        .filter((source): source is string => Boolean(source)),
    ),
  ];
  const optimizerModes = [
    ...new Set(
      optimizerTelemetry
        .map((telemetry) =>
          typeof telemetry.optimizerMode === "string"
            ? telemetry.optimizerMode
            : null
        )
        .filter((mode): mode is string => Boolean(mode)),
    ),
  ];
  const usedFallback = optimizerTelemetry.some((telemetry) =>
    telemetry.usedFallback === true
  );
  const fallbackProposalCount =
    optimizerTelemetry.filter((telemetry) => telemetry.fallbackToInbox === true)
      .length;

  return {
    optimizerProposalCount: optimizerTelemetry.length,
    optimizerSources,
    optimizerModes: optimizerModes.length > 0 ? optimizerModes : [
      horizon === "week" ? "week" : "day",
    ],
    usedFallback,
    fallbackProposalCount,
  };
};

const normalizeTaskFlexibility = (
  value: string | null | undefined,
): PlannerContextTask["flexibility"] => {
  if (value === "fixed" || value === "preferred" || value === "flexible") {
    return value;
  }

  return null;
};

const normalizeTaskEnergyType = (
  value: string | null | undefined,
): PlannerContextTask["energyType"] => {
  if (
    value === "deep" ||
    value === "admin" ||
    value === "physical" ||
    value === "errand" ||
    value === "social" ||
    value === "creative" ||
    value === "recovery"
  ) {
    return value;
  }

  return null;
};

const serializeTaskContext = (task: {
  id: string;
  task_text: string;
  task_date: string | null;
  category?: string | null;
  scheduled_time: string | null;
  estimated_duration?: number | null;
  actual_duration_minutes?: number | null;
  actual_time_spent?: number | null;
  notes?: string | null;
  subtasks?: Array<{ title: string | null } | null> | null;
  difficulty?: string | null;
  flexibility?: string | null;
  energy_type?: string | null;
  must_calendar_block?: boolean | null;
  deadline_at?: string | null;
  recurrence_pattern: string | null;
  recurrence_end_date?: string | null;
  completed?: boolean | null;
  completed_at?: string | null;
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
  actualDurationMinutes: task.actual_duration_minutes ?? null,
  actualTimeSpent: task.actual_time_spent ?? null,
  notes: task.notes ?? null,
  subtaskTitles: (task.subtasks ?? [])
    .map((subtask) => subtask?.title?.trim() ?? "")
    .filter((title) => title.length > 0),
  difficulty: task.difficulty ?? null,
  flexibility: normalizeTaskFlexibility(task.flexibility),
  energyType: normalizeTaskEnergyType(task.energy_type),
  mustCalendarBlock: task.must_calendar_block ?? null,
  deadlineAt: task.deadline_at ?? null,
  recurrencePattern: task.recurrence_pattern,
  recurrenceEndDate: task.recurrence_end_date ?? null,
  completed: task.completed ?? null,
  completedAt: task.completed_at ?? null,
  priority: task.priority ?? null,
  source: task.source ?? null,
  habitSourceId: task.habit_source_id ?? null,
  epicId: task.epic_id ?? null,
  epicTitle: task.epic_title ?? null,
  contactId: task.contact_id ?? null,
});

const scopeTaskToActiveCampaigns = (
  task: PlannerContextTask,
  activeEpicIds: ReadonlySet<string>,
  activeRitualIds: ReadonlySet<string>,
  activeHabitIds: ReadonlySet<string> | null = null,
): PlannerContextTask | null => {
  if (
    task.habitSourceId &&
    activeHabitIds &&
    !activeHabitIds.has(task.habitSourceId)
  ) {
    return null;
  }

  if (!task.epicId) {
    return task;
  }

  if (activeEpicIds.has(task.epicId)) {
    if (task.habitSourceId && !activeRitualIds.has(task.habitSourceId)) {
      return null;
    }
    return task;
  }

  if (task.habitSourceId) {
    return null;
  }

  return {
    ...task,
    epicId: null,
    epicTitle: null,
  };
};

const scopeTasksToActiveCampaigns = (
  tasks: PlannerContextTask[],
  activeEpicIds: ReadonlySet<string>,
  activeRitualIds: ReadonlySet<string>,
  activeHabitIds: ReadonlySet<string> | null = null,
): PlannerContextTask[] =>
  tasks.reduce<PlannerContextTask[]>((scopedTasks, task) => {
    const scopedTask = scopeTaskToActiveCampaigns(
      task,
      activeEpicIds,
      activeRitualIds,
      activeHabitIds,
    );
    if (scopedTask) {
      scopedTasks.push(scopedTask);
    }
    return scopedTasks;
  }, []);

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
        customDays: link.habits?.custom_days ?? null,
        customMonthDays: link.habits?.custom_month_days ?? null,
        estimatedMinutes: link.habits?.estimated_minutes ?? null,
        currentStreak: null,
      }))
  );

type LocalPlannerHabit = Habit & {
  estimated_minutes?: number | null;
  preferred_time?: string | null;
};

const collectCampaignRitualIds = (epics: EpicRecord[]): Set<string> =>
  new Set(
    epics.flatMap((epic) =>
      (epic.epic_habits ?? [])
        .map((link) => link.habits?.id ?? link.habit_id)
        .filter((habitId): habitId is string => Boolean(habitId))
    ),
  );

const mapStandaloneHabitsToRitualContext = (
  habits: LocalPlannerHabit[],
  campaignRitualIds: ReadonlySet<string>,
): PlannerContextRitual[] =>
  habits
    .filter((habit) => habit.is_active !== false)
    .filter((habit) => !campaignRitualIds.has(habit.id))
    .map((habit) => ({
      id: habit.id,
      epicId: STANDALONE_RITUAL_EPIC_ID,
      epicTitle: STANDALONE_RITUAL_EPIC_TITLE,
      title: habit.title ?? "Untitled ritual",
      frequency: habit.frequency ?? null,
      preferredTime: habit.preferred_time ?? null,
      customDays: habit.custom_days ?? null,
      customMonthDays: habit.custom_month_days ?? null,
      estimatedMinutes: habit.estimated_minutes ?? null,
      currentStreak: habit.current_streak ?? null,
    }));

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

  const rawType = typeof classification.type === "string"
    ? classification.type.trim().toLowerCase()
    : null;
  const normalizedType = rawType === "brain_dump" ||
      rawType === "brain dump" || rawType === "braindump"
    ? "brain-dump"
    : rawType === "quest" || rawType === "epic" || rawType === "habit" ||
        rawType === "brain-dump"
    ? rawType
    : null;
  const confidence = typeof classification.confidence === "number" &&
      Number.isFinite(classification.confidence)
    ? classification.confidence
    : null;
  const reasoning = typeof classification.reasoning === "string"
    ? classification.reasoning.trim()
    : "";

  if (!normalizedType || confidence === null || reasoning.length === 0) {
    return null;
  }

  const normalized: NonNullable<CompanionPlannerRequest["classificationHint"]> =
    {
      type: normalizedType,
      confidence,
      reasoning,
    };

  if (typeof classification.suggestedDeadline === "string") {
    normalized.suggestedDeadline = classification.suggestedDeadline;
  }

  if (typeof classification.suggestedDuration === "number") {
    normalized.suggestedDuration = classification.suggestedDuration;
  }

  const normalizedActivityDuration = normalizePlannerDurationBucket(
    classification.suggestedActivityDurationMinutes ??
      (normalizedType === "epic" ? null : classification.suggestedDuration),
  );
  if (normalizedActivityDuration !== null) {
    normalized.suggestedActivityDurationMinutes = normalizedActivityDuration;
  }

  if (
    classification.timelineAnalysis &&
    typeof classification.timelineAnalysis === "object" &&
    typeof classification.timelineAnalysis.statedDays === "number" &&
    Number.isFinite(classification.timelineAnalysis.statedDays) &&
    typeof classification.timelineAnalysis.typicalDays === "number" &&
    Number.isFinite(classification.timelineAnalysis.typicalDays) &&
    (
      classification.timelineAnalysis.feasibility === "realistic" ||
      classification.timelineAnalysis.feasibility === "aggressive" ||
      classification.timelineAnalysis.feasibility === "very_aggressive"
    )
  ) {
    normalized.timelineAnalysis = {
      statedDays: classification.timelineAnalysis.statedDays,
      typicalDays: classification.timelineAnalysis.typicalDays,
      feasibility: classification.timelineAnalysis.feasibility,
      adjustmentFactors: Array.isArray(
          classification.timelineAnalysis.adjustmentFactors,
        )
        ? classification.timelineAnalysis.adjustmentFactors.filter((factor) =>
          typeof factor === "string"
        )
        : [],
    };
  }

  return normalized;
};

const parseLocalClockMinutes = (value: string | null | undefined): number | null => {
  if (!value) return null;
  const match = value.match(/^(\d{1,2}):(\d{2})/);
  if (!match) return null;

  const hour = Number.parseInt(match[1] ?? "", 10);
  const minute = Number.parseInt(match[2] ?? "", 10);
  if (
    !Number.isFinite(hour) ||
    !Number.isFinite(minute) ||
    hour < 0 ||
    hour > 23 ||
    minute < 0 ||
    minute > 59
  ) {
    return null;
  }

  return hour * 60 + minute;
};

const formatLocalClockMinutes = (minutes: number): string => {
  const hour = Math.floor(minutes / 60);
  const minute = minutes % 60;
  const period = hour >= 12 ? "pm" : "am";
  const hour12 = hour % 12 || 12;
  return `${hour12}:${String(minute).padStart(2, "0")} ${period}`;
};

const formatLocalClock = (value: string | null | undefined): string | null => {
  const minutes = parseLocalClockMinutes(value);
  return minutes === null ? null : formatLocalClockMinutes(minutes);
};

const formatLocalDuration = (minutes: number | null | undefined): string | null => {
  if (!minutes || minutes <= 0) return null;
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return remainder > 0 ? `${hours}h ${remainder}m` : `${hours}h`;
};

const formatDateKey = (date: Date): string | null =>
  Number.isNaN(date.getTime()) ? null : format(date, "yyyy-MM-dd");

const addDaysToDateKey = (dateKey: string, days: number): string => {
  const date = new Date(`${dateKey}T00:00:00`);
  if (Number.isNaN(date.getTime())) return dateKey;
  return format(addDays(date, days), "yyyy-MM-dd");
};

const getRequestCurrentDateKey = (request: CompanionPlannerRequest): string => {
  const currentDate = new Date(request.currentDateTime);
  return formatDateKey(currentDate) ?? request.currentDate;
};

const getRequestCurrentMinutes = (request: CompanionPlannerRequest): number | null => {
  const currentDate = new Date(request.currentDateTime);
  if (Number.isNaN(currentDate.getTime())) return null;
  return currentDate.getHours() * 60 + currentDate.getMinutes();
};

const getLocalTaskDuration = (task: PlannerContextTask): number =>
  Number.isFinite(task.estimatedDuration) && (task.estimatedDuration ?? 0) > 0
    ? Number(task.estimatedDuration)
    : LOCAL_COMING_UP_DEFAULT_DURATION_MINUTES;

const getLocalRitualDuration = (ritual: PlannerContextRitual): number =>
  ritual.actualDurationMinutes ??
  ritual.estimatedMinutes ??
  LOCAL_COMING_UP_DEFAULT_DURATION_MINUTES;

const buildLocalTaskDateTime = (
  taskDate: string | null | undefined,
  clock: string | null | undefined,
): string | null => {
  const minutes = parseLocalClockMinutes(clock);
  if (!taskDate || minutes === null) return null;
  const hour = Math.floor(minutes / 60);
  const minute = minutes % 60;
  return `${taskDate}T${String(hour).padStart(2, "0")}:${
    String(minute).padStart(2, "0")
  }:00`;
};

const addMinutesToLocalDateTime = (
  startDateTime: string | null,
  minutes: number,
): string | null => {
  if (!startDateTime) return null;
  const date = new Date(startDateTime);
  if (Number.isNaN(date.getTime())) return null;
  date.setMinutes(date.getMinutes() + minutes);
  return format(date, "yyyy-MM-dd'T'HH:mm:ss");
};

const buildLocalScheduleLabel = (
  clock: string | null | undefined,
  durationMinutes: number | null | undefined,
): string => {
  const parts = [
    formatLocalClock(clock) ?? "Anytime",
    formatLocalDuration(durationMinutes),
  ].filter((part): part is string => Boolean(part));
  return parts.join(", ");
};

const collectLocalPlannerTasks = (
  request: CompanionPlannerRequest,
): PlannerContextTask[] => [
  ...request.plannerContext.tasks,
  ...request.plannerContext.inboxTasks,
];

const eventOverlapsLocalDate = (
  event: PlannerContextCalendarEvent,
  dateKey: string,
): boolean => {
  const dayStart = new Date(`${dateKey}T00:00:00`);
  const dayEnd = new Date(`${addDaysToDateKey(dateKey, 1)}T00:00:00`);
  const eventStart = new Date(event.start);
  const eventEnd = new Date(event.end);
  if (
    Number.isNaN(dayStart.getTime()) ||
    Number.isNaN(dayEnd.getTime()) ||
    Number.isNaN(eventStart.getTime()) ||
    Number.isNaN(eventEnd.getTime())
  ) {
    return false;
  }

  return eventEnd > dayStart && eventStart < dayEnd;
};

const getLocalEventSortMinutes = (
  event: PlannerContextCalendarEvent,
  dateKey: string,
): number | null => {
  if (event.isAllDay) return 0;
  const dayStart = new Date(`${dateKey}T00:00:00`);
  const eventStart = new Date(event.start);
  if (Number.isNaN(dayStart.getTime()) || Number.isNaN(eventStart.getTime())) {
    return null;
  }
  const clampedStart = eventStart < dayStart ? dayStart : eventStart;
  return clampedStart.getHours() * 60 + clampedStart.getMinutes();
};

const formatLocalEventLabel = (event: PlannerContextCalendarEvent): string => {
  if (event.isAllDay) return "All day";
  const start = new Date(event.start);
  const end = new Date(event.end);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return "Calendar event";
  }
  return `${format(start, "h:mm a").toLowerCase()}-${format(end, "h:mm a").toLowerCase()}`;
};

const normalizeLocalRitualNumberList = (
  values: number[] | null | undefined,
): number[] =>
  values?.length
    ? [...new Set(values.filter((value) => Number.isFinite(value)))]
      .sort((left, right) => left - right)
    : [];

const getPlannerWeekdayIndex = (date: Date): number => {
  const jsWeekday = date.getDay();
  return jsWeekday === 0 ? 6 : jsWeekday - 1;
};

const isLocalRitualScheduledForDate = (
  ritual: PlannerContextRitual,
  dateKey: string,
): boolean => {
  const date = new Date(`${dateKey}T00:00:00`);
  if (Number.isNaN(date.getTime())) return false;

  const frequency = ritual.frequency?.toLowerCase();
  const weekdayIndex = getPlannerWeekdayIndex(date);
  const customDays = normalizeLocalRitualNumberList(ritual.customDays);
  const customMonthDays = normalizeLocalRitualNumberList(ritual.customMonthDays);
  const dayOfMonth = date.getDate();

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
      return (customDays.length > 0 ? customDays : [0, 2, 4])
        .includes(weekdayIndex);
    case "monthly":
      return (customMonthDays.length > 0 ? customMonthDays : [1])
        .includes(dayOfMonth);
    case "custom":
      return ritual.customPeriod === "month"
        ? (customMonthDays.length > 0 ? customMonthDays : [1])
          .includes(dayOfMonth)
        : customDays.includes(weekdayIndex);
    default:
      return true;
  }
};

const hasLocalMaterializedRitualTask = (
  request: CompanionPlannerRequest,
  ritual: PlannerContextRitual,
  dateKey: string,
): boolean =>
  collectLocalPlannerTasks(request).some((task) =>
    task.taskDate === dateKey && task.habitSourceId === ritual.id
  );

const isLocalRitualInActiveScope = (
  request: CompanionPlannerRequest,
  ritual: PlannerContextRitual,
): boolean => {
  const activeHabitIds = request.plannerContext.activeHabitIds
    ? new Set(request.plannerContext.activeHabitIds)
    : null;
  if (activeHabitIds && !activeHabitIds.has(ritual.id)) return false;
  if (ritual.epicId === STANDALONE_RITUAL_EPIC_ID) return true;

  const activeEpicIds = new Set(
    request.plannerContext.activeEpics.map((epic) => epic.id),
  );
  return activeEpicIds.has(ritual.epicId);
};

const collectLocalComingUpScheduleItemsForDate = (
  request: CompanionPlannerRequest,
  dateKey: string,
  remainingOnly: boolean,
): LocalComingUpScheduleItem[] => {
  const currentDateKey = getRequestCurrentDateKey(request);
  const currentMinutes = getRequestCurrentMinutes(request);
  const now = new Date(request.currentDateTime);

  const taskItems = collectLocalPlannerTasks(request)
    .filter((task) => task.completed !== true && task.taskDate === dateKey)
    .filter((task) => {
      if (!remainingOnly || dateKey !== currentDateKey) return true;
      const scheduledMinutes = parseLocalClockMinutes(task.scheduledTime);
      if (scheduledMinutes === null || currentMinutes === null) return true;
      return scheduledMinutes >= currentMinutes;
    })
    .map((task): LocalComingUpScheduleItem => {
      const startsAt = buildLocalTaskDateTime(task.taskDate, task.scheduledTime);
      return {
        id: task.id,
        title: task.title,
        label: buildLocalScheduleLabel(task.scheduledTime, task.estimatedDuration),
        startsAt,
        endsAt: addMinutesToLocalDateTime(startsAt, getLocalTaskDuration(task)),
        isAllDay: false,
        source: "task",
        sortMinutes: parseLocalClockMinutes(task.scheduledTime),
      };
    });

  const ritualItems = request.plannerContext.rituals
    .filter((ritual) => isLocalRitualInActiveScope(request, ritual))
    .filter((ritual) => isLocalRitualScheduledForDate(ritual, dateKey))
    .filter((ritual) => !hasLocalMaterializedRitualTask(request, ritual, dateKey))
    .filter((ritual) => {
      if (!remainingOnly || dateKey !== currentDateKey) return true;
      const scheduledMinutes = parseLocalClockMinutes(ritual.preferredTime);
      if (scheduledMinutes === null || currentMinutes === null) return true;
      return scheduledMinutes >= currentMinutes;
    })
    .map((ritual): LocalComingUpScheduleItem => {
      const startsAt = buildLocalTaskDateTime(dateKey, ritual.preferredTime);
      const duration = getLocalRitualDuration(ritual);
      return {
        id: `ritual:${ritual.id}:${dateKey}`,
        title: ritual.title,
        label: buildLocalScheduleLabel(ritual.preferredTime, duration),
        startsAt,
        endsAt: addMinutesToLocalDateTime(startsAt, duration),
        isAllDay: false,
        source: "ritual",
        sortMinutes: parseLocalClockMinutes(ritual.preferredTime),
      };
    });

  const eventItems = request.plannerContext.calendarEvents
    .filter((event) => eventOverlapsLocalDate(event, dateKey))
    .filter((event) => {
      if (!remainingOnly || dateKey !== currentDateKey) return true;
      const end = new Date(event.end);
      return Number.isNaN(end.getTime()) || end > now;
    })
    .map((event): LocalComingUpScheduleItem => ({
      id: event.id,
      title: event.title,
      label: formatLocalEventLabel(event),
      startsAt: event.start,
      endsAt: event.end,
      isAllDay: event.isAllDay,
      source: "calendar",
      sortMinutes: getLocalEventSortMinutes(event, dateKey),
    }));

  return [...taskItems, ...ritualItems, ...eventItems]
    .sort((left, right) =>
      (left.sortMinutes ?? 9999) - (right.sortMinutes ?? 9999)
    );
};

const collectLocalComingUpMissedItems = (
  request: CompanionPlannerRequest,
): LocalComingUpMissedItem[] => {
  const currentMinutes = getRequestCurrentMinutes(request);
  if (currentMinutes === null) return [];

  return collectLocalPlannerTasks(request)
    .filter((task) =>
      task.completed !== true &&
      task.taskDate === request.currentDate &&
      Boolean(task.scheduledTime)
    )
    .filter((task) => {
      const scheduledMinutes = parseLocalClockMinutes(task.scheduledTime);
      return scheduledMinutes !== null && scheduledMinutes < currentMinutes;
    })
    .sort((left, right) =>
      (parseLocalClockMinutes(left.scheduledTime) ?? 9999) -
      (parseLocalClockMinutes(right.scheduledTime) ?? 9999)
    )
    .map((task) => ({
      id: task.id,
      title: task.title,
      label: buildLocalScheduleLabel(task.scheduledTime, task.estimatedDuration),
      source: "task",
    }));
};

const stripLocalSortMinutes = (
  items: LocalComingUpScheduleItem[],
): LocalComingUpStructuredOutput["remainingToday"] =>
  items.map(({ sortMinutes: _sortMinutes, ...item }) => item);

const formatLocalDigestItem = (item: LocalComingUpScheduleItem): string =>
  `${item.title} (${item.label})`;

const buildLocalDigestLine = (
  request: CompanionPlannerRequest,
  dateKey: string,
  label: string,
  remainingOnly = false,
): string => {
  const items = collectLocalComingUpScheduleItemsForDate(
    request,
    dateKey,
    remainingOnly,
  );
  if (items.length === 0) return `${label}: nothing scheduled.`;

  const visibleItems = items.slice(0, 2).map(formatLocalDigestItem).join("; ");
  const overflowCount = items.length - 2;
  const overflowText = overflowCount > 0 ? `; +${overflowCount} more` : "";
  return `${label}: ${visibleItems}${overflowText}.`;
};

const getLocalComingUpTomorrowSummary = (
  tomorrowItems: LocalComingUpScheduleItem[],
): LocalComingUpStructuredOutput["tomorrowSummary"] => {
  if (tomorrowItems.length === 0) return "open";
  return tomorrowItems.length <= 2 ? "light" : "busy";
};

const buildLocalComingUpFallbackResponse = (
  request: CompanionPlannerRequest,
): CompanionPlannerResponse => {
  const tomorrow = addDaysToDateKey(request.currentDate, 1);
  const remainingToday = collectLocalComingUpScheduleItemsForDate(
    request,
    request.currentDate,
    true,
  );
  const tomorrowSchedule = collectLocalComingUpScheduleItemsForDate(
    request,
    tomorrow,
    false,
  );
  const missedItems = collectLocalComingUpMissedItems(request);
  const reply = [
    buildLocalDigestLine(request, request.currentDate, "Today", true),
    buildLocalDigestLine(request, tomorrow, "Tomorrow"),
  ].join("\n");
  const plannerContract: NonNullable<CompanionPlannerResponse["plannerContract"]> = {
    mode: "schedule_read",
    writePolicy: "read_only",
    decisionSummary: reply.split("\n")[0] ?? reply,
    reasonCodes: [
      ...(remainingToday[0] ? ["calendar_constraint" as const] : []),
      ...(missedItems.length > 0 ? ["overdue" as const] : []),
      ...(!remainingToday[0] && missedItems.length === 0
        ? ["user_preference" as const]
        : []),
    ],
    decisionPoint: {
      label: "No changes needed right now.",
      action: "none",
    },
    clarifyingQuestion: null,
  };

  return {
    mode: "schedule_read",
    reply,
    plannerContract,
    followUpQuestions: [],
    proposals: [],
    suggestedReminders: [],
    structuredResponse: {
      plannerContract,
      intent: {
        intentType: "conversation",
        timeHorizon: "today",
        isRecurring: false,
        shouldCreateQuest: false,
        shouldPromptCampaign: false,
      },
      planDay: null,
      weeklyPlan: null,
      priorityOverview: null,
      reflectionBridge: null,
      comingUp: {
        message: reply,
        nextEvent: stripLocalSortMinutes(remainingToday)[0] ?? null,
        nextBestAction: null,
        remainingToday: stripLocalSortMinutes(remainingToday),
        tomorrowSchedule: stripLocalSortMinutes(tomorrowSchedule),
        tomorrowSummary: getLocalComingUpTomorrowSummary(tomorrowSchedule),
        missedItems,
      },
      campaignMomentum: null,
    },
    dayPlan: null,
    memoryUpdates: {},
    sessionState: {
      ...request.sessionState,
      draft: {},
      openQuestionIds: [],
      pendingStarterIntent: null,
      lastClassification: request.classificationHint?.type ??
        request.sessionState.lastClassification ??
        null,
    },
  };
};

const shouldUseLocalComingUpFallback = (
  request: CompanionPlannerRequest | null,
): request is CompanionPlannerRequest =>
  request?.plannerContext.starterIntent === "upcoming_start" ||
  isUpcomingScheduleDigestMessage(request?.message ?? "");

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
  enabled?: boolean;
  bootstrapGreeting?: boolean;
  threadPersistence?: {
    enabled?: boolean;
    surface?: CompanionChatSurface;
  };
}

export function useCompanionPlanner({
  enabled = true,
  bootstrapGreeting = true,
  threadPersistence,
}: UseCompanionPlannerOptions = {}) {
  const { user } = useAuth();
  const { companion } = useCompanion();
  const { care } = useCompanionCareSignals({ enabled });
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
  const todayTasksQuery = useTasksQuery(today, { enabled });
  const weekTasksQuery = useCalendarTasks(today, "week", { enabled });
  const monthTasksQuery = useCalendarTasks(today, "month", { enabled });
  const { inboxTasks } = useInboxTasks({ enabled });
  const habitsQuery = useQuery({
    queryKey: ["habits", user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      return loadLocalHabits(user.id);
    },
    enabled: enabled && !!user?.id,
    placeholderData: (previousData) => previousData,
    refetchOnWindowFocus: false,
  });
  const { epics, activeEpics, createEpic, renameEpic, createCampaignRitual } =
    useEpics({ enabled });
  const { addTask, updateTask } = useTaskMutations(todayIso);
  const { saveRitual } = useRitualUpdate();
  const { enrichedContext } = useUserAIContext({ enabled });
  const { trackInteraction } = useAIInteractionTracker();
  const { trackTaskCreation, trackScheduleModification } =
    useSchedulingLearner();
  const {
    queueAction,
    receipts: queuedActionReceipts = [],
    shouldQueueWrites,
    retryNow,
  } = useResilience();
  const tonePack: PlannerTonePack = threadPersistence?.surface === "journeys"
    ? "soft"
    : DEFAULT_TONE_PACK;
  const setTonePack = useCallback((_nextTonePack: PlannerTonePack) => {
    return;
  }, []);
  const sessionIdRef = useRef<string>(generateCompanionThreadSessionId());
  const [messages, setMessages] = useState<CompanionPlannerMessage[]>([]);
  const [structuredResponse, setStructuredResponse] = useState<
    CompanionPlannerResponse["structuredResponse"]
  >(null);
  const [dayPlan, setDayPlan] = useState<
    NonNullable<CompanionPlannerResponse["dayPlan"]> | null
  >(null);
  const [committingDayPlan, setCommittingDayPlan] = useState(false);
  const [committedDayPlanId, setCommittedDayPlanId] = useState<string | null>(
    null,
  );
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
  const pendingQuestCaptureSelectedDateRef = useRef<string | null>(null);

  const plannerMemoryQuery = useQuery({
    queryKey: ["companion-planner-memory", user?.id],
    enabled: enabled && !!user?.id,
    staleTime: 5 * 60 * 1000,
    queryFn: async (): Promise<PlannerMemoryQueryResult | null> => {
      if (!user?.id) return null;

      const [
        { data: preferenceRow, error: preferenceError },
        { data: learningRow, error: learningError },
        { data: profileRow, error: profileError },
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
        supabase
          .from("profiles")
          .select("onboarding_data")
          .eq("id", user.id)
          .maybeSingle(),
      ]);

      if (preferenceError) throw preferenceError;
      if (learningError) throw learningError;
      if (profileError) throw profileError;

      return {
        preferredWorkBlocks: preferenceRow?.preferred_work_blocks ?? null,
        onboardingData: profileRow?.onboarding_data ?? null,
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

  const deletedPlannerEntitiesQuery = useQuery({
    queryKey: ["deleted-planner-entities", user?.id],
    enabled: enabled && !!user?.id,
    staleTime: 30 * 1000,
    queryFn: async () => {
      if (!user?.id) return [];
      return loadDeletedPlannerEntities(user.id);
    },
  });

  useEffect(() => {
    if (!user?.id || typeof window === "undefined") return;

    const handleDeletedPlannerMemoryUpdate = (event: Event) => {
      const detail = (event as CustomEvent<{ userId?: string }>).detail;
      if (detail?.userId && detail.userId !== user.id) return;
      queryClient.invalidateQueries({
        queryKey: ["deleted-planner-entities", user.id],
      });
    };

    window.addEventListener(
      DELETED_PLANNER_MEMORY_EVENT,
      handleDeletedPlannerMemoryUpdate,
    );
    return () => {
      window.removeEventListener(
        DELETED_PLANNER_MEMORY_EVENT,
        handleDeletedPlannerMemoryUpdate,
      );
    };
  }, [queryClient, user?.id]);

  const contactsAttentionQuery = useQuery({
    queryKey: [
      "companion-planner-contacts",
      user?.id,
      plannerMemoryQuery.data?.coldContactThresholdDays ?? 14,
    ],
    enabled: enabled && !!user?.id,
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
    enabled: enabled && !!user?.id,
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
    enabled: enabled && !!user?.id,
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
            "id, task_text, task_date, category, difficulty, priority, flexibility, energy_type, must_calendar_block, deadline_at, completed, scheduled_time, completed_at, actual_time_spent, contact_id, habit_source_id",
          )
          .eq("user_id", user.id)
          .is("excluded_from_planner_at", null)
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

  const recentCompletedTasksQuery = useQuery({
    queryKey: ["companion-planner-recent-completed-tasks", user?.id, todayIso],
    enabled: enabled && !!user?.id,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      if (!user?.id) return [];

      const startDate = format(addDays(today, -13), "yyyy-MM-dd");
      const { data, error } = await supabase
        .from("daily_tasks")
        .select(
          "id, task_text, task_date, category, difficulty, priority, flexibility, energy_type, must_calendar_block, deadline_at, completed, scheduled_time, completed_at, estimated_duration, actual_time_spent, notes, recurrence_pattern, recurrence_end_date, source, contact_id, habit_source_id, epic_id",
        )
        .eq("user_id", user.id)
        .is("excluded_from_planner_at", null)
        .eq("completed", true)
        .not("completed_at", "is", null)
        .gte("completed_at", `${startDate}T00:00:00.000Z`)
        .lte("completed_at", `${todayIso}T23:59:59.999Z`);

      if (error) throw error;
      return attachActualDurationMinutes(user.id, data ?? []);
    },
  });

  const activeEpicIds = useMemo(
    () => new Set(activeEpics.map((epic) => epic.id)),
    [activeEpics],
  );
  const pendingPlannerCreateIds = useMemo(() => {
    const activeQueueStatuses = new Set(["queued", "syncing", "failed"]);
    const taskIds: string[] = [];
    const epicIds: string[] = [];
    const habitIds: string[] = [];

    queuedActionReceipts.forEach((receipt) => {
      if (!receipt.entityId || !activeQueueStatuses.has(receipt.status)) {
        return;
      }
      if (receipt.actionKind === "TASK_CREATE") {
        taskIds.push(receipt.entityId);
      } else if (receipt.actionKind === "EPIC_CREATE") {
        epicIds.push(receipt.entityId);
      } else if (receipt.actionKind === "HABIT_CREATE") {
        habitIds.push(receipt.entityId);
      } else if (receipt.actionKind === "EPIC_RITUAL_CREATE") {
        const habitId = typeof receipt.payload?.habit === "object" &&
            receipt.payload.habit !== null &&
            !Array.isArray(receipt.payload.habit) &&
            typeof (receipt.payload.habit as { id?: unknown }).id === "string"
          ? (receipt.payload.habit as { id: string }).id
          : null;
        if (habitId) {
          habitIds.push(habitId);
        }
      }
    });

    return {
      taskIds: [...new Set(taskIds)],
      epicIds: [...new Set(epicIds)],
      habitIds: [...new Set(habitIds)],
    };
  }, [queuedActionReceipts]);
  const activeHabitIdsList = useMemo(
    () => [
      ...new Set([
        ...(habitsQuery.data ?? [])
          .filter((habit) => habit.is_active !== false)
          .map((habit) => habit.id),
        ...pendingPlannerCreateIds.habitIds,
      ]),
    ],
    [habitsQuery.data, pendingPlannerCreateIds.habitIds],
  );
  const activeHabitIds = useMemo(
    () => new Set(activeHabitIdsList),
    [activeHabitIdsList],
  );
  const activeHabitIdScope =
    habitsQuery.data || pendingPlannerCreateIds.habitIds.length > 0
      ? activeHabitIds
      : null;

  const baseRituals = useMemo(
    () => {
      const campaignRituals = mapRitualsToContext(activeEpics);
      const standaloneRituals = habitsQuery.data
        ? mapStandaloneHabitsToRitualContext(
          habitsQuery.data as LocalPlannerHabit[],
          collectCampaignRitualIds(epics),
        )
        : [];
      const rituals = [...campaignRituals, ...standaloneRituals];
      if (!activeHabitIdScope) return rituals;
      return rituals.filter((ritual) => activeHabitIdScope.has(ritual.id));
    },
    [activeEpics, activeHabitIdScope, epics, habitsQuery.data],
  );
  const activeRitualIds = useMemo(
    () => new Set(baseRituals.map((ritual) => ritual.id)),
    [baseRituals],
  );
  const durationHistoryStartIso = `${
    format(addDays(today, -59), "yyyy-MM-dd")
  }T00:00:00.000Z`;

  const ritualsQuery = useQuery({
    queryKey: [
      "companion-planner-ritual-actual-durations",
      user?.id,
      todayIso,
      baseRituals.map((ritual) => ritual.id),
    ],
    enabled: enabled && !!user?.id && baseRituals.length > 0,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      if (!user?.id) return [];
      return attachRitualActualDurationMinutes(
        user.id,
        baseRituals,
        durationHistoryStartIso,
      );
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

  const activePlannerTasks = useMemo(
    () =>
      scopeTasksToActiveCampaigns(
        activeTasks.map(serializeTaskContext),
        activeEpicIds,
        activeRitualIds,
        activeHabitIdScope,
      ),
    [activeEpicIds, activeHabitIdScope, activeRitualIds, activeTasks],
  );

  const contextPlannerTasks = useMemo(
    () =>
      scopeTasksToActiveCampaigns(
        contextTasks.map(serializeTaskContext),
        activeEpicIds,
        activeRitualIds,
        activeHabitIdScope,
      ),
    [activeEpicIds, activeHabitIdScope, activeRitualIds, contextTasks],
  );

  const inboxPlannerTasks = useMemo(
    () =>
      scopeTasksToActiveCampaigns(
        inboxTasks.map(serializeTaskContext),
        activeEpicIds,
        activeRitualIds,
        activeHabitIdScope,
      ),
    [activeEpicIds, activeHabitIdScope, activeRitualIds, inboxTasks],
  );

  const recentCompletedPlannerTasks = useMemo(
    () =>
      scopeTasksToActiveCampaigns(
        (recentCompletedTasksQuery.data ?? []).map(serializeTaskContext),
        activeEpicIds,
        activeRitualIds,
        activeHabitIdScope,
      ),
    [
      activeEpicIds,
      activeHabitIdScope,
      activeRitualIds,
      recentCompletedTasksQuery.data,
    ],
  );

  const plannerMemory = useMemo<PlannerMemoryProfile>(() => {
    const remoteProfile = extractPlannerProfile(
      plannerMemoryQuery.data?.preferredWorkBlocks,
    );
    const onboardingData = isRecord(plannerMemoryQuery.data?.onboardingData)
      ? plannerMemoryQuery.data.onboardingData
      : {};
    const onboardingScheduleProfile = getOnboardingScheduleArchetypeProfile(
      onboardingData.scheduleArchetype,
    );
    const preferredTimeOfDay = plannerMemoryOverride?.preferredTimeOfDay ??
      sessionState.preferredTimeOfDay ??
      remoteProfile.preferredTimeOfDay ??
      storedPreferences.preferredTimeOfDay ??
      onboardingScheduleProfile?.defaultPreferredTimeOfDay ??
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
        {
          timeOfDay: onboardingScheduleProfile?.defaultPreferredTimeOfDay ??
            null,
          timeReason: onboardingScheduleProfile?.defaultPreferredTimeReason ??
            null,
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
      scheduleArchetype: remoteProfile.scheduleArchetype ??
        onboardingScheduleProfile?.id ?? null,
      scheduleArchetypeLabel: remoteProfile.scheduleArchetypeLabel ??
        onboardingScheduleProfile?.label ?? null,
      scheduleArchetypePlanningHint:
        remoteProfile.scheduleArchetypePlanningHint ??
          onboardingScheduleProfile?.plannerHint ??
          asString(onboardingData.scheduleArchetypePlanningHint),
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
        onboardingScheduleProfile?.defaultWorkloadTolerance ??
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
    plannerMemoryQuery.data?.onboardingData,
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
        tasks: activePlannerTasks,
        calendarEvents: EMPTY_CALENDAR_EVENTS,
        horizon,
        selectedDate: todayIso,
        currentDateTime: formatCurrentDateTimeWithOffset(today),
        plannerMemory,
      }, deletedPlannerEntitiesQuery.data ?? []),
    [
      activePlannerTasks,
      horizon,
      plannerMemory,
      today,
      todayIso,
    ],
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
        attribute: event.attribute as Parameters<
          typeof buildCompanionStatInterpretation
        >[0]["recentEvents"][number]["attribute"],
        sourceEvent: event.source_event,
        amountAwarded: event.amount_awarded,
        echoAmount: event.echo_amount,
        createdAt: event.created_at,
      })) as Parameters<
        typeof buildCompanionStatInterpretation
      >[0]["recentEvents"],
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

  const plannerAISignals = useMemo(
    () => buildPlannerAISignals(enrichedContext),
    [enrichedContext],
  );

  const effectiveWorkloadTolerance = useMemo(
    () =>
      plannerMemory.workloadTolerance ??
        plannerAISignals?.suggestedWorkload ??
        null,
    [
      plannerAISignals?.suggestedWorkload,
      plannerMemory.workloadTolerance,
    ],
  );

  const effectivePlannerMemory = useMemo<PlannerMemoryProfile>(() => ({
    ...plannerMemory,
    workloadTolerance: effectiveWorkloadTolerance,
  }), [effectiveWorkloadTolerance, plannerMemory]);

  const priorityScores = useMemo<PlannerPriorityScore[]>(
    () =>
      computePlannerPriorityScores({
        currentDate: todayIso,
        tasks: contextPlannerTasks,
        inboxTasks: inboxPlannerTasks,
        activeEpics: mapEpicsToContext(activeEpics, todayIso),
        rituals: baseRituals,
        calendarEvents: EMPTY_CALENDAR_EVENTS,
        contactsNeedingAttention: contactsAttentionQuery.data ?? [],
        reflectionSignals: reflectionSignalsQuery.data ?? [],
        careSignals,
        scheduleInsights,
        plannerMemory: effectivePlannerMemory,
        statInterpretation,
        aiSignals: plannerAISignals?.suggestedWorkload
          ? {
            suggestedWorkload: plannerAISignals.suggestedWorkload,
          }
          : undefined,
        starterIntent: "general",
      }),
    [
      activeEpics,
      baseRituals,
      careSignals,
      contactsAttentionQuery.data,
      contextPlannerTasks,
      effectivePlannerMemory,
      inboxPlannerTasks,
      plannerAISignals,
      statInterpretation,
      reflectionSignalsQuery.data,
      scheduleInsights,
      todayIso,
      deletedPlannerEntitiesQuery.data,
    ],
  );

  const plannerContext = useMemo<CompanionPlannerRequest["plannerContext"]>(
    () =>
      sanitizePlannerContext({
        tasks: mapTasksToContext(contextPlannerTasks),
        inboxTasks: mapTasksToContext(inboxPlannerTasks),
        recentCompletedTasks: mapTasksToContext(recentCompletedPlannerTasks),
        activeEpics: mapEpicsToContext(activeEpics, todayIso),
        ...(habitsQuery.data ? { activeHabitIds: activeHabitIdsList } : {}),
        ...(pendingPlannerCreateIds.taskIds.length > 0
          ? { pendingLocalTaskIds: pendingPlannerCreateIds.taskIds }
          : {}),
        ...(pendingPlannerCreateIds.epicIds.length > 0
          ? { pendingLocalEpicIds: pendingPlannerCreateIds.epicIds }
          : {}),
        ...(pendingPlannerCreateIds.habitIds.length > 0
          ? { pendingLocalHabitIds: pendingPlannerCreateIds.habitIds }
          : {}),
        rituals: ritualsQuery.data ?? baseRituals,
        calendarEvents: EMPTY_CALENDAR_EVENTS,
        contactsNeedingAttention: contactsAttentionQuery.data ?? [],
        reflectionSignals: reflectionSignalsQuery.data ?? [],
        careSignals,
        priorityScores,
        scheduleInsights,
        plannerMemory: effectivePlannerMemory,
        statInterpretation,
        aiSignals: plannerAISignals,
      }, deletedPlannerEntitiesQuery.data ?? []),
    [
      activeEpics,
      activeHabitIdsList,
      baseRituals,
      careSignals,
      contactsAttentionQuery.data,
      contextPlannerTasks,
      effectivePlannerMemory,
      inboxPlannerTasks,
      habitsQuery.data,
      pendingPlannerCreateIds,
      plannerAISignals,
      priorityScores,
      recentCompletedPlannerTasks,
      ritualsQuery.data,
      statInterpretation,
      reflectionSignalsQuery.data,
      scheduleInsights,
      todayIso,
      deletedPlannerEntitiesQuery.data,
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

  useEffect(() => {
    if (!enabled) return;
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
  }, [bootstrapGreeting, enabled, plannerGreeting]);

  useEffect(() => {
    if (!enabled) return;
    writeStoredPreferences({
      tonePack,
      preferredTimeOfDay: sessionState.preferredTimeOfDay ?? null,
      preferredTimeReason: sessionState.preferredTimeReason ?? null,
      reminderPreference: sessionState.reminderPreference ?? null,
    });
  }, [
    enabled,
    sessionState.preferredTimeOfDay,
    sessionState.preferredTimeReason,
    sessionState.reminderPreference,
    tonePack,
  ]);

  const persistPlannerThreadRows = useCallback(async (
    rows: Array<{
      role: "assistant" | "user";
      content: string;
      createdAt: string;
      inputMode?: CompanionPlannerMessage["inputMode"];
      metadata?: Json | null;
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

  const recordPlannerEvent = useCallback(async (
    eventType: PlannerEventType,
    payload: Record<string, unknown> = {},
    options?: {
      proposalId?: string | null;
      taskId?: string | null;
      epicId?: string | null;
    },
  ) => {
    if (!user?.id) return;

    const { error } = await supabase
      .from("planner_events")
      .insert({
        user_id: user.id,
        event_type: eventType,
        source: "companion_planner",
        planner_session_id: sessionIdRef.current,
        proposal_id: options?.proposalId ?? null,
        task_id: options?.taskId ?? null,
        epic_id: options?.epicId ?? null,
        payload: payload as Json,
      });

    if (error) {
      console.warn("Failed to record planner event:", error);
    }
  }, [user?.id]);

  const appendAssistantTurn = useCallback(
    (response: CompanionPlannerResponse) => {
      const assistantMessage = createMessage(
        "companion",
        stripMarkdown(response.reply),
        {
          questions: response.followUpQuestions,
          proposalIds: [...response.proposals, ...response.suggestedReminders]
            .map((proposal) => proposal.id),
          structuredResponse: response.structuredResponse ?? null,
          dayPlan: response.dayPlan ?? null,
        },
      );

      setQuestions(response.followUpQuestions);
      setStructuredResponse(response.structuredResponse ?? null);
      setDayPlan(response.dayPlan ?? null);
      setCommittedDayPlanId(null);
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

  const primeQuestCapture = useCallback((
    prompt = "Quest?",
    options?: { selectedDate?: string | null },
  ) => {
    if (!enabled) return;
    const trimmedPrompt = stripMarkdown(prompt).trim();
    if (!trimmedPrompt) return;
    const questCaptureSelectedDate = normalizeSelectedDateKey(
      options?.selectedDate,
    );
    pendingQuestCaptureSelectedDateRef.current = questCaptureSelectedDate;

    const questCaptureMessage = createMessage("companion", trimmedPrompt, {
      questions: [],
      proposalIds: [],
      structuredResponse: null,
    });
    const nextSessionState = {
      ...sessionState,
      draft: {
        draftKind: "create_quest" as const,
      },
      openQuestionIds: [],
      pendingStarterIntent: "quest_capture" as const,
    };

    setMessages((previous) => [
      ...previous,
      questCaptureMessage,
    ]);
    setStructuredResponse(null);
    setDayPlan(null);
    setCommittedDayPlanId(null);
    setProposals([]);
    setQuestions([]);
    setSessionState(nextSessionState);
    setDraftInput("");
    setInterimText("");
    setIsSubmitting(false);

    void persistPlannerThreadRows([
      {
        role: "assistant",
        content: questCaptureMessage.content,
        createdAt: questCaptureMessage.createdAt,
        metadata: {
          structuredResponse: null,
          followUpQuestions: [],
          proposals: [],
          suggestedReminders: [],
          sessionState: nextSessionState,
          questCaptureSelectedDate,
        } as unknown as Json,
      },
    ]);
  }, [enabled, persistPlannerThreadRows, sessionState]);

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
      selectedDate?: string | null;
    },
  ) => {
    if (!enabled) return;
    const message = rawMessage.trim();
    if (!message || isSubmitting) return;
    const selectedDate = normalizeSelectedDateKey(options?.selectedDate) ??
      (sessionState.pendingStarterIntent === "quest_capture"
        ? pendingQuestCaptureSelectedDateRef.current
        : null);
    const requestDate = selectedDate ?? todayIso;

    const resolvedStarterIntent: CompanionPlannerContextStarterIntent =
      normalizeStarterIntentForPlanner(
        options?.starterIntent,
      ) ?? deriveStarterIntentFromMessage(message);
    if (resolvedStarterIntent === "quest_capture" && !options?.skipUserEcho) {
      primeQuestCapture(message, { selectedDate });
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

    const parsedInput = parseNaturalLanguage(
      message,
      selectedDate
        ? {
          referenceDateTime: buildSelectedDateReferenceDateTime(selectedDate),
        }
        : undefined,
    );
    const sanitizedParsedInput = sanitizePlannerParsedInput({
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
    });
    let requestBody: CompanionPlannerRequest | null = null;

    try {
      const resolvedBriefingContext = options?.briefingContext ?? null;
      const resolvedPlannerMemory: PlannerMemoryProfile = {
        ...plannerMemory,
        workloadTolerance: effectiveWorkloadTolerance,
      };
      const requestCurrentDateTime = formatCurrentDateTimeWithOffset(
        new Date(),
      );
      const classificationPromise = withTimeout(
        () => classify(message),
        {
          timeoutMs: PLANNER_PREFLIGHT_TIMEOUT_MS,
          operation: "planner intent classification",
          timeoutCode: "PLANNER_CLASSIFICATION_TIMEOUT",
        },
      ).catch((error) => {
        console.info(
          "Planner intent classification preflight timed out; falling back to backend classification.",
        );
        return null;
      });
      const classification = await classificationPromise;
      const activePlannerContext = plannerContext;
      const mergedActiveEpicIds = new Set(
        activePlannerContext.activeEpics.map((epic) => epic.id),
      );
      const mergedActiveHabitIds = activePlannerContext.activeHabitIds
        ? new Set(activePlannerContext.activeHabitIds)
        : null;
      const mergedActiveRitualIds = new Set(
        activePlannerContext.rituals
          .filter((ritual) =>
            mergedActiveEpicIds.has(ritual.epicId) &&
            (!mergedActiveHabitIds || mergedActiveHabitIds.has(ritual.id))
          )
          .map((ritual) => ritual.id),
      );
      const deletedPlannerEntities = deletedPlannerEntitiesQuery.data ?? [];
      const syncedPlannerContext = sanitizePlannerContext(
        {
          ...activePlannerContext,
          tasks: scopeTasksToActiveCampaigns(
            activePlannerContext.tasks,
            mergedActiveEpicIds,
            mergedActiveRitualIds,
            mergedActiveHabitIds,
          ),
          inboxTasks: scopeTasksToActiveCampaigns(
            activePlannerContext.inboxTasks,
            mergedActiveEpicIds,
            mergedActiveRitualIds,
            mergedActiveHabitIds,
          ),
          recentCompletedTasks: scopeTasksToActiveCampaigns(
            activePlannerContext.recentCompletedTasks ?? [],
            mergedActiveEpicIds,
            mergedActiveRitualIds,
            mergedActiveHabitIds,
          ),
        },
        deletedPlannerEntities,
      );
      const requestActiveEpics = mapEpicsToContext(activeEpics, requestDate);
      const requestScheduleInsights = requestDate === todayIso
        ? scheduleInsights
        : buildCompanionPlannerScheduleInsights({
          tasks: syncedPlannerContext.tasks,
          calendarEvents: syncedPlannerContext
            .calendarEvents as PlannerContextCalendarEvent[],
          horizon,
          selectedDate: requestDate,
          currentDateTime: requestCurrentDateTime,
          plannerMemory: resolvedPlannerMemory,
        });
      const requestPriorityScores = computePlannerPriorityScores({
        currentDate: requestDate,
        tasks: syncedPlannerContext.tasks,
        inboxTasks: syncedPlannerContext.inboxTasks,
        activeEpics: requestActiveEpics,
        rituals: syncedPlannerContext.rituals,
        calendarEvents: syncedPlannerContext
          .calendarEvents as PlannerContextCalendarEvent[],
        contactsNeedingAttention: contactsAttentionQuery.data ?? [],
        reflectionSignals: reflectionSignalsQuery.data ?? [],
        careSignals,
        briefingContext: resolvedBriefingContext,
        starterIntent: resolvedStarterIntent,
        scheduleInsights: requestScheduleInsights,
        plannerMemory: resolvedPlannerMemory,
        aiSignals: plannerAISignals?.suggestedWorkload
          ? {
            suggestedWorkload: plannerAISignals.suggestedWorkload,
          }
          : undefined,
      });
      lastSubmissionContextRef.current = {
        starterIntent: resolvedStarterIntent,
        briefingContext: resolvedBriefingContext,
      };
      const classificationHint = normalizeClassificationHint(classification);
      const requestPlannerContext = sanitizePlannerContext({
        ...syncedPlannerContext,
        activeEpics: requestActiveEpics,
        starterIntent: resolvedStarterIntent,
        briefingContext: resolvedBriefingContext,
        priorityScores: requestPriorityScores,
        scheduleInsights: requestScheduleInsights,
        plannerMemory: resolvedPlannerMemory,
      }, deletedPlannerEntities);
      const allowedPlannerTitles = collectAllowedPlannerTitles(
        requestPlannerContext,
      );
      const sanitizedConversationHistory = sanitizePlannerConversationHistory(
        conversationHistory,
        deletedPlannerEntities,
        allowedPlannerTitles,
      );
      const sanitizedSessionState = sanitizePlannerSessionState(
        sessionState,
        deletedPlannerEntities,
        allowedPlannerTitles,
      );
      requestBody = {
        message,
        currentDate: requestDate,
        currentDateTime: requestCurrentDateTime,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
        horizon,
        tonePack,
        conversationHistory: sanitizedConversationHistory,
        sessionState: sanitizedSessionState,
        parsedInput: sanitizedParsedInput,
        classificationHint,
        plannerContext: requestPlannerContext,
        activeDayPlan: dayPlan && dayPlan.status === "draft" ? dayPlan : null,
      };
      const localValidation = validateCompanionPlannerRequest(requestBody);
      if (!localValidation.success) {
        const validationError = new Error(
          "Planner request failed local validation",
        );
        validationError.name = "PlannerRequestValidationError";
        throw validationError;
      }
      const { data, error } = await supabase.functions.invoke(
        "companion-planner-chat",
        {
          body: requestBody,
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
      if (nextSession.pendingStarterIntent === "quest_capture") {
        pendingQuestCaptureSelectedDateRef.current = selectedDate;
      } else {
        pendingQuestCaptureSelectedDateRef.current = null;
      }
      const assistantMessage = appendAssistantTurn({
        ...response,
        sessionState: nextSession,
      });

      const persistedRows: Parameters<typeof persistPlannerThreadRows>[0] = [
        ...(
          options?.skipUserEcho ? [] : [{
            role: "user" as const,
            content: userMessage.content,
            createdAt: userMessage.createdAt,
            inputMode: userMessage.inputMode,
          }]
        ),
        {
          role: "assistant" as const,
          content: assistantMessage.content,
          createdAt: assistantMessage.createdAt,
          metadata: {
            structuredResponse: assistantMessage.structuredResponse ?? null,
            followUpQuestions: response.followUpQuestions,
            proposals: response.proposals,
            suggestedReminders: response.suggestedReminders,
            sessionState: response.sessionState,
            dayPlan: response.dayPlan ?? null,
            questCaptureSelectedDate:
              nextSession.pendingStarterIntent === "quest_capture"
                ? selectedDate
                : null,
          } as unknown as Json,
        },
      ];
      await persistPlannerThreadRows(persistedRows);

      const isReadOnlyBriefing = resolvedStarterIntent === "upcoming_start" ||
        response.mode === "schedule_read" ||
        response.plannerContract?.mode === "schedule_read";
      if (!isReadOnlyBriefing) {
        const basePlannerEventPayload = {
          message,
          starterIntent: resolvedStarterIntent,
          mode: response.mode,
          plannerContract: response.plannerContract,
          proposalCount: response.proposals.length,
          suggestedReminderCount: response.suggestedReminders.length,
          questionCount: response.followUpQuestions.length,
        };
        await recordPlannerEvent("plan_requested", basePlannerEventPayload);
        if (response.followUpQuestions.length > 0) {
          await recordPlannerEvent("clarification_requested", {
            ...basePlannerEventPayload,
            questions: response.followUpQuestions.map((question) =>
              question.field
            ),
          });
        }
        if (response.proposals.length > 0) {
          await Promise.all(response.proposals.map((proposal) => {
            const entityIds = extractPlannerEventEntityIds(proposal);
            const scheduleValidationStatus =
              asUnknownRecord(proposal.payload)?.scheduleValidationStatus ??
                null;
            return recordPlannerEvent(
              "proposal_generated",
              {
                ...basePlannerEventPayload,
                proposalKind: proposal.kind,
                proposalTitle: proposal.title,
                readyToConfirm: proposal.readyToConfirm,
                scheduleValidationStatus,
              },
              {
                proposalId: proposal.id,
                taskId: entityIds.taskId,
                epicId: entityIds.epicId,
              },
            );
          }));
          await Promise.all(
            response.proposals
              .filter((proposal) =>
                asUnknownRecord(proposal.payload)?.scheduleValidationStatus ===
                  "warning"
              )
              .map((proposal) => {
                const entityIds = extractPlannerEventEntityIds(proposal);
                return recordPlannerEvent(
                  "schedule_validation_failed",
                  {
                    ...basePlannerEventPayload,
                    proposalKind: proposal.kind,
                    proposalTitle: proposal.title,
                    scheduleValidationIssues: asUnknownRecord(proposal.payload)
                      ?.scheduleValidationIssues ?? [],
                  },
                  {
                    proposalId: proposal.id,
                    taskId: entityIds.taskId,
                    epicId: entityIds.epicId,
                  },
                );
              }),
          );
        } else if (response.structuredResponse) {
          await recordPlannerEvent(
            "suggestion_generated",
            basePlannerEventPayload,
          );
        }

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
          modifications: summarizeProposalGenerationTelemetry(
            response.proposals,
            horizon,
          ),
        });
      }
    } catch (error) {
      const parsedError = await parseFunctionInvokeError(error);
      const localValidation = requestBody
        ? validateCompanionPlannerRequest(requestBody)
        : null;

      if (shouldUseLocalComingUpFallback(requestBody)) {
        console.warn("Companion planner coming-up request failed; using local read-only fallback.", {
          parsedError,
          localValidation,
          requestSummary: summarizePlannerRequestForDebug(requestBody),
        });
        const fallbackResponse = buildLocalComingUpFallbackResponse(requestBody);
        const assistantMessage = appendAssistantTurn(fallbackResponse);
        const persistedRows: Parameters<typeof persistPlannerThreadRows>[0] = [
          ...(
            options?.skipUserEcho ? [] : [{
              role: "user" as const,
              content: userMessage.content,
              createdAt: userMessage.createdAt,
              inputMode: userMessage.inputMode,
            }]
          ),
          {
            role: "assistant" as const,
            content: assistantMessage.content,
            createdAt: assistantMessage.createdAt,
            metadata: {
              structuredResponse: assistantMessage.structuredResponse ?? null,
              followUpQuestions: fallbackResponse.followUpQuestions,
              proposals: fallbackResponse.proposals,
              suggestedReminders: fallbackResponse.suggestedReminders,
              sessionState: fallbackResponse.sessionState,
              dayPlan: fallbackResponse.dayPlan ?? null,
              questCaptureSelectedDate: null,
            } as unknown as Json,
          },
        ];

        try {
          await persistPlannerThreadRows(persistedRows);
        } catch (persistError) {
          console.warn(
            "Failed to persist local coming-up fallback:",
            persistError,
          );
        }
        return;
      }

      console.error("Failed to submit planner message:", {
        parsedError,
        localValidation,
        requestSummary: requestBody
          ? summarizePlannerRequestForDebug(requestBody)
          : null,
      });

      const userFacingError = toUserFacingCompanionPlannerError(parsedError);
      toast.error(userFacingError);
      setMessages((previous) => [
        ...previous,
        createMessage("companion", userFacingError),
      ]);
    } finally {
      setIsSubmitting(false);
    }
  }, [
    activeEpicIds,
    activeEpics,
    activeRitualIds,
    appendAssistantTurn,
    careSignals,
    classify,
    contactsAttentionQuery.data,
    contextTasks,
    conversationHistory,
    dayPlan,
    deletedPlannerEntitiesQuery.data,
    enabled,
    effectivePlannerMemory,
    horizon,
    inboxTasks,
    isSubmitting,
    persistPlannerThreadRows,
    plannerContext,
    plannerAISignals,
    recordPlannerEvent,
    reflectionSignalsQuery.data,
    scheduleInsights,
    sessionState,
    todayIso,
    tonePack,
    trackInteraction,
  ]);

  const handleConfirmProposal = useCallback(async (proposalId: string) => {
    if (!enabled) return;
    const proposal = findProposalById(proposals, proposalId);
    if (!proposal) return;
    if (!proposal.readyToConfirm) {
      toast("I still need a bit more detail before I can save that.");
      return;
    }

    try {
      let confirmationContent = `Saved: ${proposal.title}.`;
      let localTaskId: string | null = null;

      switch (proposal.kind) {
        case "create_quest": {
          const payload = sanitizeCreateQuestProposalPayload(proposal.payload);
          const createResult = await addTask(payload);
          localTaskId = typeof createResult?.id === "string"
            ? createResult.id
            : null;
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

          await updateTask(taskUpdatePayload);
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
                queueAction: async (action) => {
                  await queueAction({
                    ...action,
                    payload: (typeof action.payload === "object" &&
                        action.payload !== null &&
                        !Array.isArray(action.payload))
                      ? action.payload as Record<string, unknown>
                      : {},
                  });
                },
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
          const starterHabitTime = starterHabit?.preferred_time ??
            starterHabit?.preferredTime;
          if (starterHabitTime) {
            await trackTaskCreation(
              starterHabitTime,
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
          const payload = proposal.payload as unknown as Parameters<
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
          const payload = proposal.payload as unknown as Parameters<
            typeof saveRitual
          >[0];
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
          const payload = proposal.payload as unknown as Parameters<
            typeof updateTask
          >[0];
          await updateTask(payload);
          localTaskId = payload.taskId;
          break;
        }
        default:
          return;
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
          metadata: {
            proposalDecision: {
              proposalId,
              status: "confirmed",
            },
          },
        },
      ]);
      const nextSessionState = {
        ...sessionState,
      };
      await persistPlannerMemory(proposal, nextSessionState);
      const optimizerTelemetry = extractOptimizerTelemetry(proposal);
      const eventEntityIds = extractPlannerEventEntityIds(proposal);
      await recordPlannerEvent(
        "proposal_confirmed",
        {
          proposalKind: proposal.kind,
          proposalTitle: proposal.title,
          statDrivenNeed: strongestPlannerNeed,
          ...optimizerTelemetry,
        },
        {
          proposalId: proposal.id,
          taskId: localTaskId ?? eventEntityIds.taskId,
          epicId: eventEntityIds.epicId,
        },
      );
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
      emitPlanDayActionSavedEvent();
    } catch (error) {
      console.error("Failed to confirm planner proposal:", error);
      toast.error("I couldn't save that change yet.");
    }
  }, [
    activeTasks,
    addTask,
    enabled,
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
    recordPlannerEvent,
    shouldQueueWrites,
    strongestPlannerNeed,
    trackInteraction,
    trackScheduleModification,
    trackTaskCreation,
    updateTask,
    user?.id,
  ]);

  const handleRejectProposal = useCallback(async (proposalId: string) => {
    if (!enabled) return;
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
        metadata: {
          proposalDecision: {
            proposalId,
            status: "rejected",
          },
        },
      },
    ]);
    const optimizerTelemetry = extractOptimizerTelemetry(proposal);
    const eventEntityIds = extractPlannerEventEntityIds(proposal);
    await recordPlannerEvent(
      "proposal_rejected",
      {
        proposalKind: proposal.kind,
        proposalTitle: proposal.title,
        statDrivenNeed: strongestPlannerNeed,
        decisionOverride: true,
        ...optimizerTelemetry,
      },
      {
        proposalId: proposal.id,
        taskId: eventEntityIds.taskId,
        epicId: eventEntityIds.epicId,
      },
    );
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
    enabled,
    persistPlannerThreadRows,
    proposals,
    recordPlannerEvent,
    strongestPlannerNeed,
    trackInteraction,
  ]);

  const handleCompleteProposalEdit = useCallback(async (
    proposalId: string,
    options?: { savedTitle?: string | null },
  ) => {
    if (!enabled) return;
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
        metadata: {
          proposalDecision: {
            proposalId,
            status: "modified",
          },
        },
      },
    ]);
    const optimizerTelemetry = extractOptimizerTelemetry(proposal);
    const eventEntityIds = extractPlannerEventEntityIds(proposal);
    await recordPlannerEvent(
      "proposal_modified",
      {
        proposalKind: proposal.kind,
        proposalTitle: proposal.title,
        statDrivenNeed: strongestPlannerNeed,
        savedTitle: resolvedTitle,
        editedExternally: true,
        ...optimizerTelemetry,
      },
      {
        proposalId: proposal.id,
        taskId: eventEntityIds.taskId,
        epicId: eventEntityIds.epicId,
      },
    );
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
    emitPlanDayActionSavedEvent();
  }, [
    enabled,
    persistPlannerThreadRows,
    proposals,
    recordPlannerEvent,
    strongestPlannerNeed,
    trackInteraction,
  ]);

  const handleConfirmAll = useCallback(async () => {
    if (!enabled) return;
    const readyProposals = proposals.filter((proposal) =>
      proposal.status === "pending" && proposal.readyToConfirm
    );
    for (const proposal of readyProposals) {
      // Sequential saves keep the confirmation flow predictable and mutation-safe.
      await handleConfirmProposal(proposal.id);
    }
    setQuestions([]);
  }, [enabled, handleConfirmProposal, proposals]);

  const handleCommitDayPlan = useCallback(async () => {
    if (!enabled) return;
    if (!dayPlan || dayPlan.blocks.length === 0) return;
    if (committingDayPlan) return;

    // Capture the exact plan we're committing. If a refinement turn replaces
    // dayPlan mid-flight, we won't apply our optimistic "committed" update to
    // the new plan (which would mismatch the daily_tasks rows we just wrote).
    const startingPlan = dayPlan;
    const startingProposalIds = new Set(
      startingPlan.blocks
        .map((block) => block.proposalId ?? null)
        .filter((id): id is string => typeof id === "string"),
    );

    setCommittingDayPlan(true);
    try {
      const draftRpc = supabase.rpc as unknown as (
        fn: string,
        args: Record<string, unknown>,
      ) => Promise<{ data: string | null; error: { message?: string } | null }>;
      const upsertResult = await draftRpc("upsert_day_plan_draft", {
        p_plan_date: startingPlan.date,
        p_blocks: startingPlan.blocks,
      });
      if (upsertResult.error) {
        throw new Error(
          upsertResult.error.message ?? "Could not save the plan.",
        );
      }
      const planId = upsertResult.data;
      if (!planId) {
        throw new Error("Plan id missing after save.");
      }

      const commitRpc = supabase.rpc as unknown as (
        fn: string,
        args: Record<string, unknown>,
      ) => Promise<
        {
          data: { committedTaskIds?: string[]; planId?: string } | null;
          error: { message?: string } | null;
        }
      >;
      const commitResult = await commitRpc("apply_day_plan", {
        p_plan_id: planId,
      });
      if (commitResult.error) {
        throw new Error(
          commitResult.error.message ?? "Could not lock in the plan.",
        );
      }

      const committedTaskIds =
        Array.isArray(commitResult.data?.committedTaskIds)
          ? commitResult.data.committedTaskIds.filter((
            taskId,
          ): taskId is string =>
            typeof taskId === "string" && taskId.trim().length > 0
          )
          : [];
      const committedPlan: NonNullable<CompanionPlannerResponse["dayPlan"]> = {
        ...startingPlan,
        id: planId,
        status: "committed",
        blocks: startingPlan.blocks.map((block, index) => ({
          ...block,
          questId: committedTaskIds[index] ?? block.questId ?? null,
        })),
      };
      const committedProposals = proposals.map((proposal) =>
        proposal.kind === "create_quest" && startingProposalIds.has(proposal.id)
          ? { ...proposal, status: "confirmed" as const }
          : proposal
      );
      const planDate = new Date(`${startingPlan.date}T12:00:00`);
      const planDateLabel = Number.isNaN(planDate.getTime())
        ? startingPlan.date
        : format(planDate, "EEE, MMM d");
      const confirmationMessage = createMessage(
        "companion",
        `Plan locked in for ${planDateLabel}.`,
        {
          dayPlan: committedPlan,
        },
      );

      setCommittedDayPlanId(planId);
      setDayPlan((current) => {
        if (!current) return current;
        // Only overwrite the visible plan if it still matches the one we
        // committed. A refinement turn that replaced it should keep its
        // own (uncommitted) state.
        if (current === startingPlan) {
          return committedPlan;
        }
        if (current.date !== startingPlan.date) return current;
        if (current.blocks.length !== startingPlan.blocks.length) {
          return current;
        }
        return committedPlan;
      });
      setProposals(committedProposals);
      setMessages((previous) => [...previous, confirmationMessage]);
      await persistPlannerThreadRows([
        {
          role: "assistant",
          content: confirmationMessage.content,
          createdAt: confirmationMessage.createdAt,
          metadata: {
            structuredResponse: confirmationMessage.structuredResponse ?? null,
            followUpQuestions: [],
            proposals: committedProposals,
            suggestedReminders: [],
            sessionState,
            dayPlan: committedPlan,
          } as unknown as Json,
        },
      ]);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["daily-tasks"] }),
        queryClient.invalidateQueries({ queryKey: ["calendar-tasks"] }),
        queryClient.invalidateQueries({ queryKey: ["inbox-tasks"] }),
      ]);
      toast(confirmationMessage.content);
    } catch (error) {
      console.error("[companion-planner] commit day plan failed", error);
      toast(
        error instanceof Error
          ? error.message
          : "Could not lock in the plan. Try again.",
      );
    } finally {
      setCommittingDayPlan(false);
    }
  }, [
    committingDayPlan,
    dayPlan,
    enabled,
    persistPlannerThreadRows,
    proposals,
    queryClient,
    sessionState,
  ]);

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
    bootstrappedGreetingRef.current = true;
    pendingQuestCaptureSelectedDateRef.current = null;
    sessionIdRef.current = options?.sessionId ??
      generateCompanionThreadSessionId();
    setMessages(
      bootstrapGreeting && plannerGreeting
        ? [
          createMessage("companion", plannerGreeting, {
            questions: [],
            proposalIds: [],
            structuredResponse: null,
          }),
        ]
        : [],
    );
    setStructuredResponse(null);
    setDayPlan(null);
    setCommittedDayPlanId(null);
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
    bootstrappedGreetingRef.current = true;
    pendingQuestCaptureSelectedDateRef.current = null;
    sessionIdRef.current = options.sessionId;
    const nextMessages: CompanionPlannerMessage[] = options.messages.map((
      message,
    ) => ({
      id: message.id,
      role: message.role === "assistant" ? "companion" : "user",
      content: message.content,
      createdAt: message.createdAt,
      inputMode: message.inputMode,
      structuredResponse: message.structuredResponse ?? null,
    }));
    setMessages(nextMessages);
    const nextStructuredResponse = [...options.messages]
      .reverse()
      .find((message) =>
        message.role === "assistant" && message.structuredResponse !== undefined
      )
      ?.structuredResponse ?? null;
    const latestPlannerSnapshot = findLatestPlannerSnapshotMetadata(
      options.messages,
    );
    const latestDayPlan = readPersistedDayPlan(
      latestPlannerSnapshot?.metadata,
    );
    const nextQuestions = readPersistedPlannerQuestions(
      latestPlannerSnapshot?.metadata.followUpQuestions,
    );
    const nextSessionState = readPersistedPlannerSessionState(
      latestPlannerSnapshot?.metadata.sessionState,
    ) ?? createInitialSessionState(storedPreferences);
    pendingQuestCaptureSelectedDateRef.current =
      nextSessionState.pendingStarterIntent === "quest_capture"
        ? readPersistedQuestCaptureSelectedDate(latestPlannerSnapshot?.metadata)
        : null;
    const nextProposals = [
      ...readPersistedPlannerProposals(
        latestPlannerSnapshot?.metadata.proposals,
      ),
      ...readPersistedPlannerProposals(
        latestPlannerSnapshot?.metadata.suggestedReminders,
      ),
    ];

    const hydratedProposals = options.messages
      .slice(latestPlannerSnapshot ? latestPlannerSnapshot.index + 1 : 0)
      .reduce((currentProposals, message) => {
        const proposalDecision = readPersistedPlannerProposalDecision(
          asUnknownRecord(message.metadata)?.proposalDecision,
        );
        if (!proposalDecision) return currentProposals;

        return currentProposals.map((proposal) =>
          proposal.id === proposalDecision.proposalId
            ? {
              ...proposal,
              status: proposalDecision.status,
            }
            : proposal
        );
      }, nextProposals);

    setStructuredResponse(nextStructuredResponse);
    setDayPlan(latestDayPlan);
    setCommittedDayPlanId(
      latestDayPlan && latestDayPlan.status === "committed" && latestDayPlan.id
        ? latestDayPlan.id
        : null,
    );
    setProposals(hydratedProposals);
    setQuestions(nextQuestions);
    setSessionState(nextSessionState);
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
    structuredResponse,
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
    dayPlan,
    committingDayPlan,
    committedDayPlanId,
    commitDayPlan: handleCommitDayPlan,
    sessionState,
    plannerContext,
    plannerMemory: effectivePlannerMemory,
    statInterpretation,
    scheduleInsights,
    todayLabel: format(today, "EEEE, MMMM d"),
    isLoadingContext: todayTasksQuery.isLoading ||
      weekTasksQuery.isLoading ||
      monthTasksQuery.isLoading ||
      plannerMemoryQuery.isLoading ||
      contactsAttentionQuery.isLoading ||
      reflectionSignalsQuery.isLoading ||
      recentStatSignalsQuery.isLoading ||
      ritualsQuery.isLoading ||
      recentCompletedTasksQuery.isLoading,
  };
}
