import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { toast } from "@/components/ui/sonner";
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
import { useRitualUpdate } from "@/hooks/useRitualUpdate";
import { useUserAIContext } from "@/hooks/useUserAIContext";
import { useAIInteractionTracker } from "@/hooks/useAIInteractionTracker";
import { useSchedulingLearner } from "@/hooks/useSchedulingLearner";
import { useAuth } from "@/hooks/useAuth";
import { useCompanion } from "@/hooks/useCompanion";
import { parseNaturalLanguage } from "@/features/tasks/hooks/useNaturalLanguageParser";
import { buildCompanionPlannerScheduleInsights } from "@/utils/companionPlannerSchedule";
import { resolveCompanionPlannerError } from "@/utils/companionPlannerErrors";
import type { Json } from "@/integrations/supabase/types";
import type { EpicRecord } from "@/hooks/epicsQuery";
import { stripMarkdown } from "@/lib/utils";
import {
  getCompanionChatThreadsQueryKey,
  generateCompanionThreadSessionId,
  persistCompanionThreadMessages,
} from "@/services/companionChatThreads";
import { getCompanionPlannerOpener } from "@/shared/companionPlannerCopy";
import { LOCKED_COMPANION_TONE_PACK } from "@/shared/companionChaosVoice";
import type {
  CompanionChatSurface,
  CompanionChatThreadMessage,
  CompanionPlannerMessage,
  CompanionPlannerProposalKind,
  CompanionPlannerProposal,
  CompanionPlannerQuestion,
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

const STORAGE_KEY = "companion-planner-preferences-v1";
const MAX_CONTEXT_TASKS = 18;

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
  peakProductivityTimes: string[];
  schedulingPatterns: Json | null;
  successfulPatterns: Json | null;
};

