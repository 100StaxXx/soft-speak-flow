import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { format, addDays } from "date-fns";
import { motion, useReducedMotion } from "framer-motion";
import { Compass } from "lucide-react";
import { Haptics, ImpactStyle } from "@capacitor/haptics";
import { Capacitor } from "@capacitor/core";
import { App as CapacitorApp } from "@capacitor/app";
import { useLocation, useNavigate } from "react-router-dom";
import { PageTransition } from "@/components/PageTransition";
import { CinematicPageBackground } from "@/components/CinematicPageBackground";
import { TodaysAgenda } from "@/components/TodaysAgenda";
import { DesktopWeekPlanner } from "@/components/DesktopWeekPlanner";
import { cn } from "@/lib/utils";

import { DatePillsScroller } from "@/components/DatePillsScroller";
import { AddQuestSheet, AddQuestData } from "@/components/AddQuestSheet";
import type { QuestAttachmentInput } from "@/types/questAttachments";
import { PageInfoButton } from "@/components/PageInfoButton";
import { PageInfoModal } from "@/components/PageInfoModal";
import { StreakFreezePromptModal } from "@/components/StreakFreezePromptModal";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "@/components/ui/sonner";

import { EditQuestDialog } from "@/features/quests/components/EditQuestDialog";
import type { QuestComposerPrefillDraft } from "@/features/quests/types";
import { applySubtaskTitlePlan, normalizeSubtaskTitles } from "@/features/tasks/lib/subtaskWrites";
import { EditRitualSheet, RitualData } from "@/components/EditRitualSheet";
import { useResilience } from "@/contexts/ResilienceContext";
import { useDailyTasks } from "@/hooks/useDailyTasks";
import { useCalendarTasks } from "@/hooks/useCalendarTasks";
import type { DailyTask } from "@/services/dailyTasksRemote";
import { useStreakMultiplier } from "@/hooks/useStreakMultiplier";
import { useHabitSurfacing } from "@/hooks/useHabitSurfacing";
import { useRecurringTaskSpawner } from "@/hooks/useRecurringTaskSpawner";
import { useAuth } from "@/hooks/useAuth";
import { useProfile } from "@/hooks/useProfile";
import { useStreakAtRisk } from "@/hooks/useStreakAtRisk";

import { useOnboardingTaskCleanup } from "@/hooks/useOnboardingTaskCleanup";
import { useEpics } from "@/hooks/useEpics";
import { useInboxTasks } from "@/hooks/useInboxTasks";
import { useDeepLink } from "@/contexts/DeepLinkContext";
import { logger } from "@/utils/logger";

import { useAIInteractionTracker } from "@/hooks/useAIInteractionTracker";
import { QuickAdjustDrawer } from "@/components/SmartDayPlanner/components/QuickAdjustDrawer";

import { Pathfinder } from "@/components/Pathfinder";
import { CampaignCreatedAnimation } from "@/components/CampaignCreatedAnimation";
import { QuestsErrorBoundary } from "@/components/SectionErrorBoundary";

import { Wand2 } from "lucide-react";

import { useTaskCompletionWithInteraction, type InteractionType } from "@/hooks/useTaskCompletionWithInteraction";
import { InteractionLogModal } from "@/components/tasks/InteractionLogModal";
import { useQuestCalendarSync } from "@/hooks/useQuestCalendarSync";
import { useCalendarIntegrations } from "@/hooks/useCalendarIntegrations";
import { HourlyViewModal } from "@/components/HourlyViewModal";
import { JourneysCompanionPlannerModal } from "@/components/journeys/JourneysCompanionPlannerModal";
import { usePostOnboardingMentorGuidance } from "@/hooks/usePostOnboardingMentorGuidance";
import { getTodayIfDateStale, JOURNEYS_ROUTE } from "@/pages/journeysDateSync";
import { isOnboardingCleanupEligible } from "@/pages/journeysCleanupEligibility";
import { useMainTabVisibility } from "@/contexts/MainTabVisibilityContext";
import { SEND_TO_CALENDAR_ENABLED } from "@/utils/calendarFeatureFlags";
import { useJourneysLayoutMode } from "@/hooks/useJourneysLayoutMode";
import { isMacDesignedForIPadIOSApp, isMacSession } from "@/utils/platformTargets";
import { QuestInboxSection } from "@/components/QuestInboxSection";
import { QUEST_ACTION_TOAST_DURATION_MS } from "@/constants/questToast";
import { trackResilienceEvent } from "@/utils/resilienceTelemetry";
import { normalizeUuidLikeId } from "@/utils/offlineId";
import { parseNaturalLanguage } from "@/features/tasks/hooks/useNaturalLanguageParser";
import { buildVoiceQuestPrefillFromTranscript } from "@/features/quests/utils/voiceQuestPrefill";
import { resolveCampaignBuilderInitialGoal } from "@/shared/bigGoalIntent";
import { useVoiceInput } from "@/hooks/useVoiceInput";
import type {
  CompanionPlannerLaunchIntent,
  CompanionPlannerProposal,
  CompanionPlannerStarterIntent,
  PlannerBriefingContext,
} from "@/types/companionPlanner";

const TIME_24H_REGEX = /^([01]\d|2[0-3]):([0-5]\d)$/;
const DATE_INPUT_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const isQueuedTaskMutationResult = (
  value: unknown,
): value is { queued: true } => (
  typeof value === "object"
  && value !== null
  && "queued" in value
  && (value as { queued?: boolean }).queued === true
);

const asRecord = (value: unknown): Record<string, unknown> | null =>
  value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;

const asString = (value: unknown): string | null =>
  typeof value === "string" ? value : null;

const asNumber = (value: unknown): number | null =>
  typeof value === "number" && Number.isFinite(value) ? value : null;

const asBoolean = (value: unknown): boolean | null =>
  typeof value === "boolean" ? value : null;

const asNumberArray = (value: unknown): number[] =>
  Array.isArray(value)
    ? value.filter((entry): entry is number => typeof entry === "number" && Number.isFinite(entry))
    : [];

const asStringArray = (value: unknown): string[] =>
  Array.isArray(value)
    ? value.filter((entry): entry is string => typeof entry === "string")
    : [];

const isQuestProposalEditable = (proposal: CompanionPlannerProposal): boolean =>
  proposal.kind === "create_quest"
  || proposal.kind === "update_quest"
  || proposal.kind === "suggest_reminder";

const toEditableQuestTask = (
  task: Pick<DailyTask, "id" | "task_text"> & Partial<EditableQuestTask>,
): EditableQuestTask => ({
  id: task.id,
  task_text: task.task_text,
  task_date: task.task_date ?? null,
  difficulty: task.difficulty ?? "medium",
  scheduled_time: task.scheduled_time ?? null,
  estimated_duration: task.estimated_duration ?? 30,
  recurrence_pattern: task.recurrence_pattern ?? null,
  recurrence_days: task.recurrence_days ?? [],
  recurrence_month_days: task.recurrence_month_days ?? [],
  recurrence_custom_period: task.recurrence_custom_period ?? null,
  reminder_enabled: task.reminder_enabled ?? false,
  reminder_minutes_before: task.reminder_minutes_before ?? 15,
  category: task.category ?? null,
  notes: task.notes ?? null,
  habit_source_id: task.habit_source_id ?? null,
  image_url: task.image_url ?? null,
  attachments: task.attachments ?? [],
  location: task.location ?? null,
  subtasks: task.subtasks ?? [],
});

const buildCreateQuestPrefillDraft = (
  proposal: CompanionPlannerProposal,
): QuestComposerPrefillDraft | null => {
  if (proposal.kind !== "create_quest") return null;

  const payload = asRecord(proposal.payload);
  if (!payload) return null;

  return {
    text: asString(payload.taskText) ?? proposal.title,
    taskDate: asString(payload.taskDate),
    difficulty: (asString(payload.difficulty) as QuestComposerPrefillDraft["difficulty"]) ?? "medium",
    scheduledTime: asString(payload.scheduledTime),
    estimatedDuration: asNumber(payload.estimatedDuration) ?? 30,
    recurrencePattern: asString(payload.recurrencePattern),
    recurrenceDays: asNumberArray(payload.recurrenceDays),
    recurrenceMonthDays: asNumberArray(payload.recurrenceMonthDays),
    recurrenceCustomPeriod: (asString(payload.recurrenceCustomPeriod) as "week" | "month" | null) ?? null,
    reminderEnabled: asBoolean(payload.reminderEnabled) ?? false,
    reminderMinutesBefore: asNumber(payload.reminderMinutesBefore) ?? 15,
    moreInformation: asString(payload.notes),
    location: asString(payload.location),
    subtasks: normalizeSubtaskTitles(asStringArray(payload.subtasks)),
    creationSource: "nlp",
  };
};

