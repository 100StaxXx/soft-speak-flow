import { useState, useMemo, useEffect, useRef, useCallback, useLayoutEffect } from "react";
import { format, addDays, isSameDay, parseISO } from "date-fns";
import { motion, useReducedMotion } from "framer-motion";
import { Compass } from "lucide-react";
import { Haptics, ImpactStyle } from "@capacitor/haptics";
import { Capacitor } from "@capacitor/core";
import { App as CapacitorApp } from "@capacitor/app";
import { useLocation, useNavigate } from "react-router-dom";
import { PageTransition } from "@/components/PageTransition";
import { TodaysAgenda } from "@/components/TodaysAgenda";
import { DesktopWeekPlanner } from "@/components/DesktopWeekPlanner";
import { cn } from "@/lib/utils";

import { DatePillsScroller } from "@/components/DatePillsScroller";
import { AddQuestSheet, AddQuestData } from "@/components/AddQuestSheet";
import type { QuestAttachmentInput } from "@/types/questAttachments";
import { PageInfoButton } from "@/components/PageInfoButton";
import { PageInfoModal } from "@/components/PageInfoModal";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "@/components/ui/sonner";

import { EditQuestDialog } from "@/features/quests/components/EditQuestDialog";
import type { QuestComposerPrefillDraft } from "@/features/quests/types";
import { applySubtaskTitlePlan } from "@/features/tasks/lib/subtaskWrites";
import { EditRitualSheet, RitualData } from "@/components/EditRitualSheet";
import { useResilience } from "@/contexts/ResilienceContext";
import { useDailyTasks } from "@/hooks/useDailyTasks";
import { useCalendarTasks } from "@/hooks/useCalendarTasks";
import { fetchDailyTaskByIdRemote, type DailyTask } from "@/services/dailyTasksRemote";
import { useStreakMultiplier } from "@/hooks/useStreakMultiplier";
import { useHabitSurfacing } from "@/hooks/useHabitSurfacing";
import { useRecurringTaskSpawner } from "@/hooks/useRecurringTaskSpawner";
import { useAuth } from "@/hooks/useAuth";
import { useProfile } from "@/hooks/useProfile";

import { useOnboardingTaskCleanup } from "@/hooks/useOnboardingTaskCleanup";
import { useEpics } from "@/hooks/useEpics";
import { useInboxTasks } from "@/hooks/useInboxTasks";
import { useDeepLink } from "@/contexts/DeepLinkContext";
import { logger } from "@/utils/logger";

import { useAIInteractionTracker } from "@/hooks/useAIInteractionTracker";
import { Pathfinder } from "@/components/Pathfinder/Pathfinder";
import { QuestsErrorBoundary } from "@/components/SectionErrorBoundary";

import { useTaskCompletionWithInteraction, type InteractionType } from "@/hooks/useTaskCompletionWithInteraction";
import { InteractionLogModal } from "@/components/tasks/InteractionLogModal";
import { getCalendarSendSuccessCopy, useQuestCalendarSync } from "@/hooks/useQuestCalendarSync";
import { useCalendarIntegrations } from "@/hooks/useCalendarIntegrations";
import {
  buildCalendarSendTargetOptions,
  isCalendarSendTargetAvailable,
  type CalendarSendTarget,
} from "@/utils/calendarDestinationOptions";
import { HourlyViewModal } from "@/components/HourlyViewModal";
import { JourneysCompanionPlannerModal } from "@/components/journeys/JourneysCompanionPlannerModal";
import { DraggableFAB } from "@/components/DraggableFAB";
import { JOURNEYS_RESET_TO_TODAY_EVENT, JOURNEYS_ROUTE } from "@/pages/journeysDateSync";
import { isOnboardingCleanupEligible } from "@/pages/journeysCleanupEligibility";
import { useMainTabVisibility } from "@/contexts/MainTabVisibilityContext";
import { SEND_TO_CALENDAR_ENABLED } from "@/utils/calendarFeatureFlags";
import { useJourneysLayoutMode } from "@/hooks/useJourneysLayoutMode";
import { getCompanionFrostedThemeStyle } from "@/lib/companionFrostedTheme";
import { isMacDesignedForIPadIOSApp, isMacSession } from "@/utils/platformTargets";
import { QuestInboxSection } from "@/components/QuestInboxSection";
import { QUEST_ACTION_TOAST_DURATION_MS } from "@/constants/questToast";
import { trackResilienceEvent } from "@/utils/resilienceTelemetry";
import { normalizeUuidLikeId } from "@/utils/offlineId";
import {
  buildVoiceQuestPrefillFromTranscript,
} from "@/features/quests/utils/voiceQuestPrefill";
import { useVoiceInput } from "@/hooks/useVoiceInput";
import type { CompanionPlannerLaunchIntent } from "@/types/companionPlanner";
import {
  clearCampaignBuilderDraftSnapshot,
  clearCreationPopupMarker,
  readCampaignBuilderDraftSnapshot,
  readCreationPopupMarker,
  type CampaignBuilderDraftSnapshot,
  writeCreationPopupMarker,
} from "@/utils/creationPopupPersistence";
import { getEffectiveMissionDate } from "@/utils/timezone";
import { createPlanDayCompanionLaunchIntent } from "@/utils/companionPlannerLaunchContext";
import { PRODUCT } from "@/config/product";
import { ExternalCalendarAgenda } from "@/components/ExternalCalendarAgenda";
import { useExternalCalendarEvents } from "@/hooks/useExternalCalendarEvents";

const TIME_24H_REGEX = /^([01]\d|2[0-3]):([0-5]\d)$/;
const DATE_INPUT_REGEX = /^\d{4}-\d{2}-\d{2}$/;

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
  reminder_offsets_minutes: task.reminder_offsets_minutes ?? [],
  category: task.category ?? null,
  notes: task.notes ?? null,
  habit_source_id: task.habit_source_id ?? null,
  image_url: task.image_url ?? null,
  attachments: task.attachments ?? [],
  location: task.location ?? null,
  subtasks: task.subtasks ?? [],
});

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
  | "reminder_offsets_minutes"
  | "category"
  | "notes"
  | "habit_source_id"
  | "image_url"
  | "attachments"
  | "location"
  | "subtasks"