const DEFAULT_SESSION_STATE: CompanionPlannerSessionState = {
  draft: {},
  openQuestionIds: [],
  preferredTimeOfDay: null,
  preferredTimeReason: null,
  reminderPreference: null,
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

const formatCurrentDateTimeWithOffset = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  const seconds = String(date.getSeconds()).padStart(2, "0");
  const offsetMinutes = -date.getTimezoneOffset();
  const sign = offsetMinutes >= 0 ? "+" : "-";
  const absoluteOffsetMinutes = Math.abs(offsetMinutes);
  const offsetHours = String(Math.floor(absoluteOffsetMinutes / 60)).padStart(2, "0");
  const offsetRemainderMinutes = String(absoluteOffsetMinutes % 60).padStart(2, "0");

  return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}${sign}${offsetHours}:${offsetRemainderMinutes}`;
};

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

const parseReminderPreferenceMinutes = (value: string | null | undefined): number | null => {
  if (!value) return null;
  const match = value.match(/(\d{1,3})/);
  return match?.[1] ? Number.parseInt(match[1], 10) : null;
};

const parseTimeOfDayFromClock = (time: string | null | undefined): PlannerMemoryProfile["preferredTimeOfDay"] => {
  if (!time) return null;
  const hour = Number.parseInt(time.split(":")[0] ?? "", 10);
  if (Number.isNaN(hour)) return null;
  if (hour < 12) return "morning";
  if (hour < 17) return "afternoon";
  if (hour < 21) return "evening";
  return "night";
};

const extractPlannerProfile = (
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

const mergePreferredWindows = (
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

const inferCadenceKeyFromProposal = (kind: CompanionPlannerProposalKind, payload: Record<string, unknown>): string | null => {
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

const inferReminderMinutesFromProposal = (kind: CompanionPlannerProposalKind, payload: Record<string, unknown>): number | null => {
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

const inferScheduledTimeFromProposal = (kind: CompanionPlannerProposalKind, payload: Record<string, unknown>): string | null => {
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

  if (kind === "update_quest") {
    const updates = payload.updates;
    if (updates && typeof updates === "object" && !Array.isArray(updates)) {
      const scheduledTime = (updates as Record<string, unknown>).scheduled_time;
      return typeof scheduledTime === "string" ? scheduledTime : null;
    }
  }

  return null;
};

const serializeTaskContext = (task: {
  id: string;
  task_text: string;
  task_date: string | null;
  scheduled_time: string | null;
  estimated_duration?: number | null;
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
  recurrencePattern: task.recurrence_pattern,
  recurrenceEndDate: task.recurrence_end_date ?? null,
  completed: task.completed ?? null,
  priority: task.priority ?? null,
  source: task.source ?? null,
  epicId: task.epic_id ?? null,
  epicTitle: task.epic_title ?? null,
});

const mapEpicsToContext = (epics: EpicRecord[]): PlannerContextEpic[] =>
  epics.map((epic) => ({
    id: epic.id,
    title: epic.title,
    endDate: epic.end_date,
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
      })),
  );

const applyMemoryUpdates = (
  previous: CompanionPlannerSessionState,
  updates: CompanionPlannerResponse["memoryUpdates"],
): CompanionPlannerSessionState => ({
  ...previous,
  preferredTimeOfDay: updates.preferredTimeOfDay ?? previous.preferredTimeOfDay ?? null,
  preferredTimeReason: updates.preferredTimeReason ?? previous.preferredTimeReason ?? null,
  reminderPreference: updates.reminderPreference ?? previous.reminderPreference ?? null,
});

const normalizeClassificationHint = (
  classification: IntentClassification | null,
): CompanionPlannerRequest["classificationHint"] => {
  if (!classification) return null;

  const normalized: NonNullable<CompanionPlannerRequest["classificationHint"]> = {
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

const findProposalById = (proposals: CompanionPlannerProposal[], proposalId: string) =>
  proposals.find((proposal) => proposal.id === proposalId) ?? null;

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
  const contextEventsQuery = useExternalCalendarEvents(today, horizon === "month" ? "month" : "week");
  const { inboxTasks } = useInboxTasks();
  const { activeEpics, createEpic, renameEpic, createCampaignRitual } = useEpics();
  const { addTask, updateTask } = useTaskMutations();
  const { saveRitual } = useRitualUpdate();
  const { enrichedContext } = useUserAIContext();
  const { trackInteraction } = useAIInteractionTracker();
  const { trackTaskCreation, trackScheduleModification } = useSchedulingLearner();

  const tonePack: PlannerTonePack = DEFAULT_TONE_PACK;
  const setTonePack = useCallback((_nextTonePack: PlannerTonePack) => {
    return;
  }, []);
  const sessionIdRef = useRef<string>(generateCompanionThreadSessionId());
  const [messages, setMessages] = useState<CompanionPlannerMessage[]>([]);
  const [proposals, setProposals] = useState<CompanionPlannerProposal[]>([]);
  const [questions, setQuestions] = useState<CompanionPlannerQuestion[]>([]);
  const [sessionState, setSessionState] = useState<CompanionPlannerSessionState>(() =>
    createInitialSessionState(storedPreferences),
  );
  const [draftInput, setDraftInput] = useState("");
  const [interimText, setInterimText] = useState("");
  const [showPermissionDialog, setShowPermissionDialog] = useState(false);
  const [isRequestingPermission, setIsRequestingPermission] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [plannerMemoryOverride, setPlannerMemoryOverride] = useState<Partial<PlannerMemoryProfile> | null>(null);
  const bootstrappedGreetingRef = useRef(false);

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
      ?? parseReminderPreferenceMinutes(sessionState.reminderPreference)
      ?? parseReminderPreferenceMinutes(storedPreferences.reminderPreference)
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
      tasks: activeTasks.map(serializeTaskContext),
      calendarEvents: activeEventsQuery.events,
      horizon,
      selectedDate: todayIso,
      plannerMemory,
    }), [activeEventsQuery.events, activeTasks, horizon, plannerMemory, todayIso]);

  const plannerContext = useMemo<CompanionPlannerRequest["plannerContext"]>(() => ({
    tasks: mapTasksToContext(contextTasks.map(serializeTaskContext)),
    inboxTasks: mapTasksToContext(inboxTasks.map(serializeTaskContext)),
    activeEpics: mapEpicsToContext(activeEpics),
    rituals: mapRitualsToContext(activeEpics),
    calendarEvents: contextEventsQuery.events as PlannerContextCalendarEvent[],
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

  const conversationHistory = useMemo<CompanionPlannerRequest["conversationHistory"]>(() => (
    messages
      .slice(-16)
      .map((message) => ({
        role: message.role === "companion" ? "assistant" : "user",
        content: message.content,
      }))
  ), [messages]);

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
  }, [sessionState.preferredTimeOfDay, sessionState.preferredTimeReason, sessionState.reminderPreference, tonePack]);

  const persistPlannerThreadRows = useCallback(async (
    rows: Array<{
      role: "assistant" | "user";
      content: string;
      createdAt: string;
      inputMode?: CompanionPlannerMessage["inputMode"];
    }>,
  ) => {
    if (!threadPersistence?.enabled || threadPersistence.surface !== "journeys") return;
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
  }, [companion?.id, queryClient, threadPersistence?.enabled, threadPersistence?.surface, user?.id]);

  const appendAssistantTurn = useCallback((response: CompanionPlannerResponse) => {
    const assistantMessage = createMessage("companion", stripMarkdown(response.reply), {
      questions: response.followUpQuestions,
      proposalIds: [...response.proposals, ...response.suggestedReminders].map((proposal) => proposal.id),
    });

    setQuestions(response.followUpQuestions);
    setProposals((previous) => {
      const settled = previous.filter((proposal) => proposal.status !== "pending");
      const incoming = [...response.proposals, ...response.suggestedReminders];
      if (incoming.length > 0) {
        return [...settled, ...incoming];
      }

      if (response.followUpQuestions.length > 0) {
        return settled;
      }

      return [...settled, ...previous.filter((proposal) => proposal.status === "pending")];
    });
    setMessages((previous) => [
      ...previous,
      assistantMessage,
    ]);
    setSessionState(response.sessionState);
    return assistantMessage;
  }, []);

  const persistPlannerMemory = useCallback(async (
    proposal: CompanionPlannerProposal,
    nextSessionState: CompanionPlannerSessionState,
  ) => {
    if (!user?.id) return;

    const remoteProfile = extractPlannerProfile(plannerMemoryQuery.data?.preferredWorkBlocks);
    const proposalTime = inferScheduledTimeFromProposal(proposal.kind, proposal.payload);
    const preferredTimeOfDay = nextSessionState.preferredTimeOfDay
      ?? parseTimeOfDayFromClock(proposalTime)
      ?? plannerMemory.preferredTimeOfDay
      ?? remoteProfile.preferredTimeOfDay
      ?? null;
    const preferredTimeReason = nextSessionState.preferredTimeReason
      ?? plannerMemory.preferredTimeReason
      ?? remoteProfile.preferredTimeReason
      ?? null;
    const reminderMinutesBefore = inferReminderMinutesFromProposal(proposal.kind, proposal.payload)
      ?? plannerMemory.reminderMinutesBefore
      ?? remoteProfile.reminderMinutesBefore
      ?? null;
    const cadenceKey = inferCadenceKeyFromProposal(proposal.kind, proposal.payload);
    const cadencePatterns = {
      ...(plannerMemory.cadencePatterns ?? {}),
    };

    if (cadenceKey) {
      cadencePatterns[cadenceKey] = (cadencePatterns[cadenceKey] ?? 0) + 1;
    }

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
  }, [plannerMemory, plannerMemoryQuery.data?.preferredWorkBlocks, tonePack, user?.id]);

  const submitMessage = useCallback(async (
    rawMessage: string,
    inputMode: CompanionPlannerMessage["inputMode"],
    options?: { skipUserEcho?: boolean },
  ) => {
    const message = rawMessage.trim();
    if (!message || isSubmitting) return;

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
      const classification = await classify(message);
      const classificationHint = normalizeClassificationHint(classification);
      const { data, error } = await supabase.functions.invoke("companion-planner-chat", {
        body: {
          message,
          currentDate: todayIso,
          currentDateTime: formatCurrentDateTimeWithOffset(new Date()),
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
          plannerContext,
        } satisfies CompanionPlannerRequest,
      });

      if (error) throw error;

      const response = data as CompanionPlannerResponse;
      const nextSession = applyMemoryUpdates(response.sessionState, response.memoryUpdates);
      const assistantMessage = appendAssistantTurn({
        ...response,
        sessionState: nextSession,
      });

      await persistPlannerThreadRows([
        ...(
          options?.skipUserEcho
            ? []
            : [{
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
        detectedIntent: response.sessionState.lastClassification ?? classification?.type,
        aiResponse: {
          reply: response.reply,
          questions: response.followUpQuestions.map((question) => question.field),
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
  }, [appendAssistantTurn, classify, conversationHistory, horizon, isSubmitting, persistPlannerThreadRows, plannerContext, sessionState, todayIso, tonePack, trackInteraction]);

  const handleConfirmProposal = useCallback(async (proposalId: string) => {
    const proposal = findProposalById(proposals, proposalId);
    if (!proposal) return;
    if (!proposal.readyToConfirm) {
      toast("I still need a bit more detail before I can save that.");
      return;
    }

    try {
      switch (proposal.kind) {
        case "create_quest": {
          const payload = proposal.payload as Parameters<typeof addTask>[0];
          await addTask(payload);
          await trackTaskCreation(
            payload.scheduledTime ?? null,
            payload.difficulty ?? "medium",
            payload.category,
            payload.taskText,
          );
          break;
        }
        case "update_quest": {
          const payload = proposal.payload as Parameters<typeof updateTask>[0];
          const previousTask = activeTasks.find((task) => task.id === payload.taskId)
            ?? inboxTasks.find((task) => task.id === payload.taskId);
          await updateTask(payload);
          const nextScheduledTime = typeof payload.updates?.scheduled_time === "string"
            ? payload.updates.scheduled_time
            : null;
          if (previousTask?.scheduled_time && nextScheduledTime && previousTask.scheduled_time !== nextScheduledTime) {
            await trackScheduleModification(previousTask.scheduled_time, nextScheduledTime, previousTask.difficulty ?? "medium");
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
            adjustmentType?: "extend_deadline" | "reduce_scope" | "add_habits" | "remove_habits" | "reschedule" | "custom";
            reason?: string | null;
          };

          const { data: adjustmentResult, error: adjustmentError } = await supabase.functions.invoke("adjust-epic-plan", {
            body: {
              epicId: payload.epicId,
              adjustmentType: payload.adjustmentType ?? "custom",
              reason: payload.reason ?? undefined,
              customRequest: payload.reason ?? undefined,
            },
          });

          if (adjustmentError) throw adjustmentError;

          const suggestions = Array.isArray((adjustmentResult as { suggestions?: unknown[] } | null)?.suggestions)
            ? (adjustmentResult as { suggestions: unknown[] }).suggestions
            : [];

          if (suggestions.length === 0) {
            throw new Error("No campaign adjustments were generated.");
          }

          const { error: applyError } = await supabase.functions.invoke("apply-epic-adjustments", {
            body: {
              epicId: payload.epicId,
              adjustments: suggestions,
              adjustmentType: payload.adjustmentType ?? "custom",
              reason: payload.reason ?? undefined,
            },
          });

          if (applyError) throw applyError;
          break;
        }
        case "create_ritual": {
          const payload = proposal.payload as Parameters<typeof createCampaignRitual>[0];
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
          await updateTask(payload);
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
            : candidate,
        ),
      );
      const confirmationMessage = createMessage("companion", `Saved: ${proposal.title}.`);
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
      await trackInteraction({
        interactionType: "companion_planner_confirmation",
        inputText: proposal.title,
        detectedIntent: proposal.kind,
        aiResponse: { proposalKind: proposal.kind },
        userAction: "accepted",
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
    proposals,
    renameEpic,
    saveRitual,
    sessionState,
    persistPlannerMemory,
    persistPlannerThreadRows,
    trackInteraction,
    trackScheduleModification,
    trackTaskCreation,
    updateTask,
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
          : candidate,
      ),
    );
    const rejectionMessage = createMessage("companion", `No problem. I won't save "${proposal.title}" as-is.`);
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
    await trackInteraction({
      interactionType: "companion_planner_confirmation",
      inputText: proposal.title,
      detectedIntent: proposal.kind,
      aiResponse: { proposalKind: proposal.kind },
      userAction: "rejected",
    });
  }, [persistPlannerThreadRows, proposals, trackInteraction]);

  const handleConfirmAll = useCallback(async () => {
    const readyProposals = proposals.filter((proposal) => proposal.status === "pending" && proposal.readyToConfirm);
    for (const proposal of readyProposals) {
      // Sequential saves keep the confirmation flow predictable and mutation-safe.
      await handleConfirmProposal(proposal.id);
    }
  }, [handleConfirmProposal, proposals]);

  const { isRecording, isAutoStopping, isSupported, permissionStatus, toggleRecording, requestPermission } = useVoiceInput({
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

  const readyProposalCount = pendingProposals.filter((proposal) => proposal.readyToConfirm).length;

  const resetThread = useCallback((options?: { sessionId?: string }) => {
    sessionIdRef.current = options?.sessionId ?? generateCompanionThreadSessionId();
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
    resetThread,
    hydrateThread,
    toggleRecording,
    requestMicrophonePermission,
    confirmProposal: handleConfirmProposal,
    rejectProposal: handleRejectProposal,
    confirmAll: handleConfirmAll,
    sessionState,
    plannerContext,
    plannerMemory,
    scheduleInsights,
    todayLabel: format(today, "EEEE, MMMM d"),
    isLoadingContext:
      todayTasksQuery.isLoading
      || weekTasksQuery.isLoading
      || monthTasksQuery.isLoading
      || activeEventsQuery.isLoading
      || contextEventsQuery.isLoading
      || plannerMemoryQuery.isLoading,
  };
}