const buildPlannerEditDraft = (
  task: EditableQuestTask,
  proposal: CompanionPlannerProposal,
): { task: EditableQuestTask; localSubtasks: string[] } | null => {
  if (proposal.kind !== "update_quest" && proposal.kind !== "suggest_reminder") {
    return null;
  }

  const payload = asRecord(proposal.payload);
  const updates = asRecord(payload?.updates) ?? {};
  const nextTask = toEditableQuestTask({
    ...task,
    task_text: asString(updates.task_text) ?? task.task_text,
    task_date: updates.task_date === null ? null : asString(updates.task_date) ?? task.task_date,
    difficulty: asString(updates.difficulty) ?? task.difficulty,
    scheduled_time: updates.scheduled_time === null ? null : asString(updates.scheduled_time) ?? task.scheduled_time,
    estimated_duration: updates.estimated_duration === null
      ? null
      : asNumber(updates.estimated_duration) ?? task.estimated_duration,
    recurrence_pattern: updates.recurrence_pattern === null
      ? null
      : asString(updates.recurrence_pattern) ?? task.recurrence_pattern,
    recurrence_days: Array.isArray(updates.recurrence_days)
      ? asNumberArray(updates.recurrence_days)
      : task.recurrence_days,
    recurrence_month_days: Array.isArray(updates.recurrence_month_days)
      ? asNumberArray(updates.recurrence_month_days)
      : task.recurrence_month_days,
    recurrence_custom_period: updates.recurrence_custom_period === null
      ? null
      : ((asString(updates.recurrence_custom_period) as "week" | "month" | null) ?? task.recurrence_custom_period),
    reminder_enabled: asBoolean(updates.reminder_enabled) ?? task.reminder_enabled,
    reminder_minutes_before: updates.reminder_minutes_before === null
      ? null
      : asNumber(updates.reminder_minutes_before) ?? task.reminder_minutes_before,
    category: updates.category === null ? null : asString(updates.category) ?? task.category,
    notes: updates.notes === null ? null : asString(updates.notes) ?? task.notes,
    image_url: updates.image_url === null ? null : asString(updates.image_url) ?? task.image_url,
    location: updates.location === null ? null : asString(updates.location) ?? task.location,
  });

  const baseSubtasks = normalizeSubtaskTitles(
    (task.subtasks ?? []).map((subtask) => subtask.title ?? ""),
  );

  if (proposal.kind !== "update_quest") {
    return {
      task: nextTask,
      localSubtasks: baseSubtasks,
    };
  }

  const subtaskPlan = asRecord(payload?.subtaskPlan);
  const mode = subtaskPlan?.mode === "append" || subtaskPlan?.mode === "replace"
    ? subtaskPlan.mode
    : null;
  const proposalSubtasks = normalizeSubtaskTitles(asStringArray(subtaskPlan?.titles));
  const localSubtasks = mode === "replace"
    ? proposalSubtasks
    : normalizeSubtaskTitles([...baseSubtasks, ...proposalSubtasks]);

  return {
    task: nextTask,
    localSubtasks,
  };
};

interface CreatedCampaignData {
  title: string;
  habits: Array<{ title: string }>;
}

type EditableQuestTask = Pick<
  DailyTask,
  | "id"
  | "task_text"
  | "task_date"
  | "difficulty"
  | "scheduled_time"
  | "estimated_duration"
  | "recurrence_pattern"
  | "recurrence_days"
  | "recurrence_month_days"
  | "recurrence_custom_period"
  | "reminder_enabled"
  | "reminder_minutes_before"
  | "category"
  | "notes"
  | "habit_source_id"
  | "image_url"
  | "attachments"
  | "location"
  | "subtasks"
>;

type PlannerQuestEditSessionResult = {
  saved: boolean;
  savedTitle?: string | null;
};

type PlannerQuestEditSession =
  | {
      proposalId: string;
      editor: "create";
      prefillDraft: QuestComposerPrefillDraft;
      prefillKey: string;
    }
  | {
      proposalId: string;
      editor: "update";
      localSubtasks: string[];
    };

type DesktopPlannerMode = "week" | "day";
const MAC_TIMED_TASK_DURATION_FALLBACK_MINUTES = 30;
const createPlannerLaunchIntentId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