>;

type DesktopPlannerMode = "week" | "day";
const MAC_TIMED_TASK_DURATION_FALLBACK_MINUTES = 30;
const createPlannerLaunchIntentId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
const parseDateKeyAtNoon = (dateKey: string): Date => parseISO(`${dateKey}T12:00:00`);

const Journeys = () => {
  const prefersReducedMotion = useReducedMotion();
  const location = useLocation();
  const navigate = useNavigate();
  const { isTabActive } = useMainTabVisibility();
  const journeysLayoutMode = useJourneysLayoutMode();
  const isDesktopLayout = journeysLayoutMode === "desktop";
  const isMacHostedIOSApp = useMemo(() => isMacDesignedForIPadIOSApp(), []);
  const isMacDesktopSession = useMemo(() => isMacSession(), []);
  const companionFrostedThemeStyle = useMemo(
    () => getCompanionFrostedThemeStyle("#2f5938"),
    [],
  );
  const macTimedTaskDurationFallbackMinutes = isMacDesktopSession
    ? MAC_TIMED_TASK_DURATION_FALLBACK_MINUTES
    : undefined;
  const [selectedDate, setSelectedDate] = useState<Date>(() =>
    parseDateKeyAtNoon(getEffectiveMissionDate()),
  );
  const [datePillCenterRequestKey, setDatePillCenterRequestKey] = useState(0);
  const [agendaCenterNowRequestKey, setAgendaCenterNowRequestKey] = useState(0);
  const [datePillCenterRequestDateKey, setDatePillCenterRequestDateKey] = useState(() =>
    getEffectiveMissionDate(),
  );
  const [showPageInfo, setShowPageInfo] = useState(false);
  const [showAddSheet, setShowAddSheet] = useState(false);
  const [isCompanionPlannerOpen, setIsCompanionPlannerOpen] = useState(false);
  const [plannerLaunchIntent, setPlannerLaunchIntent] = useState<CompanionPlannerLaunchIntent | null>(null);
  const [showMonthView, setShowMonthView] = useState(false);
  const [desktopPlannerMode, setDesktopPlannerMode] = useState<DesktopPlannerMode>("week");

  const [prefilledTime, setPrefilledTime] = useState<string | null>(null);
  const [questSheetPrefillDraft, setQuestSheetPrefillDraft] = useState<QuestComposerPrefillDraft | null>(null);
  const [questSheetPrefillKey, setQuestSheetPrefillKey] = useState<string | null>(null);
  const [autoRestoreQuestDraftOnOpen, setAutoRestoreQuestDraftOnOpen] = useState(false);

  // Campaign creation state
  const [showPathfinder, setShowPathfinder] = useState(false);
  const [pathfinderInitialGoal, setPathfinderInitialGoal] = useState("");
  const [pathfinderSessionKey, setPathfinderSessionKey] = useState(0);
  const [pathfinderResumeDraft, setPathfinderResumeDraft] = useState<CampaignBuilderDraftSnapshot | null>(null);
  const [pathfinderResumeDraftKey, setPathfinderResumeDraftKey] = useState<string | null>(null);
  const [isInboxExpanded, setIsInboxExpanded] = useState(false);
  const previousIsJourneysRouteActiveRef = useRef(false);
  const previousJourneysLocationSignatureRef = useRef<string | null>(null);
  const pendingSelectedDateResetRef = useRef(false);
  const pendingCurrentDateCenterRequestRef = useRef(false);
  const hasUserDateInteractionRef = useRef(false);
  const previousEffectiveTodayDateKeyRef = useRef<string | null>(null);
  const selectedDateRef = useRef(selectedDate);
  const showAddSheetRef = useRef(showAddSheet);
  const showPathfinderRef = useRef(showPathfinder);
  const scheduledTimeUpdateQueueRef = useRef<Map<string, Promise<void>>>(new Map());
  const inboxSectionRef = useRef<HTMLDivElement | null>(null);
  const notificationTaskProcessedRef = useRef<string | null>(null);
  const notificationTaskDatePinnedRef = useRef(false);
  const hasInitializedInboxVisibilityRef = useRef(false);
  const hasConsumedCreationPopupResumeRef = useRef(false);

  const isInboxRequested = useMemo(
    () => new URLSearchParams(location.search).get("section") === "inbox",
    [location.search],
  );
  const requestedTaskId = useMemo(
    () => new URLSearchParams(location.search).get("taskId"),
    [location.search],
  );
  const isJourneysRouteActive = isTabActive && (
    location.pathname === JOURNEYS_ROUTE || location.pathname === "/advanced-planner"
  );
  const journeysLocationSignature = `${location.pathname}${location.search}`;
  const externalCalendarHorizon = isDesktopLayout && desktopPlannerMode === "week" ? "week" : "day";
  const { events: externalCalendarEvents } = useExternalCalendarEvents(
    selectedDate,
    externalCalendarHorizon,
    { enabled: PRODUCT.mode === "cosmiq" && isJourneysRouteActive },
  );

  // Auth and profile for onboarding
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { queueAction, shouldQueueWrites, retryNow } = useResilience();
  const { profile, loading: profileLoading } = useProfile();
  const effectiveTodayDateKey = useMemo(
    () => getEffectiveMissionDate(profile?.timezone ?? undefined),
    [profile?.timezone],
  );
  const effectiveTodayDate = useMemo(
    () => parseDateKeyAtNoon(effectiveTodayDateKey),
    [effectiveTodayDateKey],
  );

  // Edit quest state (for regular quests)
  const [editingTask, setEditingTask] = useState<EditableQuestTask | null>(null);

  // Edit ritual state (for tasks linked to habits)
  const [editingRitual, setEditingRitual] = useState<RitualData | null>(null);
  const closeEditingRitual = useCallback(() => {
    notificationTaskDatePinnedRef.current = false;
    setEditingRitual(null);
  }, []);

  const setAddQuestSheetOpen = useCallback((nextOpen: boolean) => {
    showAddSheetRef.current = nextOpen;
    setShowAddSheet(nextOpen);
  }, []);

  const clearQuestCreationPopupState = useCallback(() => {
    clearCreationPopupMarker(user?.id, "quest");
    setAutoRestoreQuestDraftOnOpen(false);
  }, [user?.id]);

  const clearCampaignCreationPopupState = useCallback(() => {
    clearCreationPopupMarker(user?.id, "campaign");
    clearCampaignBuilderDraftSnapshot(user?.id);
    setPathfinderResumeDraft(null);
    setPathfinderResumeDraftKey(null);
  }, [user?.id]);

  const handleAddQuestSheetOpenChange = useCallback((nextOpen: boolean) => {
    setAddQuestSheetOpen(nextOpen);
    if (!nextOpen) {
      clearQuestCreationPopupState();
      setPrefilledTime(null);
      setQuestSheetPrefillDraft(null);
      setQuestSheetPrefillKey(null);
    }
  }, [clearQuestCreationPopupState, setAddQuestSheetOpen]);

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
    setAutoRestoreQuestDraftOnOpen(false);
    setAddQuestSheetOpen(true);
  }, [setAddQuestSheetOpen]);

  const handleEditQuestDialogOpenChange = useCallback((nextOpen: boolean) => {
    if (nextOpen) return;
    notificationTaskDatePinnedRef.current = false;
    setEditingTask(null);
  }, []);

  const openCampaignBuilder = useCallback((initialGoal?: string | null) => {
    setPathfinderInitialGoal(initialGoal?.trim() ?? "");
    setPathfinderResumeDraft(null);
    setPathfinderResumeDraftKey(null);
    setPathfinderSessionKey((currentKey) => currentKey + 1);
    setShowPathfinder(true);
  }, []);

  const openCompanionPlanner = useCallback((intent?: CompanionPlannerLaunchIntent | null) => {
    if (intent?.target === "campaign_builder") {
      openCampaignBuilder(intent.message);
      return;
    }
    setPlannerLaunchIntent(intent ?? null);
    setIsCompanionPlannerOpen(true);
  }, [openCampaignBuilder]);

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

  const handlePathfinderOpenChange = useCallback((nextOpen: boolean) => {
    setShowPathfinder(nextOpen);
    if (!nextOpen) {
      clearCampaignCreationPopupState();
      setPathfinderInitialGoal("");
    }
  }, [clearCampaignCreationPopupState]);

  useEffect(() => {
    if (!user?.id || !showAddSheet) return;

    writeCreationPopupMarker(user.id, {
      surface: "quest",
      route: JOURNEYS_ROUTE,
      selectedDate: format(selectedDate, "yyyy-MM-dd"),
      updatedAt: new Date().toISOString(),
    });
  }, [selectedDate, showAddSheet, user?.id]);

  useEffect(() => {
    if (!user?.id || !showPathfinder) return;

    writeCreationPopupMarker(user.id, {
      surface: "campaign",
      route: JOURNEYS_ROUTE,
      selectedDate: null,
      updatedAt: new Date().toISOString(),
    });
  }, [showPathfinder, user?.id]);

  useEffect(() => {
    if (hasConsumedCreationPopupResumeRef.current) return;
    if (!isJourneysRouteActive) return;
    if (!user?.id) return;
    if (profileLoading) return;
    if (showAddSheet || showPathfinder) return;

    const marker = readCreationPopupMarker(user.id);
    if (!marker || marker.route !== JOURNEYS_ROUTE) return;

    hasConsumedCreationPopupResumeRef.current = true;

    if (marker.surface === "quest") {
      if (marker.selectedDate) {
        const restored = parseISO(`${marker.selectedDate}T00:00:00`);
        if (!Number.isNaN(restored.getTime())) {
          setSelectedDate(restored);
        }
      }
      setPrefilledTime(null);
      setQuestSheetPrefillDraft(null);
      setQuestSheetPrefillKey(null);
      setAutoRestoreQuestDraftOnOpen(true);
      setAddQuestSheetOpen(true);
      return;
    }

    const draft = readCampaignBuilderDraftSnapshot(user.id);
    setPathfinderInitialGoal(draft?.goalInput?.trim() ?? "");
    setPathfinderResumeDraft(draft);
    setPathfinderResumeDraftKey(`resume-${marker.updatedAt}`);
    setPathfinderSessionKey((currentKey) => currentKey + 1);
    setShowPathfinder(true);
  }, [
    isJourneysRouteActive,
    profileLoading,
    setAddQuestSheetOpen,
    showAddSheet,
    showPathfinder,
    user?.id,
  ]);

  useEffect(() => {
    showAddSheetRef.current = showAddSheet;
  }, [showAddSheet]);

  useEffect(() => {
    showPathfinderRef.current = showPathfinder;
  }, [showPathfinder]);

  useLayoutEffect(() => {
    selectedDateRef.current = selectedDate;
  }, [selectedDate]);

  const requestCurrentDateCentering = useCallback(() => {
    pendingCurrentDateCenterRequestRef.current = false;
    setDatePillCenterRequestDateKey(effectiveTodayDateKey);
    setDatePillCenterRequestKey((currentKey) => currentKey + 1);
    setAgendaCenterNowRequestKey((currentKey) => currentKey + 1);
  }, [effectiveTodayDateKey]);

  const resetSelectedDateToToday = useCallback((options?: { deferIfAddSheetOpen?: boolean }) => {
    if (showAddSheetRef.current || showPathfinderRef.current) {
      if (options?.deferIfAddSheetOpen) {
        pendingSelectedDateResetRef.current = true;
      }
      return;
    }

    if (notificationTaskDatePinnedRef.current) {
      return;
    }

    pendingSelectedDateResetRef.current = false;
    hasUserDateInteractionRef.current = false;
    setDatePillCenterRequestDateKey(effectiveTodayDateKey);

    if (isSameDay(selectedDateRef.current, effectiveTodayDate)) {
      requestCurrentDateCentering();
    } else {
      pendingCurrentDateCenterRequestRef.current = true;
    }

    setSelectedDate((current) => (isSameDay(current, effectiveTodayDate) ? current : effectiveTodayDate));
  }, [effectiveTodayDate, effectiveTodayDateKey, requestCurrentDateCentering]);

  useLayoutEffect(() => {
    if (!pendingCurrentDateCenterRequestRef.current) return;
    if (!isJourneysRouteActive) return;
    if (!isSameDay(selectedDate, effectiveTodayDate)) return;

    requestCurrentDateCentering();
  }, [effectiveTodayDate, isJourneysRouteActive, requestCurrentDateCentering, selectedDate]);

  useEffect(() => {
    const previousEffectiveTodayDateKey = previousEffectiveTodayDateKeyRef.current;
    previousEffectiveTodayDateKeyRef.current = effectiveTodayDateKey;

    if (previousEffectiveTodayDateKey === null || previousEffectiveTodayDateKey === effectiveTodayDateKey) {
      return;
    }

    if (!isJourneysRouteActive || hasUserDateInteractionRef.current || notificationTaskDatePinnedRef.current) {
      return;
    }

    resetSelectedDateToToday({ deferIfAddSheetOpen: true });
  }, [effectiveTodayDateKey, isJourneysRouteActive, resetSelectedDateToToday]);

  const handleUserDateInteraction = useCallback(() => {
    notificationTaskDatePinnedRef.current = false;
    hasUserDateInteractionRef.current = true;
  }, []);

  const handleUserDateSelect = useCallback((date: Date) => {
    notificationTaskDatePinnedRef.current = false;
    hasUserDateInteractionRef.current = true;
    setSelectedDate(date);
  }, []);

  const requestTaskActivityDateSnap = useCallback(() => {
    if (!isJourneysRouteActive || hasUserDateInteractionRef.current) return;
    resetSelectedDateToToday({ deferIfAddSheetOpen: true });
  }, [isJourneysRouteActive, resetSelectedDateToToday]);

  useLayoutEffect(() => {
    const shouldResetForRouteEntry =
      isJourneysRouteActive &&
      (
        !previousIsJourneysRouteActiveRef.current ||
        previousJourneysLocationSignatureRef.current !== journeysLocationSignature
      );

    if (shouldResetForRouteEntry) {
      resetSelectedDateToToday({ deferIfAddSheetOpen: true });
    }

    previousIsJourneysRouteActiveRef.current = isJourneysRouteActive;
    if (isJourneysRouteActive) {
      previousJourneysLocationSignatureRef.current = journeysLocationSignature;
    }
  }, [isJourneysRouteActive, journeysLocationSignature, resetSelectedDateToToday]);

  useLayoutEffect(() => {
    if (!isJourneysRouteActive || showAddSheet || showPathfinder || !pendingSelectedDateResetRef.current) return;
    resetSelectedDateToToday();
  }, [isJourneysRouteActive, resetSelectedDateToToday, showAddSheet, showPathfinder]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const handleResetToTodayRequest = () => {
      if (!isJourneysRouteActive) return;
      resetSelectedDateToToday({ deferIfAddSheetOpen: true });
    };

    window.addEventListener(JOURNEYS_RESET_TO_TODAY_EVENT, handleResetToTodayRequest);
    return () => {
      window.removeEventListener(JOURNEYS_RESET_TO_TODAY_EVENT, handleResetToTodayRequest);
    };
  }, [isJourneysRouteActive, resetSelectedDateToToday]);

  useEffect(() => {
    if (!isJourneysRouteActive) return;
    if (Capacitor.isNativePlatform()) return;

    const requestAppOpenDateReset = () => {
      resetSelectedDateToToday({ deferIfAddSheetOpen: true });
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") return;
      requestAppOpenDateReset();
    };

    if (document.visibilityState !== "hidden") {
      requestAppOpenDateReset();
    }

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("focus", requestAppOpenDateReset);
    window.addEventListener("pageshow", requestAppOpenDateReset);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("focus", requestAppOpenDateReset);
      window.removeEventListener("pageshow", requestAppOpenDateReset);
    };
  }, [isJourneysRouteActive, resetSelectedDateToToday]);

  useEffect(() => {
    if (!isJourneysRouteActive) return;
    if (!Capacitor.isNativePlatform()) return;

    let isDisposed = false;
    let listenerHandles: Array<{ remove: () => Promise<void> }> = [];

    const requestAppOpenDateReset = () => {
      resetSelectedDateToToday({ deferIfAddSheetOpen: true });
    };

    const setupListener = async () => {
      const appStateHandle = await CapacitorApp.addListener("appStateChange", ({ isActive }) => {
        if (!isActive) return;
        requestAppOpenDateReset();
      });
      const resumeHandle = await CapacitorApp.addListener("resume", requestAppOpenDateReset);
      const handles = [appStateHandle, resumeHandle];

      if (isDisposed) {
        await Promise.all(handles.map((handle) => handle.remove()));
        return;
      }

      listenerHandles = handles;
      requestAppOpenDateReset();
    };

    void setupListener();

    return () => {
      isDisposed = true;
      if (listenerHandles.length > 0) {
        void Promise.all(listenerHandles.map((handle) => handle.remove()));
      }
    };
  }, [isJourneysRouteActive, resetSelectedDateToToday]);

  // Combo tracking


  // AI interaction tracking
  const { trackDailyPlanOutcome } = useAIInteractionTracker();

  // Epics for plan my day questions and campaign strip
  const { epics, isLoading: epicsLoading, createEpic, isCreating: isCreatingCampaign } = useEpics({ enabled: isTabActive });
  const activeEpics = useMemo(() =>
    epics?.filter(e => e.status === 'active') || [],
    [epics]
  );

  const { currentStreak } = useStreakMultiplier();
  const { sendTaskToCalendar, hasLinkedEvent } = useQuestCalendarSync({
    enabled: isTabActive,
  });
  const {
    connections: calendarConnections,
    defaultProvider: calendarDefaultProvider,
  } = useCalendarIntegrations({ enabled: isTabActive });

  // Contact interaction logging
  const {
    pendingInteraction,
    isModalOpen: isInteractionModalOpen,
    handleTaskCompleted,
    logInteraction,
    skipInteraction,
    closeModal: closeInteractionModal,
  } = useTaskCompletionWithInteraction();
  const closeInteractionModalRef = useRef(closeInteractionModal);

  useEffect(() => {
    closeInteractionModalRef.current = closeInteractionModal;
  }, [closeInteractionModal]);

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
  const createPlanDayLaunchIntent = useCallback(() => createPlanDayCompanionLaunchIntent({
    selectedDate,
    tasks: isDesktopLayout && desktopPlannerMode === "week" ? weekCalendarTasks : dailyTasks,
    activeEpics,
    assumeTasksAreForSelectedDate: !(isDesktopLayout && desktopPlannerMode === "week"),
  }), [activeEpics, dailyTasks, desktopPlannerMode, isDesktopLayout, selectedDate, weekCalendarTasks]);
  useEffect(() => {
    if (hasInitializedInboxVisibilityRef.current) return;
    if (inboxLoading && !isInboxRequested && inboxCount === 0) return;

    setIsInboxExpanded(isInboxRequested);
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

  useEffect(() => {
    const routeState = (location.state as {
      companionPlannerLaunchIntent?: CompanionPlannerLaunchIntent | null;
      journeysCreateQuestRequest?: { id?: string | null } | null;
    } | null) ?? null;
    const nextCreateQuestRequest = routeState?.journeysCreateQuestRequest ?? null;
    if (nextCreateQuestRequest?.id) {
      openAddQuestSheet();

      const nextState = {
        ...(routeState ?? {}),
        companionPlannerLaunchIntent: null,
        journeysCreateQuestRequest: null,
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
      return;
    }

    const nextLaunchIntent = routeState?.companionPlannerLaunchIntent ?? null;
    if (!nextLaunchIntent?.id) return;

    if (PRODUCT.mode === "cosmiq") {
      openCompanionPlanner(nextLaunchIntent);
    } else if (nextLaunchIntent.target === "campaign_builder") {
      openCampaignBuilder(nextLaunchIntent.message);
    } else {
      openAddQuestSheet();
    }

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
  }, [location.pathname, location.search, location.state, navigate, openAddQuestSheet, openCampaignBuilder, openCompanionPlanner]);

  useEffect(() => {
    if (!isMacHostedIOSApp || !isJourneysRouteActive) return;

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
        || showMonthView
        || showPageInfo
        || showPathfinder
        || !!editingTask
        || !!editingRitual
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
    isJourneysRouteActive,
    location.pathname,
    openAddQuestSheet,
    showAddSheet,
    showMonthView,
    showPageInfo,
    showPathfinder,
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
    reminder_offsets_minutes?: number[] | null;
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

  useEffect(() => {
    if (!requestedTaskId) {
      notificationTaskProcessedRef.current = null;
    }
  }, [requestedTaskId]);

  useEffect(() => {
    if (!isTabActive || !requestedTaskId || notificationTaskProcessedRef.current === requestedTaskId) {
      return;
    }

    if (dailyTasksLoading || inboxLoading) {
      return;
    }

    let cancelled = false;
    notificationTaskProcessedRef.current = requestedTaskId;

    const clearTaskIdFromUrl = () => {
      const params = new URLSearchParams(location.search);
      params.delete("taskId");
      const nextSearch = params.toString();
      navigate(
        {
          pathname: location.pathname,
          search: nextSearch ? `?${nextSearch}` : "",
        },
        { replace: true },
      );
    };

    const openNotificationTask = async () => {
      let sourceTask = [...dailyTasks, ...inboxTasks].find((task) => task.id === requestedTaskId) ?? null;

      if (!sourceTask && user?.id) {
        try {
          sourceTask = await fetchDailyTaskByIdRemote(user.id, requestedTaskId);
        } catch (error) {
          logger.warn("[Journeys] Failed to fetch notification-linked task:", {
            taskId: requestedTaskId,
            error: error instanceof Error ? error.message : String(error),
          });
          notificationTaskProcessedRef.current = null;
          return;
        }
      }

      if (cancelled) return;

      if (!sourceTask) {
        logger.log("[Journeys] Notification task not found:", requestedTaskId);
        clearTaskIdFromUrl();
        return;
      }

      logger.log("[Journeys] Opening notification-linked task:", requestedTaskId);

      if (sourceTask.task_date) {
        const taskDate = parseISO(`${sourceTask.task_date}T12:00:00`);
        if (!Number.isNaN(taskDate.getTime())) {
          notificationTaskDatePinnedRef.current = true;
          if (!isSameDay(taskDate, selectedDate)) {
            setSelectedDate(taskDate);
          }
        }
      } else {
        setIsInboxExpanded(true);
        window.requestAnimationFrame(() => {
          inboxSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
        });
      }

      await handleEditQuest(sourceTask);
      clearTaskIdFromUrl();
    };

    void openNotificationTask();

    return () => {
      cancelled = true;
    };
  }, [
    dailyTasks,
    dailyTasksLoading,
    handleEditQuest,
    inboxLoading,
    inboxTasks,
    isTabActive,
    location.pathname,
    location.search,
    navigate,
    requestedTaskId,
    selectedDate,
    user?.id,
  ]);

  const tasksPerDay = useMemo(() => {
    const map: Record<string, number> = {};
    allCalendarTasks.forEach((task: { task_date?: string | null }) => {
      if (!task.task_date) return;
      map[task.task_date] = (map[task.task_date] || 0) + 1;
    });
    return map;
  }, [allCalendarTasks]);

  const handleOpenCalendarPreferences = useCallback(() => {
    navigate("/profile", { state: { openTab: "preferences" } });
  }, [navigate]);

  const handleSendTaskToCalendar = useCallback(async (
    taskId: string,
    requestedTarget?: CalendarSendTarget | null,
  ) => {
    const routeToCalendarPreferences = () => {
      toast.error("No calendar connected. Opening Preferences...");
      handleOpenCalendarPreferences();
    };

    if (calendarConnections.length === 0) {
      routeToCalendarPreferences();
      return;
    }

    const resolveSendTarget = (): CalendarSendTarget | null => {
      if (requestedTarget && isCalendarSendTargetAvailable(requestedTarget, calendarConnections)) {
        return requestedTarget;
      }

      if (calendarConnections.length <= 1) {
        return calendarConnections[0]?.provider ?? null;
      }

      const options = buildCalendarSendTargetOptions(calendarConnections, {
        defaultProvider: calendarDefaultProvider,
        includeAll: true,
        scheduledOnly: false,
      });
      const promptMessage = [
        "Send this action where?",
        ...options.map((option, index) => `${index + 1}. ${option.label} - ${option.description}`),
      ].join("\n");
      const picked = window.prompt(promptMessage, "1");
      const pickedIndex = picked ? Number.parseInt(picked, 10) - 1 : -1;
      const option = Number.isInteger(pickedIndex) ? options[pickedIndex] : undefined;

      return option?.target ?? null;
    };

    const selectedTarget = resolveSendTarget();
    if (!selectedTarget) {
      toast.error("Calendar send cancelled. Please choose a destination.");
      return;
    }

    const providerTargets = selectedTarget === "all"
      ? calendarConnections.map((connection) => connection.provider)
      : [selectedTarget];

    let taskDateOverride: string | undefined;
    let scheduledTimeOverride: string | undefined;

    const attempt = async () => {
      const results = [];
      for (const provider of providerTargets) {
        results.push(await sendTaskToCalendar.mutateAsync({
          taskId,
          options: {
            provider,
            ...(taskDateOverride ? { taskDate: taskDateOverride } : {}),
            ...(scheduledTimeOverride ? { scheduledTime: scheduledTimeOverride } : {}),
          },
        }));
      }
      return results;
    };

    const showSuccess = (results: Awaited<ReturnType<typeof attempt>>) => {
      if (results.length === 1) {
        const copy = getCalendarSendSuccessCopy(results[0], calendarConnections.length);
        toast.success(copy.title, { description: copy.description });
        return;
      }

      const destinations = results
        .map((result) => `${result.providerLabel} ${result.destinationKind === "todo" ? "To Do" : "Calendar"} -> ${result.destinationName}`)
        .join("; ");
      toast.success(`Action sent to ${results.length} destinations`, {
        description: `Destinations: ${destinations}.`,
      });
    };

    try {
      const results = await attempt();
      showSuccess(results);
      return;
    } catch (error) {
      let message = error instanceof Error ? error.message : "Failed to send action to calendar";
      if (message.includes("MULTI_DAY_MONTHLY_UNSUPPORTED")) {
        toast.error("Calendar send doesn't support multi-day monthly recurrence yet.");
        return;
      }
      if (message.includes("NO_CALENDAR_CONNECTION")) {
        routeToCalendarPreferences();
        return;
      }
      if (message.includes("CALENDAR_DEFAULT_REQUIRED")) {
        toast.error("Choose a default calendar provider before sending. Opening Preferences...");
        handleOpenCalendarPreferences();
        return;
      }

      for (let attemptIndex = 0; attemptIndex < 2; attemptIndex += 1) {
        if (message.includes("NO_CALENDAR_CONNECTION")) {
          routeToCalendarPreferences();
          return;
        }
        if (message.includes("CALENDAR_DEFAULT_REQUIRED")) {
          toast.error("Choose a default calendar provider before sending. Opening Preferences...");
          handleOpenCalendarPreferences();
          return;
        }

        if (message.includes("TASK_DATE_REQUIRED") && !taskDateOverride) {
          const pickedDate = window.prompt(
            "Choose a date to send this action (YYYY-MM-DD)",
            format(selectedDate, "yyyy-MM-dd"),
          );
          if (!pickedDate || !DATE_INPUT_REGEX.test(pickedDate)) {
            toast.error("Calendar send cancelled. Please choose a valid YYYY-MM-DD date.");
            return;
          }
          taskDateOverride = pickedDate;
        }

        if ((message.includes("SCHEDULED_TIME_REQUIRED") || message.includes("SCHEDULED_TIME_INVALID")) && !scheduledTimeOverride) {
          const pickedTime = window.prompt("Choose a time to send this action (HH:mm)", "09:00");
          if (!pickedTime || !TIME_24H_REGEX.test(pickedTime)) {
            toast.error("Calendar send cancelled. Please choose a valid HH:mm time.");
            return;
          }
          scheduledTimeOverride = pickedTime;
        }

        try {
          const results = await attempt();
          showSuccess(results);
          return;
        } catch (retryError) {
          message = retryError instanceof Error ? retryError.message : "Failed to send action to calendar";
          if (message.includes("MULTI_DAY_MONTHLY_UNSUPPORTED")) {
            toast.error("Calendar send doesn't support multi-day monthly recurrence yet.");
            return;
          }
          if (message.includes("NO_CALENDAR_CONNECTION")) {
            routeToCalendarPreferences();
            return;
          }
          if (message.includes("CALENDAR_DEFAULT_REQUIRED")) {
            toast.error("Choose a default calendar provider before sending. Opening Preferences...");
            handleOpenCalendarPreferences();
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
        toast.error("Please assign a date before sending this action to calendar.");
        return;
      }

      if (message.includes("SCHEDULED_TIME_REQUIRED") || message.includes("SCHEDULED_TIME_INVALID")) {
        toast.error("Please assign a time before sending this action to calendar.");
        return;
      }

      toast.error(message);
    }
  }, [calendarConnections, calendarDefaultProvider, handleOpenCalendarPreferences, selectedDate, sendTaskToCalendar]);

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
      reminderOffsetsMinutes: data.reminderOffsetsMinutes,
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

    setAddQuestSheetOpen(false);
    clearQuestCreationPopupState();

    if (SEND_TO_CALENDAR_ENABLED && data.sendToCalendar && createdTask?.id) {
      const calendarSendStartedAt = Date.now();
      void handleSendTaskToCalendar(createdTask.id, data.sendToCalendarTarget).finally(() => {
        trackResilienceEvent("task_create_calendar_send", {
          taskId: createdTask.id,
          calendarSendMs: Date.now() - calendarSendStartedAt,
        });
      });
    }
    if (data.sendToInbox) {
      setIsInboxExpanded(true);
      window.requestAnimationFrame(() => {
        inboxSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    }
  }, [
    selectedDate,
    addTask,
    clearQuestCreationPopupState,
    handleSendTaskToCalendar,
    setAddQuestSheetOpen,
  ]);

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
        if (completed) {
          requestTaskActivityDateSnap();
        }
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
  }, [toggleTask, trackDailyPlanOutcome, handleTaskCompleted, requestTaskActivityDateSnap]);

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
    reminder_offsets_minutes: number[];
    notes: string | null;
    category: string | null;
    image_url: string | null;
    location: string | null;
    attachments?: QuestAttachmentInput[];
    subtasks?: string[];
  }) => {
    const { subtasks: nextSubtasks, ...taskUpdates } = updates;
    await updateTask({ taskId, updates: taskUpdates });
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
    setEditingTask(null);
  }, [
    queryClient,
    queueAction,
    retryNow,
    shouldQueueWrites,
    updateTask,
    user?.id,
  ]);

  const handleTimelineScheduledTimeUpdate = useCallback((taskId: string, newTime: string) => {
    const previousTaskUpdate = scheduledTimeUpdateQueueRef.current.get(taskId) ?? Promise.resolve();
    const nextTaskUpdate = previousTaskUpdate
      .catch(() => undefined)
      .then(async () => {
        await updateTask({ taskId, updates: { scheduled_time: newTime } });
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
  }, [updateTask]);

  const handleDeleteQuest = useCallback(async (taskId: string, isAIGenerated?: boolean) => {
    // Track deletion for AI learning
    if (isAIGenerated) {
      trackDailyPlanOutcome(taskId, 'deleted');
    }
    await deleteTask(taskId);
    toast.success("Action deleted");
    setEditingTask(null);
  }, [deleteTask, trackDailyPlanOutcome]);

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
    reminder_offsets_minutes: task.reminder_offsets_minutes ?? [],
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

    await deleteTask(task.id);

    toast("Action deleted", {
      duration: QUEST_ACTION_TOAST_DURATION_MS,
      action: {
        label: "Undo",
        onClick: async () => {
          try {
            await restoreTask(taskData);
            toast.success("Action restored");
          } catch {
            toast.error("Failed to restore action");
          }
        },
      },
    });
  }, [createRestorableTaskData, deleteTask, restoreTask, trackDailyPlanOutcome]);

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
    toggleInboxTask({ taskId, completed }, {
      onSuccess: () => {
        if (completed) {
          requestTaskActivityDateSnap();
        }
      },
    });
  }, [requestTaskActivityDateSnap, toggleInboxTask]);

  const handleDeleteInboxQuest = useCallback(async (taskId: string) => {
    deleteInboxTask(taskId);
    setEditingTask((currentTask) => (currentTask?.id === taskId ? null : currentTask));
  }, [deleteInboxTask]);

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

      toast.success('Rhythm deleted');
    } catch (error) {
      console.error('Error deleting ritual:', error);
      toast.error('Failed to delete rhythm');
    }
    closeEditingRitual();
  }, [user?.id, queryClient, closeEditingRitual]);

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

  // Handle campaign creation
  const handleCreateCampaign = useCallback(async (data: Parameters<typeof createEpic>[0]) => {
    try {
      await createEpic(data);
      setPathfinderInitialGoal("");
      clearCampaignCreationPopupState();
      setShowPathfinder(false);
      toast.success("Commitment created", {
        description: "Its rhythms are ready in your plan.",
      });
    } catch (error) {
      console.error('Failed to create campaign:', error);
      throw error;
    }
  }, [clearCampaignCreationPopupState, createEpic]);

  return (
    <PageTransition mode="instant">
      <div
        className={cn(
          "daily-way-page min-h-screen pb-nav-safe pt-safe px-4 relative z-10",
          isDesktopLayout && "px-6",
        )}
        style={companionFrostedThemeStyle}
        data-testid="journeys-theme-scope"
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
                Plan
              </h1>
              <p className="text-sm text-muted-foreground/90">Shape a realistic week of actions and rhythms.</p>
            </div>
          </motion.div>

        <QuestsErrorBoundary>
          {!isDesktopLayout ? (
            <div
              data-testid="journeys-mobile-date-strip"
              className="relative z-10 mb-4 min-h-[72px]"
            >
              <DatePillsScroller
                selectedDate={selectedDate}
                onDateSelect={handleDatePillClick}
                onUserDateInteraction={handleUserDateInteraction}
                tasksPerDay={tasksPerDay}
                isActive={isJourneysRouteActive}
                centerRequestKey={datePillCenterRequestKey}
                centerRequestDateKey={datePillCenterRequestDateKey}
                resetRangeOnCenterRequest
              />
            </div>
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
                onToggleQuest={handleToggleInboxQuest}
                onEditQuest={handleEditQuest}
                onDeleteQuest={handleDeleteInboxQuest}
                sectionRef={inboxSectionRef}
              />
            </motion.div>
          ) : null}

          {PRODUCT.mode === "cosmiq" ? (
            <ExternalCalendarAgenda events={externalCalendarEvents} />
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
                readableQuestCardsEnabled={profile?.readable_quest_cards_enabled ?? false}
                currentStreak={currentStreak}
                activeEpics={activeEpics}
                isCampaignsLoading={epicsLoading}
                hideAnytimeRow={isMacDesktopSession}
                plannerMode={desktopPlannerMode}
                timedTaskDurationFallbackMinutes={macTimedTaskDurationFallbackMinutes}
                desktopInteractionResetKey={desktopInteractionResetKey}
                centerDateRequestKey={datePillCenterRequestKey}
                centerDateRequestDateKey={datePillCenterRequestDateKey}
                onDateSelect={handleUserDateSelect}
                onPlannerModeChange={setDesktopPlannerMode}
                onToggle={handleToggleTask}
                onAddQuest={() => openAddQuestSheet()}
                onVoiceAddQuest={toggleVoiceAddRecording}
                isVoiceAddRecording={isVoiceAddRecording}
                isVoiceAddSupported={isVoiceAddSupported}
                showCompanionPlannerHeaderAction={false}
                onOpenCompanionPlanner={PRODUCT.mode === "cosmiq" ? openCompanionPlanner : undefined}
                onOpenMonthView={() => setShowMonthView(true)}
                onUndoToggle={handleUndoToggle}
                onEditQuest={handleEditQuest}
                onDeleteQuest={handleDeleteQuestFromWeekPlanner}
                onSendToCalendar={SEND_TO_CALENDAR_ENABLED ? handleSendTaskToCalendar : undefined}
                hasCalendarLink={hasLinkedEvent}
                onMoveQuestToNextDay={handleMoveQuestToNextDayFromWeekPlanner}
                companionFrostedThemeStyle={companionFrostedThemeStyle}
              />
            ) : (
              <TodaysAgenda
                tasks={dailyTasks}
                selectedDate={selectedDate}
                readableQuestCardsEnabled={profile?.readable_quest_cards_enabled ?? false}
                layoutMode={journeysLayoutMode}
                hideDesktopRailAddButton={false}
                isVisible={isJourneysRouteActive}
                disableTimelineDrag
                onToggle={handleToggleTask}
                onAddQuest={() => openAddQuestSheet()}
                onVoiceAddQuest={toggleVoiceAddRecording}
                isVoiceAddRecording={isVoiceAddRecording}
                isVoiceAddSupported={isVoiceAddSupported}
                showCompanionPlannerHeaderAction={false}
                onOpenCompanionPlanner={PRODUCT.mode === "cosmiq" ? openCompanionPlanner : undefined}
                completedCount={completedCount}
                totalCount={totalCount}
                currentStreak={currentStreak}
                desktopPlannerMode={desktopPlannerMode}
                desktopInteractionResetKey={desktopInteractionResetKey}
                centerNowRequestKey={agendaCenterNowRequestKey}
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
                onDateSelect={handleUserDateSelect}
                onDesktopPlannerModeChange={setDesktopPlannerMode}
                onOpenMonthView={() => setShowMonthView(true)}
                companionFrostedThemeStyle={companionFrostedThemeStyle}
                onTimeSlotLongPress={(date, time) => {
                  openAddQuestSheet({ date, time });
                }}
              />
            )}
          </motion.div>
        </QuestsErrorBoundary>

        {PRODUCT.mode === "cosmiq" ? (
          <>
            <JourneysCompanionPlannerModal
              open={isCompanionPlannerOpen}
              onOpenChange={setIsCompanionPlannerOpen}
              presentation={isDesktopLayout || isMacHostedIOSApp ? "dialog" : "drawer"}
              selectedDate={selectedDate}
              launchIntent={plannerLaunchIntent}
              onLaunchIntentConsumed={(intentId) => {
                setPlannerLaunchIntent((current) => current?.id === intentId ? null : current);
              }}
              onOpenCampaignBuilder={(message) => {
                setIsCompanionPlannerOpen(false);
                openCampaignBuilder(message);
              }}
            />
            {!isMacHostedIOSApp && isJourneysRouteActive ? (
              <DraggableFAB
                onOpenCompanionPlanner={openCompanionPlanner}
                onCreateQuest={() => openAddQuestSheet()}
                createPlanDayLaunchIntent={createPlanDayLaunchIntent}
                planDayLabel={isSameDay(selectedDate, effectiveTodayDate) ? "Plan Today" : "Plan Day"}
              />
            ) : null}
          </>
        ) : null}

        {/* Add Quest Sheet */}
        <AddQuestSheet
          open={showAddSheet}
          onOpenChange={handleAddQuestSheetOpenChange}
          selectedDate={selectedDate}
          onAdd={handleAddQuest}
          isAdding={isAdding}
          prefilledTime={prefilledTime}
          autoFillTimeOnFirstTap={false}
          presentation={isMacHostedIOSApp ? "desktop-panel" : "mobile-sheet"}
          prefillDraft={questSheetPrefillDraft}
          prefillKey={questSheetPrefillKey}
          autoRestoreDraftOnOpen={autoRestoreQuestDraftOnOpen}
          persistenceRoute="/journeys"
          onCreateCampaign={() => openCampaignBuilder()}
          companionFrostedThemeStyle={companionFrostedThemeStyle}
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
          companionFrostedThemeStyle={companionFrostedThemeStyle}
        />

        {/* Edit Ritual Sheet (for habits/rituals with two-way sync) */}
        <EditRitualSheet
          ritual={editingRitual}
          open={!!editingRitual}
          onOpenChange={(open) => !open && closeEditingRitual()}
          onDelete={handleDeleteRitual}
          companionFrostedThemeStyle={companionFrostedThemeStyle}
        />

        <HourlyViewModal
          open={showMonthView}
          onOpenChange={setShowMonthView}
          selectedDate={selectedDate}
          onDateSelect={handleUserDateSelect}
          tasks={allCalendarTasks}
          milestones={[]}
          onTaskDrop={() => {}}
          onTimeSlotLongPress={(date, time) => {
            handleUserDateSelect(date);
            setPrefilledTime(time);
            setAutoRestoreQuestDraftOnOpen(false);
            setAddQuestSheetOpen(true);
          }}
        />

        <PageInfoModal
          open={showPageInfo}
          onClose={() => setShowPageInfo(false)}
          title="About your plan"
          icon={Compass}
          description="Daily actions and longer commitments belong in one realistic view."
          features={[
            "Add, schedule, and complete daily actions",
            "Create Commitments for goals that need a longer horizon",
            "Keep recurring rhythms beside ordinary responsibilities"
          ]}
          tip="Add one clear action with +, or create a Commitment for a goal that needs a rhythm."
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

        {/* Pathfinder - Campaign Creation Wizard */}
        <Pathfinder
          key={pathfinderSessionKey}
          open={showPathfinder}
          onOpenChange={handlePathfinderOpenChange}
          onCreateEpic={handleCreateCampaign}
          isCreating={isCreatingCampaign}
          initialGoal={pathfinderInitialGoal}
          resumeDraft={pathfinderResumeDraft}
          resumeDraftKey={pathfinderResumeDraftKey}
          persistenceRoute="/journeys"
          userId={user?.id}
          showTemplatesFirst={false}
          companionFrostedThemeStyle={companionFrostedThemeStyle}
        />

      </div>
      </div>

    </PageTransition>
  );
};

export default Journeys;