const Journeys = () => {
  const prefersReducedMotion = useReducedMotion();
  const location = useLocation();
  const navigate = useNavigate();
  const { isTabActive } = useMainTabVisibility();
  const journeysLayoutMode = useJourneysLayoutMode();
  const isDesktopLayout = journeysLayoutMode === "desktop";
  const isMacHostedIOSApp = useMemo(() => isMacDesignedForIPadIOSApp(), []);
  const isMacDesktopSession = useMemo(() => isMacSession(), []);
  const macTimedTaskDurationFallbackMinutes = isMacDesktopSession
    ? MAC_TIMED_TASK_DURATION_FALLBACK_MINUTES
    : undefined;
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [showPageInfo, setShowPageInfo] = useState(false);
  const [showAddSheet, setShowAddSheet] = useState(false);
  const [isCompanionPlannerPinned, setIsCompanionPlannerPinned] = useState(false);
  const [plannerLaunchIntent, setPlannerLaunchIntent] = useState<CompanionPlannerLaunchIntent | null>(null);
  const [showMonthView, setShowMonthView] = useState(false);
  const [desktopPlannerMode, setDesktopPlannerMode] = useState<DesktopPlannerMode>("week");
  
  const [prefilledTime, setPrefilledTime] = useState<string | null>(null);
  const [questSheetPrefillDraft, setQuestSheetPrefillDraft] = useState<QuestComposerPrefillDraft | null>(null);
  const [questSheetPrefillKey, setQuestSheetPrefillKey] = useState<string | null>(null);
  const [showQuickAdjust, setShowQuickAdjust] = useState(false);
  
  // Campaign creation state
  const [showPathfinder, setShowPathfinder] = useState(false);
  const [pathfinderInitialGoal, setPathfinderInitialGoal] = useState("");
  const [pathfinderSessionKey, setPathfinderSessionKey] = useState(0);
  const [showCreatedAnimation, setShowCreatedAnimation] = useState(false);
  const [createdCampaignData, setCreatedCampaignData] = useState<CreatedCampaignData | null>(null);
  const [isInboxExpanded, setIsInboxExpanded] = useState(false);
  const previousIsTabActiveRef = useRef(isTabActive);
  const scheduledTimeUpdateQueueRef = useRef<Map<string, Promise<void>>>(new Map());
  const inboxSectionRef = useRef<HTMLDivElement | null>(null);
  const hasInitializedInboxVisibilityRef = useRef(false);
  const { isActive: tutorialActive, currentStep: tutorialStep, currentSubstep: tutorialSubstep } =
    usePostOnboardingMentorGuidance();
  const shouldAutoFillTutorialTime =
    tutorialActive && tutorialStep === "create_quest" && tutorialSubstep === "select_time";
  const isInboxRequested = useMemo(
    () => new URLSearchParams(location.search).get("section") === "inbox",
    [location.search],
  );
  
  // Auth and profile for onboarding
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { queueAction, shouldQueueWrites, retryNow } = useResilience();
  const { profile, loading: profileLoading } = useProfile();
  
  // Streak freeze
  const { 
    needsStreakDecision, 
    currentStreak: freezeStreak, 
    freezesAvailable, 
    useFreeze, 
    resetStreak, 
    isResolving 
  } = useStreakAtRisk();

  // Edit quest state (for regular quests)
  const [editingTask, setEditingTask] = useState<EditableQuestTask | null>(null);
  const [plannerQuestEditSession, setPlannerQuestEditSession] = useState<PlannerQuestEditSession | null>(null);
  const plannerQuestEditResolverRef = useRef<((result: PlannerQuestEditSessionResult) => void) | null>(null);

  // Edit ritual state (for tasks linked to habits)
  const [editingRitual, setEditingRitual] = useState<RitualData | null>(null);
  const finishPlannerQuestEdit = useCallback((result: PlannerQuestEditSessionResult) => {
    const resolver = plannerQuestEditResolverRef.current;
    plannerQuestEditResolverRef.current = null;
    setPlannerQuestEditSession(null);
    resolver?.(result);
  }, []);

  const handleAddQuestSheetOpenChange = useCallback((nextOpen: boolean) => {
    setShowAddSheet(nextOpen);
    if (!nextOpen) {
      setPrefilledTime(null);
      setQuestSheetPrefillDraft(null);
      setQuestSheetPrefillKey(null);
      if (plannerQuestEditSession?.editor === "create") {
        finishPlannerQuestEdit({ saved: false });
      }
    }
  }, [finishPlannerQuestEdit, plannerQuestEditSession?.editor]);

  const openAddQuestSheet = useCallback((options?: {
    date?: Date;
    time?: string | null;
    prefillDraft?: QuestComposerPrefillDraft | null;
    prefillKey?: string | null;
  }) => {
    if (options?.date) {
      setSelectedDate(options.date);
    }
    setPrefilledTime(options?.time ?? options?.prefillDraft?.scheduledTime ?? null);
    setQuestSheetPrefillDraft(options?.prefillDraft ?? null);
    setQuestSheetPrefillKey(options?.prefillKey ?? null);
    setShowAddSheet(true);
  }, []);

  const handleEditQuestDialogOpenChange = useCallback((nextOpen: boolean) => {
    if (nextOpen) return;
    setEditingTask(null);
    if (plannerQuestEditSession?.editor === "update") {
      finishPlannerQuestEdit({ saved: false });
    }
  }, [finishPlannerQuestEdit, plannerQuestEditSession?.editor]);

  const openCampaignBuilder = useCallback((initialGoal?: string | null) => {
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("campaign-builder-opened"));
    }
    setPathfinderInitialGoal(initialGoal?.trim() ?? "");
    setPathfinderSessionKey((currentKey) => currentKey + 1);
    setShowPathfinder(true);
  }, []);

  const openCompanionPlanner = useCallback((intent?: CompanionPlannerLaunchIntent | null) => {
    if (intent) {
      if (intent.target === "campaign_builder") {
        openCampaignBuilder(resolveCampaignBuilderInitialGoal(intent.message, undefined));
        return;
      }
      setPlannerLaunchIntent(intent);
    }
    setIsCompanionPlannerPinned(true);
  }, [openCampaignBuilder]);

  const launchPlannerIntent = useCallback((
    message: string,
    starterIntent: CompanionPlannerStarterIntent,
    options?: { briefingContext?: PlannerBriefingContext | null },
  ) => {
    setPlannerLaunchIntent({
      id: createPlannerLaunchIntentId(),
      message,
      starterIntent,
      target: "planner",
      briefingContext: options?.briefingContext ?? null,
    });
    setIsCompanionPlannerPinned(true);
  }, []);

  const {
    isRecording: isVoiceAddRecording,
    isSupported: isVoiceAddSupported,
    toggleRecording: toggleVoiceAddRecording,
  } = useVoiceInput({
    onFinalResult: (transcript) => {
      const cleanedTranscript = transcript.trim();
      if (!cleanedTranscript) return;

      const prefillDraft = buildVoiceQuestPrefillFromTranscript(cleanedTranscript);
      const nextSelectedDate = prefillDraft.taskDate
        ? new Date(`${prefillDraft.taskDate}T00:00:00`)
        : selectedDate;

      openAddQuestSheet({
        date: nextSelectedDate,
        time: prefillDraft.scheduledTime ?? null,
        prefillDraft,
        prefillKey: createPlannerLaunchIntentId(),
      });
    },
    onError: (message) => {
      toast.error(message);
    },
    onPermissionNeeded: () => {
      toast.error("Microphone access is required for voice capture.");
    },
    language: "en-US",
    autoStopOnSilence: true,
  });

  const openCampaignBuilderFromAssistant = useCallback((message: string) => {
    const parsed = parseNaturalLanguage(message);
    const initialGoal = resolveCampaignBuilderInitialGoal(message, parsed.text);

    setPlannerLaunchIntent(null);
    setIsCompanionPlannerPinned(false);
    openCampaignBuilder(initialGoal);
  }, [openCampaignBuilder]);

  const handlePathfinderOpenChange = useCallback((nextOpen: boolean) => {
    setShowPathfinder(nextOpen);
    if (!nextOpen) {
      setPathfinderInitialGoal("");
    }
  }, []);

  const syncSelectedDateToTodayIfStale = useCallback(() => {
    if (showAddSheet) return;
    setSelectedDate((currentDate) => getTodayIfDateStale(currentDate));
  }, [showAddSheet]);

  useEffect(() => {
    if (isTabActive && !previousIsTabActiveRef.current) {
      syncSelectedDateToTodayIfStale();
    }
    previousIsTabActiveRef.current = isTabActive;
  }, [isTabActive, syncSelectedDateToTodayIfStale]);

  useEffect(() => {
    if (!isTabActive) return;
    if (Capacitor.isNativePlatform()) return;

    const handleVisibilityChange = () => {
      if (document.visibilityState !== "visible") return;
      syncSelectedDateToTodayIfStale();
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [isTabActive, syncSelectedDateToTodayIfStale]);

  useEffect(() => {
    if (!isTabActive) return;
    if (!Capacitor.isNativePlatform()) return;

    let isDisposed = false;
    let listenerHandle: { remove: () => Promise<void> } | null = null;

    const setupListener = async () => {
      const handle = await CapacitorApp.addListener("appStateChange", ({ isActive }) => {
        if (!isActive) return;
        syncSelectedDateToTodayIfStale();
      });

      if (isDisposed) {
        await handle.remove();
        return;
      }

      listenerHandle = handle;
    };

    void setupListener();

    return () => {
      isDisposed = true;
      if (listenerHandle) {
        void listenerHandle.remove();
      }
    };
  }, [isTabActive, syncSelectedDateToTodayIfStale]);

  // Combo tracking
  
  
  // AI interaction tracking
  const { trackDailyPlanOutcome } = useAIInteractionTracker();
  
  // Epics for plan my day questions and campaign strip
  const { epics, isLoading: epicsLoading, createEpic, isCreating: isCreatingCampaign } = useEpics({ enabled: isTabActive });
  const activeEpics = useMemo(() =>
    epics?.filter(e => e.status === 'active').slice(0, 5) || [],
    [epics]
  );
  
  const { currentStreak } = useStreakMultiplier();
  const { sendTaskToCalendar, syncTaskUpdate, syncTaskDelete, syncProviderPull, hasLinkedEvent } = useQuestCalendarSync({
    enabled: isTabActive,
  });
  const { connections: calendarConnections } = useCalendarIntegrations({ enabled: isTabActive });
  
  // Contact interaction logging
  const {
    pendingInteraction,
    isModalOpen: isInteractionModalOpen,
    handleTaskCompleted,
    logInteraction,
    skipInteraction,
    closeModal: closeInteractionModal,
  } = useTaskCompletionWithInteraction();

  const { 
    tasks: dailyTasks,
    isLoading: dailyTasksLoading,
    addTask,
    toggleTask,
    updateTask,
    deleteTask,
    restoreTask,
    moveTaskToDate,
    completedCount,
    totalCount,
    isAdding,
    isUpdating,
    isDeleting
  } = useDailyTasks(selectedDate, { enabled: isTabActive });
  const {
    inboxTasks,
    inboxCount,
    isLoading: inboxLoading,
    toggleInboxTask,
    deleteInboxTask,
  } = useInboxTasks({ enabled: isTabActive });
  
  
  const isPlannerCreateQuestEditActive = plannerQuestEditSession?.editor === "create";
  const isPlannerUpdateQuestEditActive = plannerQuestEditSession?.editor === "update";
  const isCompanionPlannerBlocked = (showAddSheet && !isPlannerCreateQuestEditActive)
    || showMonthView
    || showPageInfo
    || showQuickAdjust
    || showPathfinder
    || (!!editingTask && !isPlannerUpdateQuestEditActive)
    || !!editingRitual
    || needsStreakDecision
    || isInteractionModalOpen;
  const showCompanionPlanner = isCompanionPlannerPinned && !isCompanionPlannerBlocked;
  const desktopInteractionResetKey = useMemo(
    () => [
      format(selectedDate, "yyyy-MM-dd"),
      desktopPlannerMode,
      showAddSheet ? "add-open" : "add-closed",
      showMonthView ? "month-open" : "month-closed",
      editingTask?.id ?? "no-edit-task",
      editingRitual?.taskId ?? "no-edit-ritual",
    ].join("|"),
    [desktopPlannerMode, editingRitual?.taskId, editingTask?.id, selectedDate, showAddSheet, showMonthView],
  );
  const { tasks: allCalendarTasks } = useCalendarTasks(selectedDate, "month", { enabled: isTabActive });
  const { tasks: weekCalendarTasks } = useCalendarTasks(selectedDate, "week", { enabled: isTabActive });

  useEffect(() => {
    if (hasInitializedInboxVisibilityRef.current) return;
    if (inboxLoading && !isInboxRequested && inboxCount === 0) return;

    setIsInboxExpanded(isInboxRequested || inboxCount > 0);
    hasInitializedInboxVisibilityRef.current = true;
  }, [inboxCount, inboxLoading, isInboxRequested]);

  useEffect(() => {
    if (!isInboxRequested) return;

    setIsInboxExpanded(true);
    const frameId = window.requestAnimationFrame(() => {
      inboxSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    });

    return () => {
      window.cancelAnimationFrame(frameId);
    };
  }, [isInboxRequested]);

  useEffect(() => () => {
    const resolver = plannerQuestEditResolverRef.current;
    plannerQuestEditResolverRef.current = null;
    resolver?.({ saved: false });
  }, []);

  useEffect(() => {
    const routeState = (location.state as { companionPlannerLaunchIntent?: CompanionPlannerLaunchIntent | null } | null) ?? null;
    const nextLaunchIntent = routeState?.companionPlannerLaunchIntent ?? null;
    if (!nextLaunchIntent?.id) return;

    openCompanionPlanner(nextLaunchIntent);

    const nextState = {
      ...(routeState ?? {}),
      companionPlannerLaunchIntent: null,
    };

    navigate(
      {
        pathname: location.pathname,
        search: location.search,
      },
      {
        replace: true,
        state: nextState,
      },
    );
  }, [location.pathname, location.search, location.state, navigate, openCompanionPlanner]);

  useEffect(() => {
    if (!isMacHostedIOSApp || location.pathname !== JOURNEYS_ROUTE) return;

    const isEditableTarget = (target: EventTarget | null): boolean => {
      if (!(target instanceof HTMLElement)) return false;
      if (target.isContentEditable) return true;
      return !!target.closest('input, textarea, select, [contenteditable="true"]');
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented) return;
      if (!event.metaKey || event.ctrlKey || event.altKey || event.shiftKey) return;
      if (event.key.toLowerCase() !== "n") return;
      if (
        showAddSheet
        || showCompanionPlanner
        || showMonthView
        || showPageInfo
        || showQuickAdjust
        || showPathfinder
        || !!editingTask
        || !!editingRitual
        || needsStreakDecision
        || isInteractionModalOpen
      ) {
        return;
      }

      const activeElement = document.activeElement;
      if (isEditableTarget(event.target) || isEditableTarget(activeElement)) {
        return;
      }

      event.preventDefault();
      openAddQuestSheet();
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [
    editingRitual,
    editingTask,
    isInteractionModalOpen,
    isMacHostedIOSApp,
    location.pathname,
    needsStreakDecision,
    openAddQuestSheet,
    showAddSheet,
    showCompanionPlanner,
    showMonthView,
    showPageInfo,
    showPathfinder,
    showQuickAdjust,
  ]);
  
  // Habit surfacing - auto-surface ALL active habits (not just epic-linked) as daily tasks
  const { surfaceAllEpicHabits, unsurfacedEpicHabitsCount } = useHabitSurfacing(selectedDate);
  
  // Recurring task spawner - auto-spawn tasks with is_recurring = true
  const { pendingRecurringCount, spawnRecurringTasks } = useRecurringTaskSpawner(selectedDate);
  
  // Auto-surface habits and spawn recurring tasks (with ref to prevent infinite loop)
  const hasSurfacedRef = useRef(false);
  const lastSurfacedHabitCountRef = useRef(0);
  const hasSpawnedRecurringRef = useRef(false);
  const dateKeyRef = useRef(format(selectedDate, 'yyyy-MM-dd'));

  useEffect(() => {
    if (!isTabActive) return;
    const currentDateKey = format(selectedDate, 'yyyy-MM-dd');
    
    // Reset if date changed
    if (dateKeyRef.current !== currentDateKey) {
      dateKeyRef.current = currentDateKey;
      hasSurfacedRef.current = false;
      lastSurfacedHabitCountRef.current = 0;
      hasSpawnedRecurringRef.current = false;
    }
    
    if (unsurfacedEpicHabitsCount === 0) {
      hasSurfacedRef.current = false;
      lastSurfacedHabitCountRef.current = 0;
    }

    // Surface habits when a date first loads and again if new habits appear later that same day.
    if (
      unsurfacedEpicHabitsCount > 0 &&
      (
        !hasSurfacedRef.current ||
        unsurfacedEpicHabitsCount > lastSurfacedHabitCountRef.current
      )
    ) {
      hasSurfacedRef.current = true;
      lastSurfacedHabitCountRef.current = unsurfacedEpicHabitsCount;
      surfaceAllEpicHabits();
    }
    
    // Spawn recurring tasks once per date
    if (pendingRecurringCount > 0 && !hasSpawnedRecurringRef.current) {
      hasSpawnedRecurringRef.current = true;
      spawnRecurringTasks();
    }
  }, [isTabActive, unsurfacedEpicHabitsCount, pendingRecurringCount, selectedDate, surfaceAllEpicHabits, spawnRecurringTasks]);
  
  // Cleanup legacy onboarding pseudo-quests for users who completed onboarding
  // and/or walkthrough, once profile state has resolved.
  const onboardingData = (profile?.onboarding_data as Record<string, unknown> | null) ?? null;
  const cleanupEligible = isOnboardingCleanupEligible(
    profileLoading,
    profile?.onboarding_completed,
    onboardingData
  );
  useOnboardingTaskCleanup(user?.id, cleanupEligible, profileLoading);
  
  const handleEditQuest = useCallback(async (task: {
    id: string;
    task_text: string;
    task_date?: string | null;
    difficulty?: string | null;
    scheduled_time?: string | null;
    estimated_duration?: number | null;
    recurrence_pattern?: string | null;
    recurrence_days?: number[] | null;
    recurrence_month_days?: number[] | null;
    recurrence_custom_period?: "week" | "month" | null;
    reminder_enabled?: boolean | null;
    reminder_minutes_before?: number | null;
    category?: string | null;
    notes?: string | null;
    habit_source_id?: string | null;
    image_url?: string | null;
    attachments?: DailyTask["attachments"] | null;
    location?: string | null;
    subtasks?: DailyTask["subtasks"] | null;
  }) => {
    // Route to the appropriate editor based on whether it's a ritual
    if (task.habit_source_id) {
      // Fetch habit data to get frequency and custom_days (source of truth)
      const { data: habit } = await supabase
        .from('habits')
        .select('frequency, custom_days, custom_month_days, description')
        .eq('id', task.habit_source_id)
        .maybeSingle();
      
      // This is a ritual - open the unified ritual editor
      setEditingRitual({
        habitId: task.habit_source_id,
        taskId: task.id,
        title: task.task_text,
        description: habit?.description || null,
        difficulty: task.difficulty || 'medium',
        frequency: habit?.frequency || 'daily',
        custom_days: habit?.custom_days || [],
        custom_month_days: habit?.custom_month_days || [],
        estimated_minutes: task.estimated_duration,
        preferred_time: task.scheduled_time,
        category: task.category as 'mind' | 'body' | 'soul' | null,
        recurrence_pattern: task.recurrence_pattern,
        recurrence_days: task.recurrence_days,
        recurrence_month_days: task.recurrence_month_days,
        recurrence_custom_period: task.recurrence_custom_period,
        reminder_enabled: task.reminder_enabled,
        reminder_minutes_before: task.reminder_minutes_before,
      });
    } else {
      // Regular quest - use the standard edit dialog
      setEditingTask(toEditableQuestTask(task));
    }
  }, []);

  const handleQuestProposalEditHandoff = useCallback(async (
    proposal: CompanionPlannerProposal,
  ): Promise<PlannerQuestEditSessionResult> => {
    if (!isQuestProposalEditable(proposal)) {
      return { saved: false };
    }

    if (plannerQuestEditSession?.editor === "create") {
      setShowAddSheet(false);
    }
    if (plannerQuestEditSession?.editor === "update") {
      setEditingTask(null);
    }
    finishPlannerQuestEdit({ saved: false });

    if (proposal.kind === "create_quest") {
      const prefillDraft = buildCreateQuestPrefillDraft(proposal);
      if (!prefillDraft) {
        toast.error("Couldn't open that quest edit right now.");
        return { saved: false };
      }

      const promise = new Promise<PlannerQuestEditSessionResult>((resolve) => {
        plannerQuestEditResolverRef.current = resolve;
      });

      setPlannerQuestEditSession({
        proposalId: proposal.id,
        editor: "create",
        prefillDraft,
        prefillKey: `${proposal.id}:${Date.now()}`,
      });
      setPrefilledTime(null);
      setShowAddSheet(true);
      return promise;
    }

    const payload = asRecord(proposal.payload);
    const taskId = asString(payload?.taskId);
    if (!taskId) {
      toast.error("Couldn't find the quest tied to that edit.");
      return { saved: false };
    }

    const sourceTask = [...dailyTasks, ...inboxTasks].find((task) => task.id === taskId);
    if (!sourceTask) {
      toast.error("That quest isn't available to edit right now.");
      return { saved: false };
    }

    const nextDraft = buildPlannerEditDraft(toEditableQuestTask(sourceTask), proposal);
    if (!nextDraft) {
      toast.error("Couldn't open that quest edit right now.");
      return { saved: false };
    }

    const promise = new Promise<PlannerQuestEditSessionResult>((resolve) => {
      plannerQuestEditResolverRef.current = resolve;
    });

    setPlannerQuestEditSession({
      proposalId: proposal.id,
      editor: "update",
      localSubtasks: nextDraft.localSubtasks,
    });
    setEditingTask(nextDraft.task);
    return promise;
  }, [dailyTasks, finishPlannerQuestEdit, inboxTasks, plannerQuestEditSession?.editor]);

  // Deep link handling - open task from widget tap
  const { pendingTaskId, clearPendingTask } = useDeepLink();
  const deepLinkProcessedRef = useRef<string | null>(null);
  
  useEffect(() => {
    if (!isTabActive) return;
    // Skip if no pending task or already processed this task
    if (!pendingTaskId || deepLinkProcessedRef.current === pendingTaskId) {
      return;
    }
    
    // Wait for tasks query to resolve
    if (dailyTasksLoading) {
      return;
    }
    
    // Find the task in today's tasks
    const task = dailyTasks.find(t => t.id === pendingTaskId);
    
    if (task) {
      logger.log('[Journeys] Opening deep-linked task:', pendingTaskId);
      deepLinkProcessedRef.current = pendingTaskId;
      handleEditQuest(task);
      clearPendingTask();
    } else {
      // Task not found in today's list - might be on a different day
      logger.log('[Journeys] Deep link task not found in daily tasks:', pendingTaskId);
      deepLinkProcessedRef.current = pendingTaskId;
      clearPendingTask();
    }
  }, [isTabActive, pendingTaskId, dailyTasks, dailyTasksLoading, clearPendingTask, handleEditQuest]);
  
  const tasksPerDay = useMemo(() => {
    const map: Record<string, number> = {};
    allCalendarTasks.forEach((task: { task_date?: string | null }) => {
      if (!task.task_date) return;
      map[task.task_date] = (map[task.task_date] || 0) + 1;
    });
    return map;
  }, [allCalendarTasks]);

  const handleSendTaskToCalendar = useCallback(async (taskId: string) => {
    const routeToCalendarPreferences = () => {
      toast.error("No calendar connected. Opening Preferences...");
      navigate("/profile", { state: { openTab: "preferences" } });
    };

    if (calendarConnections.length === 0) {
      routeToCalendarPreferences();
      return;
    }

    let taskDateOverride: string | undefined;
    let scheduledTimeOverride: string | undefined;

    const attempt = async () => {
      await sendTaskToCalendar.mutateAsync({
        taskId,
        options: taskDateOverride || scheduledTimeOverride
          ? {
              taskDate: taskDateOverride,
              scheduledTime: scheduledTimeOverride,
            }
          : undefined,
      });
    };

    try {
      await attempt();
      toast.success("Quest synced to calendar");
      return;
    } catch (error) {
      let message = error instanceof Error ? error.message : "Failed to send quest to calendar";
      if (message.includes("MULTI_DAY_MONTHLY_UNSUPPORTED")) {
        toast.error("Calendar sync doesn't support multi-day monthly recurrence yet.");
        return;
      }
      if (message.includes("NO_CALENDAR_CONNECTION")) {
        routeToCalendarPreferences();
        return;
      }

      for (let attemptIndex = 0; attemptIndex < 2; attemptIndex += 1) {
        if (message.includes("NO_CALENDAR_CONNECTION")) {
          routeToCalendarPreferences();
          return;
        }

        if (message.includes("TASK_DATE_REQUIRED") && !taskDateOverride) {
          const pickedDate = window.prompt(
            "Choose a date to send this quest (YYYY-MM-DD)",
            format(selectedDate, "yyyy-MM-dd"),
          );
          if (!pickedDate || !DATE_INPUT_REGEX.test(pickedDate)) {
            toast.error("Calendar send cancelled. Please choose a valid YYYY-MM-DD date.");
            return;
          }
          taskDateOverride = pickedDate;
        }

        if ((message.includes("SCHEDULED_TIME_REQUIRED") || message.includes("SCHEDULED_TIME_INVALID")) && !scheduledTimeOverride) {
          const pickedTime = window.prompt("Choose a time to send this quest (HH:mm)", "09:00");
          if (!pickedTime || !TIME_24H_REGEX.test(pickedTime)) {
            toast.error("Calendar send cancelled. Please choose a valid HH:mm time.");
            return;
          }
          scheduledTimeOverride = pickedTime;
        }

        try {
          await attempt();
          toast.success("Quest synced to calendar");
          return;
        } catch (retryError) {
          message = retryError instanceof Error ? retryError.message : "Failed to send quest to calendar";
          if (message.includes("MULTI_DAY_MONTHLY_UNSUPPORTED")) {
            toast.error("Calendar sync doesn't support multi-day monthly recurrence yet.");
            return;
          }
          if (message.includes("NO_CALENDAR_CONNECTION")) {
            routeToCalendarPreferences();
            return;
          }
          if (
            !message.includes("TASK_DATE_REQUIRED")
            && !message.includes("SCHEDULED_TIME_REQUIRED")
            && !message.includes("SCHEDULED_TIME_INVALID")
          ) {
            toast.error(message);
            return;
          }
        }
      }

      if (message.includes("TASK_DATE_REQUIRED")) {
        toast.error("Please assign a date before sending this quest to calendar.");
        return;
      }

      if (message.includes("SCHEDULED_TIME_REQUIRED") || message.includes("SCHEDULED_TIME_INVALID")) {
        toast.error("Please assign a time before sending this quest to calendar.");
        return;
      }

      toast.error(message);
    }
  }, [calendarConnections.length, navigate, selectedDate, sendTaskToCalendar]);

  const handleAddQuest = useCallback(async (data: AddQuestData) => {
    const taskDate = data.sendToInbox
      ? null
      : (data.taskDate ?? format(selectedDate, 'yyyy-MM-dd'));

    const createdTask = await addTask({
      taskText: data.text,
      difficulty: data.difficulty,
      source: data.creationSource,
      taskDate: taskDate,
      isMainQuest: false,
      scheduledTime: data.scheduledTime,
      estimatedDuration: data.estimatedDuration,
      recurrencePattern: data.recurrencePattern,
      recurrenceDays: data.recurrenceDays,
      reminderEnabled: data.reminderEnabled,
      reminderMinutesBefore: data.reminderMinutesBefore,
      notes: data.moreInformation,
      location: data.location,
      contactId: data.contactId,
      autoLogInteraction: data.autoLogInteraction,
      recurrenceMonthDays: data.recurrenceMonthDays,
      recurrenceCustomPeriod: data.recurrenceCustomPeriod,
      subtasks: data.subtasks,
      imageUrl: data.imageUrl,
      attachments: data.attachments,
    });

    if (plannerQuestEditSession?.editor === "create") {
      finishPlannerQuestEdit({
        saved: true,
        savedTitle: data.text.trim() || null,
      });
    }

    setShowAddSheet(false);

    if (SEND_TO_CALENDAR_ENABLED && data.sendToCalendar && createdTask?.id) {
      const calendarSyncStartedAt = Date.now();
      void handleSendTaskToCalendar(createdTask.id).finally(() => {
        trackResilienceEvent("task_create_calendar_sync", {
          taskId: createdTask.id,
          calendarSyncMs: Date.now() - calendarSyncStartedAt,
        });
      });
    }
    if (data.sendToInbox) {
      setIsInboxExpanded(true);
      window.requestAnimationFrame(() => {
        inboxSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    }
  }, [selectedDate, addTask, finishPlannerQuestEdit, handleSendTaskToCalendar, plannerQuestEditSession?.editor]);

  const handleToggleTask = useCallback((taskId: string, completed: boolean, xpReward: number, taskData?: { scheduled_time?: string | null; difficulty?: string | null; category?: string | null; ai_generated?: boolean | null; task_text?: string | null }) => {
    if (completed) {
      // Track for AI learning (only for AI-generated tasks)
      if (taskData?.ai_generated) {
        trackDailyPlanOutcome(taskId, 'completed', {
          scheduledTime: taskData.scheduled_time ?? undefined,
          difficulty: taskData.difficulty ?? undefined,
          category: taskData.category ?? undefined,
          wasOnTime: true,
        });
      }
    }
    toggleTask({ taskId, completed, xpReward }, {
      onSuccess: (result) => {
        // If completed and has a contact with auto-log enabled, trigger interaction modal
        if (result.completed && result.contact && result.autoLogInteraction) {
          handleTaskCompleted(
            result.taskId,
            result.taskText,
            result.contact,
            result.autoLogInteraction
          );
        }
      },
    });
  }, [toggleTask, trackDailyPlanOutcome, handleTaskCompleted]);
  
  const handleUndoToggle = useCallback((taskId: string, xpReward: number) => {
    toggleTask({ taskId, completed: false, xpReward, forceUndo: true });
  }, [toggleTask]);
  
  const handleSaveEdit = useCallback(async (taskId: string, updates: {
    task_text: string;
    task_date: string | null;
    difficulty: string;
    scheduled_time: string | null;
    estimated_duration: number | null;
    recurrence_pattern: string | null;
    recurrence_days: number[];
    recurrence_month_days: number[];
    recurrence_custom_period: "week" | "month" | null;
    reminder_enabled: boolean;
    reminder_minutes_before: number;
    notes: string | null;
    category: string | null;
    image_url: string | null;
    location: string | null;
    attachments?: QuestAttachmentInput[];
    subtasks?: string[];
  }) => {
    const { subtasks: nextSubtasks, ...taskUpdates } = updates;
    const updateResult = await updateTask({ taskId, updates: taskUpdates });
    if (!isQueuedTaskMutationResult(updateResult)) {
      await syncTaskUpdate.mutateAsync({ taskId }).catch((error) => {
        const message = error instanceof Error ? error.message : "";
        if (message.includes("MULTI_DAY_MONTHLY_UNSUPPORTED")) {
          toast.error("Calendar sync doesn't support multi-day monthly recurrence yet.");
          return;
        }
        toast.error("Saved quest, but failed to sync linked calendar event");
      });
    }
    if (Array.isArray(nextSubtasks) && user?.id) {
      await applySubtaskTitlePlan({
        mode: "replace",
        taskId,
        userId: user.id,
        titles: nextSubtasks,
        shouldQueueWrites,
        queueAction,
        retryNow,
      });
      queryClient.invalidateQueries({ queryKey: ["subtasks", normalizeUuidLikeId(taskId)] });
      queryClient.invalidateQueries({ queryKey: ["daily-tasks"] });
      queryClient.invalidateQueries({ queryKey: ["calendar-tasks"] });
      queryClient.invalidateQueries({ queryKey: ["inbox-tasks"] });
    }
    queryClient.invalidateQueries({ queryKey: ["inbox-tasks"] });
    queryClient.invalidateQueries({ queryKey: ["inbox-count"] });
    if (plannerQuestEditSession?.editor === "update") {
      finishPlannerQuestEdit({
        saved: true,
        savedTitle: updates.task_text.trim() || null,
      });
    }
    setEditingTask(null);
  }, [
    finishPlannerQuestEdit,
    plannerQuestEditSession?.editor,
    queryClient,
    queueAction,
    retryNow,
    shouldQueueWrites,
    syncTaskUpdate,
    updateTask,
    user?.id,
  ]);

  const handleTimelineScheduledTimeUpdate = useCallback((taskId: string, newTime: string) => {
    const previousTaskUpdate = scheduledTimeUpdateQueueRef.current.get(taskId) ?? Promise.resolve();
    const nextTaskUpdate = previousTaskUpdate
      .catch(() => undefined)
      .then(async () => {
        const updateResult = await updateTask({ taskId, updates: { scheduled_time: newTime } });
        if (isQueuedTaskMutationResult(updateResult)) {
          return;
        }

        await syncTaskUpdate.mutateAsync({ taskId }).catch((error) => {
          const message = error instanceof Error ? error.message : "";
          if (message.includes("MULTI_DAY_MONTHLY_UNSUPPORTED")) {
            toast.error("Calendar sync doesn't support multi-day monthly recurrence yet.");
          }
        });
      })
      .catch((error) => {
        logger.warn("Failed to update quest scheduled time from timeline drag", {
          taskId,
          error: error instanceof Error ? error.message : String(error),
        });
      })
      .finally(() => {
        if (scheduledTimeUpdateQueueRef.current.get(taskId) === nextTaskUpdate) {
          scheduledTimeUpdateQueueRef.current.delete(taskId);
        }
      });

    scheduledTimeUpdateQueueRef.current.set(taskId, nextTaskUpdate);
  }, [updateTask, syncTaskUpdate]);

  const handleDeleteQuest = useCallback(async (taskId: string, isAIGenerated?: boolean) => {
    // Track deletion for AI learning
    if (isAIGenerated) {
      trackDailyPlanOutcome(taskId, 'deleted');
    }
    await syncTaskDelete.mutateAsync({ taskId }).catch(() => {
      toast.error("Failed to remove linked calendar event");
    });
    await deleteTask(taskId);
    toast.success("Quest deleted");
    setEditingTask(null);
  }, [deleteTask, trackDailyPlanOutcome, syncTaskDelete]);

  const createRestorableTaskData = useCallback((task: DailyTask) => ({
    task_text: task.task_text,
    task_date: task.task_date,
    xp_reward: task.xp_reward,
    difficulty: task.difficulty,
    scheduled_time: task.scheduled_time,
    estimated_duration: task.estimated_duration,
    is_main_quest: !!task.is_main_quest,
    epic_id: task.epic_id,
    sort_order: task.sort_order,
    priority: task.priority,
    category: task.category,
    habit_source_id: task.habit_source_id,
    is_recurring: !!task.is_recurring,
    recurrence_pattern: task.recurrence_pattern,
    recurrence_days: task.recurrence_days,
    recurrence_month_days: task.recurrence_month_days,
    recurrence_custom_period: task.recurrence_custom_period,
    recurrence_end_date: task.recurrence_end_date,
    reminder_enabled: !!task.reminder_enabled,
    reminder_minutes_before: task.reminder_minutes_before,
    notes: task.notes,
    source: task.source,
  }), []);

  const handleDeleteQuestFromWeekPlanner = useCallback(async (task: DailyTask) => {
    const taskData = createRestorableTaskData(task);

    if (task.ai_generated) {
      trackDailyPlanOutcome(task.id, 'deleted');
    }

    try {
      await Haptics.impact({ style: ImpactStyle.Medium });
    } catch (e) {
      // Haptics not available on web
    }

    await syncTaskDelete.mutateAsync({ taskId: task.id }).catch(() => {
      toast.error("Failed to remove linked calendar event");
    });
    await deleteTask(task.id);

    toast("Quest deleted", {
      duration: QUEST_ACTION_TOAST_DURATION_MS,
      action: {
        label: "Undo",
        onClick: async () => {
          try {
            await restoreTask(taskData);
            toast.success("Quest restored");
          } catch {
            toast.error("Failed to restore quest");
          }
        },
      },
    });
  }, [createRestorableTaskData, deleteTask, restoreTask, syncTaskDelete, trackDailyPlanOutcome]);

  const handleMoveQuestToNextDayFromWeekPlanner = useCallback(async (task: DailyTask) => {
    if (!task.task_date) return;

    try {
      await Haptics.impact({ style: ImpactStyle.Light });
    } catch (e) {
      // Haptics not available on web
    }

    const taskDate = new Date(`${task.task_date}T12:00:00`);
    const nextDay = addDays(taskDate, 1);
    const nextDayStr = format(nextDay, 'yyyy-MM-dd');

    moveTaskToDate({ taskId: task.id, targetDate: nextDayStr });

    toast(`Moved to ${format(nextDay, "EEEE, MMM d")}`, {
      duration: QUEST_ACTION_TOAST_DURATION_MS,
      action: {
        label: "Undo",
        onClick: () => {
          moveTaskToDate({ taskId: task.id, targetDate: task.task_date! });
          toast.success("Move undone");
        },
      },
    });
  }, [moveTaskToDate]);

  const handleToggleInboxQuest = useCallback((taskId: string, completed: boolean) => {
    toggleInboxTask({ taskId, completed });
  }, [toggleInboxTask]);

  const handleDeleteInboxQuest = useCallback(async (taskId: string) => {
    await syncTaskDelete.mutateAsync({ taskId }).catch(() => {
      toast.error("Failed to remove linked calendar event");
    });
    deleteInboxTask(taskId);
    setEditingTask((currentTask) => (currentTask?.id === taskId ? null : currentTask));
  }, [deleteInboxTask, syncTaskDelete]);

  const handleDeleteEditingQuest = useCallback(async (taskId: string) => {
    if (editingTask?.task_date == null) {
      await handleDeleteInboxQuest(taskId);
      return;
    }

    await handleDeleteQuest(taskId);
  }, [editingTask?.task_date, handleDeleteInboxQuest, handleDeleteQuest]);

  const handleDeleteRitual = useCallback(async (habitId: string) => {
    if (!user?.id) return;
    try {
      // Delete the habit template
      const { error: habitError } = await supabase
        .from('habits')
        .delete()
        .eq('id', habitId)
        .eq('user_id', user.id);
      
      if (habitError) throw habitError;

      // Delete all incomplete tasks linked to this habit
      const { error: tasksError } = await supabase
        .from('daily_tasks')
        .delete()
        .eq('habit_source_id', habitId)
        .eq('user_id', user.id)
        .eq('completed', false);

      if (tasksError) {
        console.error('Error deleting linked tasks:', tasksError);
      }

      // Invalidate queries
      queryClient.invalidateQueries({ queryKey: ['habits'] });
      queryClient.invalidateQueries({ queryKey: ['daily-tasks'] });
      queryClient.invalidateQueries({ queryKey: ['epics'] });
      
      toast.success('Ritual deleted');
    } catch (error) {
      console.error('Error deleting ritual:', error);
      toast.error('Failed to delete ritual');
    }
    setEditingRitual(null);
  }, [user?.id, queryClient]);

  // Handle date pill click - just navigate to that day
  const handleDatePillClick = useCallback((date: Date) => {
    setSelectedDate(date);
  }, []);


  // Handle swipe-to-delete quest with undo
  const handleSwipeDeleteQuest = useCallback(async (taskId: string) => {
    const taskToDelete = dailyTasks.find(t => t.id === taskId);
    if (!taskToDelete) return;
    await handleDeleteQuestFromWeekPlanner(taskToDelete);
  }, [dailyTasks, handleDeleteQuestFromWeekPlanner]);

  // Handle swipe-to-move-to-next-day with undo
  const handleSwipeMoveToNextDay = useCallback(async (taskId: string) => {
    const taskToMove = dailyTasks.find(t => t.id === taskId);
    if (!taskToMove) return;
    await handleMoveQuestToNextDayFromWeekPlanner(taskToMove);
  }, [dailyTasks, handleMoveQuestToNextDayFromWeekPlanner]);

  // Pull external updates for full-sync providers on an interval.
  useEffect(() => {
    if (!isTabActive) return;
    const fullSyncProviders = calendarConnections
      .filter((connection) => connection.sync_mode === 'full_sync' && (connection.provider === 'google' || connection.provider === 'outlook'))
      .map((connection) => connection.provider as 'google' | 'outlook');

    if (fullSyncProviders.length === 0) return;

    const doPull = () => {
      for (const provider of fullSyncProviders) {
        syncProviderPull.mutate({ provider });
      }
    };

    doPull();
    const id = window.setInterval(() => {
      doPull();
    }, 2 * 60 * 1000);

    return () => {
      window.clearInterval(id);
    };
  }, [isTabActive, calendarConnections, syncProviderPull]);

  // Handle campaign creation
  const handleCreateCampaign = useCallback(async (data: Parameters<typeof createEpic>[0]) => {
    try {
      await createEpic(data);
      setPathfinderInitialGoal("");
      setShowPathfinder(false);
      setCreatedCampaignData({
        title: data.title,
        habits: data.habits.map(h => ({ title: h.title })),
      });
      setShowCreatedAnimation(true);
    } catch (error) {
      console.error('Failed to create campaign:', error);
    }
  }, [createEpic]);

  const handleAnimationComplete = useCallback(() => {
    setShowCreatedAnimation(false);
    setCreatedCampaignData(null);
  }, []);

  return (
    <PageTransition mode="instant">
      <CinematicPageBackground preset="quests" />
      <div
        className={cn(
          "min-h-screen pb-nav-safe pt-safe px-4 relative z-10",
          isDesktopLayout && "px-6",
        )}
      >
        <div className="mx-auto w-full max-w-[1360px]">
          {/* Hero Header */}
          <motion.div
            initial={prefersReducedMotion ? false : { opacity: 0, y: -14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: prefersReducedMotion ? 0 : 0.22 }}
            className={cn(
              "relative mb-6",
              isDesktopLayout
                ? "mb-5 flex items-end justify-between gap-6 text-left"
                : "text-center",
            )}
          >
            <div className={cn(isDesktopLayout ? "static flex-shrink-0" : "absolute right-0 top-0")}>
              <PageInfoButton 
                onClick={() => setShowPageInfo(true)} 
              />
            </div>
            <div>
              <h1
                className={cn(
                  "mb-2 text-3xl font-semibold tracking-tight bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent",
                  isDesktopLayout && "mb-1",
                )}
              >
                Quests
              </h1>
              <p className="text-sm text-muted-foreground/90">Plan your quests for the week ahead.</p>
            </div>
          </motion.div>

        <QuestsErrorBoundary>
          {!isDesktopLayout ? (
            <motion.div
              initial={prefersReducedMotion ? false : { opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: prefersReducedMotion ? 0 : 0.04, duration: prefersReducedMotion ? 0 : 0.2 }}
              className="mb-4"
            >
              <DatePillsScroller
                selectedDate={selectedDate}
                onDateSelect={handleDatePillClick}
                tasksPerDay={tasksPerDay}
                isActive={isTabActive}
              />
            </motion.div>
          ) : null}

          {isInboxRequested || inboxCount > 0 ? (
            <motion.div
              initial={prefersReducedMotion ? false : { opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: prefersReducedMotion ? 0 : 0.08, duration: prefersReducedMotion ? 0 : 0.2 }}
              className="mb-4"
            >
              <QuestInboxSection
                tasks={inboxTasks}
                isLoading={inboxLoading}
                isExpanded={isInboxExpanded}
                onExpandedChange={setIsInboxExpanded}
                onAddQuest={() => openAddQuestSheet()}
                onOpenCompanionPlanner={openCompanionPlanner}
                onToggleQuest={handleToggleInboxQuest}
                onEditQuest={handleEditQuest}
                onDeleteQuest={handleDeleteInboxQuest}
                sectionRef={inboxSectionRef}
              />
            </motion.div>
          ) : null}

          {/* Main Content Area */}
          <motion.div
            initial={prefersReducedMotion ? false : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: prefersReducedMotion ? 0 : 0.1, duration: prefersReducedMotion ? 0 : 0.2 }}
          >
            {isDesktopLayout && desktopPlannerMode === "week" ? (
              <DesktopWeekPlanner
                selectedDate={selectedDate}
                tasks={weekCalendarTasks}
                currentStreak={currentStreak}
                activeEpics={activeEpics}
                isCampaignsLoading={epicsLoading}
                hideAnytimeRow={isMacDesktopSession}
                plannerMode={desktopPlannerMode}
                timedTaskDurationFallbackMinutes={macTimedTaskDurationFallbackMinutes}
                desktopInteractionResetKey={desktopInteractionResetKey}
                onDateSelect={setSelectedDate}
                onPlannerModeChange={setDesktopPlannerMode}
                onToggle={handleToggleTask}
                onAddQuest={() => openAddQuestSheet()}
                onOpenCompanionPlanner={openCompanionPlanner}
                onVoiceAddQuest={toggleVoiceAddRecording}
                isVoiceAddRecording={isVoiceAddRecording}
                isVoiceAddSupported={isVoiceAddSupported}
                showCompanionPlannerHeaderAction={isMacHostedIOSApp}
                onOpenMonthView={() => setShowMonthView(true)}
                onUndoToggle={handleUndoToggle}
                onEditQuest={handleEditQuest}
                onDeleteQuest={handleDeleteQuestFromWeekPlanner}
                onSendToCalendar={SEND_TO_CALENDAR_ENABLED ? handleSendTaskToCalendar : undefined}
                hasCalendarLink={hasLinkedEvent}
                onMoveQuestToNextDay={handleMoveQuestToNextDayFromWeekPlanner}
              />
            ) : (
              <TodaysAgenda
                tasks={dailyTasks}
                selectedDate={selectedDate}
                layoutMode={journeysLayoutMode}
                hideDesktopRailAddButton={isMacHostedIOSApp}
                isVisible={location.pathname === JOURNEYS_ROUTE}
                disableTimelineDrag={showAddSheet || !!editingTask || !!editingRitual}
                onToggle={handleToggleTask}
                onAddQuest={() => openAddQuestSheet()}
                onOpenCompanionPlanner={openCompanionPlanner}
                onVoiceAddQuest={toggleVoiceAddRecording}
                isVoiceAddRecording={isVoiceAddRecording}
                isVoiceAddSupported={isVoiceAddSupported}
                showCompanionPlannerHeaderAction={isMacHostedIOSApp}
                completedCount={completedCount}
                totalCount={totalCount}
                currentStreak={currentStreak}
                desktopPlannerMode={desktopPlannerMode}
                desktopInteractionResetKey={desktopInteractionResetKey}
                timedTaskDurationFallbackMinutes={macTimedTaskDurationFallbackMinutes}
                useMacDurationSizedDesktopTimelineRows={isMacDesktopSession}
                onUndoToggle={handleUndoToggle}
                onEditQuest={handleEditQuest}
                weekTasks={weekCalendarTasks}
                activeEpics={activeEpics}
                isCampaignsLoading={epicsLoading}
                onDeleteQuest={handleSwipeDeleteQuest}
                onSendToCalendar={SEND_TO_CALENDAR_ENABLED ? handleSendTaskToCalendar : undefined}
                hasCalendarLink={hasLinkedEvent}
                onMoveQuestToNextDay={handleSwipeMoveToNextDay}
                onUpdateScheduledTime={handleTimelineScheduledTimeUpdate}
                onDateSelect={setSelectedDate}
                onDesktopPlannerModeChange={setDesktopPlannerMode}
                onOpenMonthView={() => setShowMonthView(true)}
                onTimeSlotLongPress={(date, time) => {
                  openAddQuestSheet({ date, time });
                }}
              />
            )}
          </motion.div>
        </QuestsErrorBoundary>

        <JourneysCompanionPlannerModal
          open={showCompanionPlanner}
          onOpenChange={setIsCompanionPlannerPinned}
          presentation={isDesktopLayout || isMacHostedIOSApp ? "dialog" : "drawer"}
          launchIntent={plannerLaunchIntent}
          onLaunchIntentConsumed={(intentId) => {
            setPlannerLaunchIntent((currentIntent) =>
            currentIntent?.id === intentId ? null : currentIntent
          );
          }}
          onOpenCampaignBuilder={openCampaignBuilderFromAssistant}
          onQuestProposalEditHandoff={handleQuestProposalEditHandoff}
        />

        {/* Add Quest Sheet */}
        <AddQuestSheet
          open={showAddSheet}
          onOpenChange={handleAddQuestSheetOpenChange}
          selectedDate={selectedDate}
          onAdd={handleAddQuest}
          isAdding={isAdding}
          prefilledTime={prefilledTime}
          autoFillTimeOnFirstTap={shouldAutoFillTutorialTime}
          presentation={isMacHostedIOSApp ? "desktop-panel" : "mobile-sheet"}
          prefillDraft={plannerQuestEditSession?.editor === "create"
            ? plannerQuestEditSession.prefillDraft
            : questSheetPrefillDraft}
          prefillKey={plannerQuestEditSession?.editor === "create"
            ? plannerQuestEditSession.prefillKey
            : questSheetPrefillKey}
          onCreateCampaign={() => openCampaignBuilder()}
        />
        
        {/* Edit Quest Dialog (for regular quests) */}
        <EditQuestDialog
          task={editingTask}
          open={!!editingTask && !editingTask.habit_source_id}
          onOpenChange={handleEditQuestDialogOpenChange}
          onSave={handleSaveEdit}
          isSaving={isUpdating}
          onSendToCalendar={SEND_TO_CALENDAR_ENABLED ? handleSendTaskToCalendar : undefined}
          hasCalendarLink={editingTask ? hasLinkedEvent(editingTask.id) : false}
          isSendingToCalendar={sendTaskToCalendar.isPending}
          onDelete={handleDeleteEditingQuest}
          isDeleting={isDeleting}
          presentation={isMacHostedIOSApp ? "desktop-panel" : "mobile-sheet"}
          plannerSubtaskDraft={plannerQuestEditSession?.editor === "update" ? plannerQuestEditSession.localSubtasks : null}
        />
        
        {/* Edit Ritual Sheet (for habits/rituals with two-way sync) */}
        <EditRitualSheet
          ritual={editingRitual}
          open={!!editingRitual}
          onOpenChange={(open) => !open && setEditingRitual(null)}
          onDelete={handleDeleteRitual}
        />

        <HourlyViewModal
          open={showMonthView}
          onOpenChange={setShowMonthView}
          selectedDate={selectedDate}
          onDateSelect={setSelectedDate}
          tasks={allCalendarTasks}
          milestones={[]}
          onTaskDrop={() => {}}
          onTimeSlotLongPress={(date, time) => {
            setSelectedDate(date);
            setPrefilledTime(time);
            setShowAddSheet(true);
          }}
        />

        <PageInfoModal
          open={showPageInfo}
          onClose={() => setShowPageInfo(false)}
          title="About Quests"
          icon={Compass}
          description="Quests and Campaigns work together in one powerful view."
          features={[
            "Quests are your daily actions to earn XP and build momentum",
            "Campaigns are goals you break down with your guide into routines",
            "Track progress across quests and campaigns to stay consistent"
          ]}
          tip="Add a quest with +, or start a Campaign to plan your bigger goal."
        />

        {/* Streak Freeze Prompt */}
        <StreakFreezePromptModal
          open={needsStreakDecision}
          currentStreak={freezeStreak}
          freezesAvailable={freezesAvailable}
          onUseFreeze={useFreeze}
          onResetStreak={resetStreak}
          isResolving={isResolving}
        />
        
        {/* Contact Interaction Log Modal */}
        <InteractionLogModal
          open={isInteractionModalOpen}
          onOpenChange={closeInteractionModal}
          contactName={pendingInteraction?.contact?.name ?? ''}
          contactAvatarUrl={pendingInteraction?.contact?.avatar_url}
          taskTitle={pendingInteraction?.taskText ?? ''}
          onLog={async (type, summary) => {
            await logInteraction(type as InteractionType, summary);
          }}
          onSkip={skipInteraction}
        />
        
        {/* Quick Adjust Floating Button + Drawer */}
        {dailyTasks.some(t => t.ai_generated) && (
          <motion.button
            initial={prefersReducedMotion ? false : { scale: 0.9, opacity: 0 }}
            animate={{ scale: 1 }}
            transition={{ duration: prefersReducedMotion ? 0 : 0.2 }}
            className="fixed bottom-24 right-4 z-40 p-3 rounded-full bg-card/92 backdrop-blur-xl border border-border/60 shadow-[0_10px_24px_rgba(0,0,0,0.28)] active:scale-95 transition-transform"
            onClick={() => setShowQuickAdjust(true)}
            aria-label="Open quick adjust"
          >
            <Wand2 className="h-5 w-5 text-primary" />
          </motion.button>
        )}

        <QuickAdjustDrawer
          open={showQuickAdjust}
          onOpenChange={setShowQuickAdjust}
          tasks={dailyTasks}
          selectedDate={selectedDate}
          onLaunchPlanner={(message, starterIntent) => {
            setShowQuickAdjust(false);
            launchPlannerIntent(message, starterIntent);
          }}
          onComplete={() => {
            setShowQuickAdjust(false);
          }}
        />

        {/* Pathfinder - Campaign Creation Wizard */}
        <Pathfinder
          key={pathfinderSessionKey}
          open={showPathfinder}
          onOpenChange={handlePathfinderOpenChange}
          onCreateEpic={handleCreateCampaign}
          isCreating={isCreatingCampaign}
          initialGoal={pathfinderInitialGoal}
          showTemplatesFirst={false}
        />

        {/* Campaign Created Celebration */}
        <CampaignCreatedAnimation
          isVisible={showCreatedAnimation}
          campaignTitle={createdCampaignData?.title || ''}
          habits={createdCampaignData?.habits || []}
          onComplete={handleAnimationComplete}
        />
      </div>
      </div>

    </PageTransition>
  );
};

export default Journeys;
