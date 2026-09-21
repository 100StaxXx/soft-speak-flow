import type { ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { format, isSameDay } from "date-fns";
import { MemoryRouter, useLocation, useNavigate } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { JOURNEYS_RESET_TO_TODAY_EVENT } from "@/pages/journeysDateSync";
import {
  getCampaignBuilderDraftStorageKey,
  getCreationPopupMarkerStorageKey,
} from "@/utils/accountLocalState";

if (!HTMLElement.prototype.scrollTo) {
  Object.defineProperty(HTMLElement.prototype, "scrollTo", {
    value: () => undefined,
    configurable: true,
    writable: true,
  });
}
const elementScrollToSpy = vi.spyOn(HTMLElement.prototype, "scrollTo").mockImplementation(() => undefined);

vi.mock("@/hooks/useJourneysCompanionVisual", () => ({
  useJourneysCompanionVisual: () => ({
    companionLabel: "Nova",
    imageUrl: "/placeholder-companion.svg",
    focalX: null,
    focalY: null,
    element: "fire",
    usesPortraitShell: false,
  }),
}));

const localStorageState = vi.hoisted(() => ({
  store: new Map<string, string>(),
}));

Object.defineProperty(globalThis, "localStorage", {
  configurable: true,
  value: {
    getItem: (key: string) => localStorageState.store.get(key) ?? null,
    setItem: (key: string, value: string) => {
      localStorageState.store.set(key, value);
    },
    removeItem: (key: string) => {
      localStorageState.store.delete(key);
    },
    clear: () => {
      localStorageState.store.clear();
    },
    key: (index: number) => Array.from(localStorageState.store.keys())[index] ?? null,
    get length() {
      return localStorageState.store.size;
    },
  },
});

const mocks = vi.hoisted(() => ({
  addTask: vi.fn(),
  toggleTask: vi.fn(),
  updateTask: vi.fn(),
  deleteTask: vi.fn(),
  restoreTask: vi.fn(),
  moveTaskToDate: vi.fn(),
  toggleInboxTask: vi.fn(),
  deleteInboxTask: vi.fn(),
  sendTaskToCalendarMutateAsync: vi.fn().mockResolvedValue(undefined),
  hasLinkedEvent: vi.fn(() => false),
  createEpic: vi.fn(),
  queueAction: vi.fn().mockResolvedValue(undefined),
  retryNow: vi.fn().mockResolvedValue(undefined),
  shouldQueueWrites: false,
  trackDailyPlanOutcome: vi.fn(),
  surfaceAllEpicHabits: vi.fn(),
  spawnRecurringTasks: vi.fn(),
  handleTaskCompleted: vi.fn(),
  logInteraction: vi.fn(),
  skipInteraction: vi.fn(),
  closeInteractionModal: vi.fn(),
  clearPendingTask: vi.fn(),
  pendingTaskId: null as string | null,
  useFreeze: vi.fn(),
  resetStreak: vi.fn(),
  addAppListener: vi.fn(async () => ({ remove: vi.fn(async () => {}) })),
  isTabActive: true,
  unsurfacedEpicHabitsCount: 0,
  pendingRecurringCount: 0,
  calendarConnections: [] as Array<{ provider: string; sync_mode: string }>,
  epics: [] as Array<{
    id: string;
    title: string;
    status: string;
    description?: string | null;
    progress_percentage?: number | null;
    target_days: number;
    start_date: string;
    end_date: string | null;
    epic_habits?: Array<unknown>;
  }>,
  epicsLoading: false,
  isMacHostedIOSApp: false,
  profileTimezone: null as string | null,
  draggableFabRenderCount: 0,
  lastDatePillSelectedDate: null as Date | null,
  lastDatePillCenterRequestKey: null as number | null,
  lastDatePillCenterRequestDateKey: null as string | null,
  lastDatePillResetRangeOnCenterRequest: null as boolean | null,
  lastAddQuestSheetProps: null as null | {
    autoFillTimeOnFirstTap?: boolean;
    autoRestoreDraftOnOpen?: boolean;
    open?: boolean;
    onOpenChange?: (open: boolean) => void;
    presentation?: string;
    persistenceRoute?: string;
    prefillKey?: string | null;
    prefillDraft?: {
      text?: string;
      taskDate?: string | null;
      scheduledTime?: string | null;
      estimatedDuration?: number | null;
      reminderEnabled?: boolean;
      reminderMinutesBefore?: number;
      moreInformation?: string | null;
      location?: string | null;
      subtasks?: string[];
      creationSource?: string;
    } | null;
    onAdd?: (data: {
      text: string;
      taskDate: string | null;
      difficulty: "easy" | "medium" | "hard";
      scheduledTime: string | null;
      estimatedDuration: number | null;
      recurrencePattern: string | null;
      recurrenceDays: number[];
      recurrenceMonthDays: number[];
      recurrenceCustomPeriod: "week" | "month" | null;
      reminderEnabled: boolean;
      reminderMinutesBefore: number;
      moreInformation: string | null;
      location: string | null;
      contactId: string | null;
      autoLogInteraction: boolean;
      sendToInbox: boolean;
      sendToCalendar: boolean;
      sendToCalendarTarget: "apple" | "google" | "outlook" | "all" | null;
      subtasks: string[];
      imageUrl: string | null;
      attachments: [];
      creationSource: string;
    }) => Promise<void>;
  },
  lastCompanionPlannerModalProps: null as null | {
    open?: boolean;
    onOpenChange?: (open: boolean) => void;
    presentation?: string;
    selectedDate?: Date | null;
    launchIntent?: unknown;
    onQuestProposalEditHandoff?: (proposal: {
      id: string;
      kind: "create_quest" | "update_quest" | "suggest_reminder";
      title: string;
      summary: string;
      payload: Record<string, unknown>;
      status: "pending";
      readyToConfirm: boolean;
    }) => Promise<{ saved: boolean; savedTitle?: string | null }>;
  },
  lastEditQuestDialogProps: null as null | {
    open?: boolean;
    task?: {
      id: string;
      task_text: string;
      scheduled_time?: string | null;
    } | null;
    plannerSubtaskDraft?: string[] | null;
    onSave?: (taskId: string, updates: Record<string, unknown>) => Promise<void>;
  },
  lastDraggableFabOnOpenCompanionPlanner: null as null | ((intent?: unknown) => void),
  lastDraggableFabCreatePlanDayLaunchIntent: null as null | (() => unknown),
  lastDraggableFabPlanDayLabel: null as string | null,
  lastPathfinderProps: null as null | {
    open?: boolean;
    initialGoal?: string;
    resumeDraft?: unknown;
    resumeDraftKey?: string | null;
    persistenceRoute?: string;
    userId?: string | null;
    onOpenChange?: (open: boolean) => void;
  },
  tutorialGuidance: {
    isActive: false,
    currentStep: null as string | null,
    currentSubstep: null as string | null,
  },
  dailyTasks: [] as Array<{
    id: string;
    task_text: string;
    completed: boolean;
    xp_reward: number;
    task_date: string;
    scheduled_time: string | null;
    difficulty: string;
    is_main_quest: boolean;
    habit_source_id?: string | null;
    epic_id?: string | null;
    epic_title?: string | null;
  }>,
  inboxTasks: [] as Array<{
    id: string;
    task_text: string;
    completed: boolean;
    xp_reward: number;
    task_date: string | null;
    scheduled_time: string | null;
    difficulty: string;
    is_main_quest: boolean;
  }>,
}));

vi.mock("@/components/PageTransition", () => ({
  PageTransition: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

vi.mock("@/components/CinematicPageBackground", () => ({
  CinematicPageBackground: ({ preset }: { preset: string }) => (
    <div data-testid="cinematic-background" data-preset={preset} />
  ),
}));

vi.mock("@/components/BottomNav", () => ({
  BottomNav: () => null,
}));

vi.mock("@/components/AddQuestSheet", () => ({
  AddQuestSheet: (props: {
    autoFillTimeOnFirstTap?: boolean;
    autoRestoreDraftOnOpen?: boolean;
    open?: boolean;
    onOpenChange?: (open: boolean) => void;
    presentation?: string;
    persistenceRoute?: string;
    prefillKey?: string | null;
    prefillDraft?: {
      text?: string;
      taskDate?: string | null;
      scheduledTime?: string | null;
      estimatedDuration?: number | null;
      reminderEnabled?: boolean;
      reminderMinutesBefore?: number;
      moreInformation?: string | null;
      location?: string | null;
      subtasks?: string[];
      creationSource?: string;
    } | null;
    onAdd?: (data: {
      text: string;
      taskDate: string | null;
      difficulty: "easy" | "medium" | "hard";
      scheduledTime: string | null;
      estimatedDuration: number | null;
      recurrencePattern: string | null;
      recurrenceDays: number[];
      recurrenceMonthDays: number[];
      recurrenceCustomPeriod: "week" | "month" | null;
      reminderEnabled: boolean;
      reminderMinutesBefore: number;
      moreInformation: string | null;
      location: string | null;
      contactId: string | null;
      autoLogInteraction: boolean;
      sendToInbox: boolean;
      sendToCalendar: boolean;
      sendToCalendarTarget: "apple" | "google" | "outlook" | "all" | null;
      subtasks: string[];
      imageUrl: string | null;
      attachments: [];
      creationSource: string;
    }) => Promise<void>;
  }) => {
    mocks.lastAddQuestSheetProps = props;
    return null;
  },
}));

vi.mock("@/components/journeys/JourneysCompanionPlannerModal", () => ({
  JourneysCompanionPlannerModal: (props: {
    open?: boolean;
    onOpenChange?: (open: boolean) => void;
    presentation?: string;
    selectedDate?: Date | null;
    launchIntent?: unknown;
    onLaunchIntentConsumed?: (intentId: string) => void;
    onQuestProposalEditHandoff?: (proposal: {
      id: string;
      kind: "create_quest" | "update_quest" | "suggest_reminder";
      title: string;
      summary: string;
      payload: Record<string, unknown>;
      status: "pending";
      readyToConfirm: boolean;
    }) => Promise<{ saved: boolean; savedTitle?: string | null }>;
  }) => {
    mocks.lastCompanionPlannerModalProps = props;

    if (!props.open) {
      return null;
    }

    return (
      <div data-testid="journeys-companion-planner-modal">
        <button type="button" onClick={() => props.onOpenChange?.(false)}>
          close-planner-modal
        </button>
      </div>
    );
  },
}));

vi.mock("@/hooks/usePostOnboardingMentorGuidance", () => ({
  usePostOnboardingMentorGuidance: () => mocks.tutorialGuidance,
}));

vi.mock("@/hooks/useInboxTasks", () => ({
  useInboxTasks: () => ({
    inboxTasks: mocks.inboxTasks,
    inboxCount: mocks.inboxTasks.length,
    isLoading: false,
    toggleInboxTask: vi.fn(),
    deleteInboxTask: vi.fn(),
  }),
}));

vi.mock("@/components/PageInfoButton", () => ({
  PageInfoButton: () => null,
}));

vi.mock("@/components/PageInfoModal", () => ({
  PageInfoModal: () => null,
}));

vi.mock("@/components/StreakFreezePromptModal", () => ({
  StreakFreezePromptModal: () => null,
}));

vi.mock("@/features/quests/components/EditQuestDialog", () => ({
  EditQuestDialog: (props: {
    open?: boolean;
    task?: {
      id: string;
      task_text: string;
      scheduled_time?: string | null;
    } | null;
    plannerSubtaskDraft?: string[] | null;
    onSave?: (taskId: string, updates: Record<string, unknown>) => Promise<void>;
  }) => {
    mocks.lastEditQuestDialogProps = props;
    return null;
  },
}));

vi.mock("@/components/EditRitualSheet", () => ({
  EditRitualSheet: () => null,
}));

vi.mock("@/components/Pathfinder", () => ({
  Pathfinder: (props: {
    open?: boolean;
    initialGoal?: string;
    resumeDraft?: unknown;
    resumeDraftKey?: string | null;
    persistenceRoute?: string;
    userId?: string | null;
    onOpenChange?: (open: boolean) => void;
  }) => {
    mocks.lastPathfinderProps = props;
    return null;
  },
}));

vi.mock("@/components/CampaignCreatedAnimation", () => ({
  CampaignCreatedAnimation: () => null,
}));

vi.mock("@/components/DraggableFAB", () => ({
  DraggableFAB: ({
    onOpenCompanionPlanner,
    createPlanDayLaunchIntent,
    planDayLabel,
  }: {
    onOpenCompanionPlanner?: (intent?: unknown) => void;
    createPlanDayLaunchIntent?: () => unknown;
    planDayLabel?: string;
  }) => {
    mocks.draggableFabRenderCount += 1;
    mocks.lastDraggableFabOnOpenCompanionPlanner = onOpenCompanionPlanner ?? null;
    mocks.lastDraggableFabCreatePlanDayLaunchIntent = createPlanDayLaunchIntent ?? null;
    mocks.lastDraggableFabPlanDayLabel = planDayLabel ?? null;
    return (
      <div data-testid="draggable-fab">
        <button
          type="button"
          data-testid="journeys-companion-launcher-floating"
          data-tour="add-quest-fab"
          aria-label="Open companion quick actions"
          onClick={() => onOpenCompanionPlanner?.()}
        >
          fab
        </button>
      </div>
    );
  },
}));

vi.mock("@/components/tasks/InteractionLogModal", () => ({
  InteractionLogModal: () => null,
}));

vi.mock("@/components/SectionErrorBoundary", () => ({
  QuestsErrorBoundary: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

vi.mock("@/components/HourlyViewModal", () => ({
  HourlyViewModal: () => null,
}));

vi.mock("@/components/JourneyPathDrawer", () => ({
  JourneyPathDrawer: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

vi.mock("../components/SwipeableTaskItem", () => ({
  SwipeableTaskItem: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

vi.mock("@/components/ui/marquee-text", () => ({
  MarqueeText: ({
    text,
    className,
    textClassName,
  }: {
    text: string;
    className?: string;
    textClassName?: string;
  }) => (
    <span className={className}>
      <span className={textClassName}>{text}</span>
    </span>
  ),
}));

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({
    user: { id: "user-1" },
  }),
}));

vi.mock("@/hooks/useProfile", () => ({
  useProfile: () => ({
    profile: {
      completed_tasks_stay_in_place: true,
      onboarding_completed: true,
      onboarding_data: {},
      timezone: mocks.profileTimezone,
    },
    loading: false,
  }),
}));

vi.mock("@/hooks/useStreakAtRisk", () => ({
  useStreakAtRisk: () => ({
    needsStreakDecision: false,
    currentStreak: 0,
    freezesAvailable: 0,
    useFreeze: mocks.useFreeze,
    resetStreak: mocks.resetStreak,
    isResolving: false,
  }),
}));

vi.mock("@/hooks/useAIInteractionTracker", () => ({
  useAIInteractionTracker: () => ({
    trackDailyPlanOutcome: mocks.trackDailyPlanOutcome,
  }),
}));

vi.mock("@/hooks/useEpics", () => ({
  useEpics: () => ({
    epics: mocks.epics,
    isLoading: mocks.epicsLoading,
    createEpic: mocks.createEpic,
    isCreating: false,
  }),
}));

vi.mock("@/hooks/useStreakMultiplier", () => ({
  useStreakMultiplier: () => ({
    currentStreak: 0,
  }),
}));

vi.mock("@/hooks/useQuestCalendarSync", () => ({
  useQuestCalendarSync: () => ({
    sendTaskToCalendar: {
      mutateAsync: mocks.sendTaskToCalendarMutateAsync,
      isPending: false,
    },
    syncLinkedTask: { mutateAsync: vi.fn() },
    removeTaskFromCalendars: { mutateAsync: vi.fn() },
    hasLinkedEvent: mocks.hasLinkedEvent,
    links: [],
    outlookTaskLinks: [],
  }),
}));

vi.mock("@/hooks/useExternalCalendarEvents", () => ({
  useExternalCalendarEvents: () => ({
    events: [],
    errors: [],
    connectedProviderCount: 0,
    isFetching: false,
    refresh: vi.fn(),
  }),
}));

vi.mock("@/hooks/useCalendarIntegrations", () => ({
  useCalendarIntegrations: () => ({
    connections: mocks.calendarConnections,
  }),
}));

vi.mock("@/hooks/useTaskCompletionWithInteraction", () => ({
  useTaskCompletionWithInteraction: () => ({
    pendingInteraction: null,
    isModalOpen: false,
    handleTaskCompleted: mocks.handleTaskCompleted,
    logInteraction: mocks.logInteraction,
    skipInteraction: mocks.skipInteraction,
    closeModal: mocks.closeInteractionModal,
  }),
}));

vi.mock("@/hooks/useDailyTasks", () => ({
  useDailyTasks: () => ({
    tasks: mocks.dailyTasks,
    isLoading: false,
    addTask: mocks.addTask,
    toggleTask: mocks.toggleTask,
    updateTask: mocks.updateTask,
    deleteTask: mocks.deleteTask,
    restoreTask: mocks.restoreTask,
    moveTaskToDate: mocks.moveTaskToDate,
    moveTaskToDateAsync: mocks.moveTaskToDate,
    completedCount: mocks.dailyTasks.filter((task) => task.completed).length,
    totalCount: mocks.dailyTasks.length,
    isAdding: false,
    isUpdating: false,
    isDeleting: false,
  }),
}));

vi.mock("@/hooks/useInboxTasks", () => ({
  useInboxTasks: () => ({
    inboxTasks: mocks.inboxTasks,
    inboxCount: mocks.inboxTasks.length,
    isLoading: false,
    toggleInboxTask: mocks.toggleInboxTask,
    deleteInboxTask: mocks.deleteInboxTask,
  }),
}));

vi.mock("@/hooks/useCalendarTasks", () => ({
  useCalendarTasks: () => ({
    tasks: mocks.dailyTasks,
  }),
}));

vi.mock("@/hooks/useHabitSurfacing", () => ({
  useHabitSurfacing: () => ({
    surfaceAllEpicHabits: mocks.surfaceAllEpicHabits,
    unsurfacedEpicHabitsCount: mocks.unsurfacedEpicHabitsCount,
  }),
}));

vi.mock("@/hooks/useRecurringTaskSpawner", () => ({
  useRecurringTaskSpawner: () => ({
    pendingRecurringCount: mocks.pendingRecurringCount,
    spawnRecurringTasks: mocks.spawnRecurringTasks,
  }),
}));

vi.mock("@/contexts/ResilienceContext", () => ({
  useResilience: () => ({
    queueAction: mocks.queueAction,
    shouldQueueWrites: mocks.shouldQueueWrites,
    retryNow: mocks.retryNow,
  }),
}));

vi.mock("@/contexts/MainTabVisibilityContext", () => ({
  useMainTabVisibility: () => ({
    isTabActive: mocks.isTabActive,
  }),
}));

vi.mock("@/hooks/useOnboardingTaskCleanup", () => ({
  useOnboardingTaskCleanup: vi.fn(),
}));

vi.mock("@/contexts/DeepLinkContext", () => ({
  useDeepLink: () => ({
    pendingTaskId: mocks.pendingTaskId,
    clearPendingTask: mocks.clearPendingTask,
  }),
}));

vi.mock("@/utils/platformTargets", () => ({
  isMacDesignedForIPadIOSApp: () => mocks.isMacHostedIOSApp,
  isNativeIOSHandheld: () => false,
  isMacSession: () => mocks.isMacHostedIOSApp,
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: vi.fn(() => ({
      delete: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: null }),
    })),
  },
}));

vi.mock("@capacitor/core", () => ({
  Capacitor: {
    isNativePlatform: () => false,
    getPlatform: () => "web",
  },
}));

vi.mock("@capacitor/app", () => ({
  App: {
    addListener: mocks.addAppListener,
  },
}));

vi.mock("@capacitor/haptics", () => ({
  Haptics: {
    impact: vi.fn().mockResolvedValue(undefined),
  },
  ImpactStyle: {
    Light: "LIGHT",
    Medium: "MEDIUM",
    Heavy: "HEAVY",
  },
}));

const dispatchPointerMove = (clientY: number) => {
  const event = new Event("pointermove") as PointerEvent;
  Object.defineProperty(event, "clientY", { value: clientY });
  window.dispatchEvent(event);
};

const dispatchTouchMove = (
  clientY: number,
  target: EventTarget = typeof document !== "undefined" ? document : window,
) => {
  const event = new Event("touchmove", { bubbles: true, cancelable: true }) as TouchEvent;
  Object.defineProperty(event, "touches", { value: [{ clientX: 0, clientY }] });
  target.dispatchEvent(event);
  return event;
};

const dispatchTouchEnd = (
  target: EventTarget = typeof document !== "undefined" ? document : window,
) => {
  const event = new Event("touchend", { bubbles: true, cancelable: true }) as TouchEvent;
  Object.defineProperty(event, "changedTouches", { value: [{ clientX: 0, clientY: 0 }] });
  target.dispatchEvent(event);
  return event;
};

const createPointerDownEvent = (clientY: number) => {
  const event = new Event("pointerdown", { bubbles: true, cancelable: true }) as PointerEvent;
  Object.defineProperty(event, "pointerType", { value: "mouse" });
  Object.defineProperty(event, "button", { value: 0 });
  Object.defineProperty(event, "clientY", { value: clientY });
  return event;
};

const performTouchTimelineDrag = (row: HTMLElement, moveY: number, startY = 100) => {
  vi.useFakeTimers();
  act(() => {
    fireEvent.touchStart(row, { touches: [{ clientX: 0, clientY: startY }] });
    vi.advanceTimersByTime(500);
    dispatchTouchMove(moveY);
    dispatchTouchEnd();
  });
  vi.useRealTimers();
};

import Journeys from "./Journeys";

describe("Journeys row drag integration", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    elementScrollToSpy.mockClear();
    localStorageState.store.clear();
    Object.defineProperty(window, "innerWidth", { configurable: true, value: 400 });
    mocks.isTabActive = true;
    mocks.pendingTaskId = null;
    mocks.unsurfacedEpicHabitsCount = 0;
    mocks.pendingRecurringCount = 0;
    mocks.calendarConnections = [];
    mocks.epics = [];
    mocks.isMacHostedIOSApp = false;
    mocks.profileTimezone = null;
    mocks.draggableFabRenderCount = 0;
    mocks.lastDatePillSelectedDate = null;
    mocks.lastDatePillCenterRequestKey = null;
    mocks.lastDatePillCenterRequestDateKey = null;
    mocks.lastDatePillResetRangeOnCenterRequest = null;
    mocks.lastAddQuestSheetProps = null;
    mocks.lastCompanionPlannerModalProps = null;
    mocks.lastEditQuestDialogProps = null;
    mocks.lastDraggableFabOnOpenCompanionPlanner = null;
    mocks.lastDraggableFabCreatePlanDayLaunchIntent = null;
    mocks.lastDraggableFabPlanDayLabel = null;
    mocks.lastPathfinderProps = null;
    mocks.tutorialGuidance = {
      isActive: false,
      currentStep: null,
      currentSubstep: null,
    };
    mocks.dailyTasks = [
      {
        id: "task-1",
        task_text: "Morning focus",
        completed: false,
        xp_reward: 20,
        task_date: "2026-02-13",
        scheduled_time: "08:00",
        difficulty: "medium",
        is_main_quest: false,
      },
    ];
    mocks.inboxTasks = [];
    Object.defineProperty(window, "innerHeight", {
      configurable: true,
      writable: true,
      value: 720,
    });
    Object.defineProperty(window, "visualViewport", {
      configurable: true,
      value: {
        height: 720,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      },
    });
  });

  it("reopens the add quest sheet from a persisted creation marker", async () => {
    localStorage.setItem(
      getCreationPopupMarkerStorageKey("user-1"),
      JSON.stringify({
        surface: "quest",
        route: "/journeys",
        selectedDate: "2026-01-15",
        updatedAt: "2026-05-01T12:00:00.000Z",
      }),
    );
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={["/journeys"]}>
          <Journeys />
        </MemoryRouter>
      </QueryClientProvider>,
    );

    await waitFor(() => {
      expect(mocks.lastAddQuestSheetProps?.open).toBe(true);
    });
    expect(mocks.lastAddQuestSheetProps?.autoRestoreDraftOnOpen).toBe(true);
    expect(mocks.lastAddQuestSheetProps?.persistenceRoute).toBe("/journeys");
  });

  it("reopens Pathfinder from a persisted journeys campaign marker", async () => {
    localStorage.setItem(
      getCreationPopupMarkerStorageKey("user-1"),
      JSON.stringify({
        surface: "campaign",
        route: "/journeys",
        selectedDate: null,
        updatedAt: "2026-05-01T12:00:00.000Z",
      }),
    );
    localStorage.setItem(
      getCampaignBuilderDraftStorageKey("user-1"),
      JSON.stringify({
        version: 1,
        step: "goal",
        goalInput: "Recovered campaign",
        deadline: null,
        timelineContext: "",
        epicTitle: "",
        epicWhy: "",
        storyType: null,
        themeColor: "heroic",
        customHabits: [],
        selectedTemplate: null,
        schedule: null,
        originalRituals: [],
        localClarificationAnswers: {},
        localEpicContext: null,
        showClarification: false,
        clarificationQuestions: [],
        updatedAt: "2026-05-01T12:01:00.000Z",
      }),
    );
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={["/journeys"]}>
          <Journeys />
        </MemoryRouter>
      </QueryClientProvider>,
    );

    await waitFor(() => {
      expect(mocks.lastPathfinderProps?.open).toBe(true);
    });
    expect((mocks.lastPathfinderProps?.resumeDraft as { goalInput?: string } | null)?.goalInput).toBe("Recovered campaign");
    expect(mocks.lastPathfinderProps?.resumeDraftKey).toBe("resume-2026-05-01T12:00:00.000Z");
    expect(mocks.lastPathfinderProps?.persistenceRoute).toBe("/journeys");
    expect(mocks.lastPathfinderProps?.userId).toBe("user-1");
  });

  it("passes tutorial auto-fill as false outside the create quest time substep", async () => {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={["/journeys"]}>
          <Journeys />
        </MemoryRouter>
      </QueryClientProvider>,
    );

    await waitFor(() => {
      expect(mocks.lastAddQuestSheetProps).not.toBeNull();
    });
    expect(mocks.lastAddQuestSheetProps?.autoFillTimeOnFirstTap).toBe(false);
  });

  it("passes tutorial auto-fill as true during create quest select_time", async () => {
    mocks.tutorialGuidance = {
      isActive: true,
      currentStep: "create_quest",
      currentSubstep: "select_time",
    };

    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={["/journeys"]}>
          <Journeys />
        </MemoryRouter>
      </QueryClientProvider>,
    );

    await waitFor(() => {
      expect(mocks.lastAddQuestSheetProps).not.toBeNull();
    });
    expect(mocks.lastAddQuestSheetProps?.autoFillTimeOnFirstTap).toBe(true);
  });

  it("restores companion chat alongside the desktop launcher on Mac-hosted iOS", async () => {
    mocks.isMacHostedIOSApp = true;
    Object.defineProperty(window, "innerWidth", {
      configurable: true,
      writable: true,
      value: 1100,
    });

    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={["/journeys"]}>
          <Journeys />
        </MemoryRouter>
      </QueryClientProvider>,
    );

    const launcher = await screen.findByRole("button", { name: /Plan (Today|Day)/i });
    expect(launcher).toBeInTheDocument();
    expect(launcher).toHaveAttribute("data-tour", "add-quest-launcher");
    expect(screen.queryByTestId("draggable-fab")).toBeInTheDocument();
    expect(mocks.draggableFabRenderCount).toBeGreaterThan(0);
    expect(mocks.lastAddQuestSheetProps?.presentation).toBe("desktop-panel");
    expect(mocks.lastCompanionPlannerModalProps?.presentation).toBe("dialog");
  });

  it("keeps the journeys add quest button targetable for the tutorial", async () => {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={["/journeys"]}>
          <Journeys />
        </MemoryRouter>
      </QueryClientProvider>,
    );

    expect(await screen.findByLabelText("Add quest")).toHaveAttribute("data-tour", "add-quest-launcher");
    expect(mocks.draggableFabRenderCount).toBeGreaterThan(0);
  });

  it("builds the desktop FAB Plan Today intent from the visible journeys context", async () => {
    Object.defineProperty(window, "innerWidth", { configurable: true, value: 1440 });
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(new Date("2026-05-12T12:00:00"));
    mocks.dailyTasks = [
      {
        id: "ritual-task",
        task_text: "Morning ritual",
        completed: false,
        xp_reward: 10,
        task_date: "2026-05-12",
        scheduled_time: "07:30",
        difficulty: "easy",
        is_main_quest: false,
        habit_source_id: "habit-1",
        epic_id: "epic-1",
        epic_title: "Launch Planner",
      },
      {
        id: "campaign-task",
        task_text: "Draft launch notes",
        completed: false,
        xp_reward: 20,
        task_date: "2026-05-12",
        scheduled_time: null,
        difficulty: "medium",
        is_main_quest: true,
        epic_id: "epic-1",
        epic_title: "Launch Planner",
      },
    ];
    mocks.epics = [{
      id: "epic-1",
      title: "Launch Planner",
      status: "active",
      progress_percentage: 40,
      target_days: 30,
      start_date: "2026-05-01",
      end_date: null,
    }];
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={["/journeys"]}>
          <Journeys />
        </MemoryRouter>
      </QueryClientProvider>,
    );

    await waitFor(() => {
      expect(mocks.lastDraggableFabCreatePlanDayLaunchIntent).not.toBeNull();
    });

    const launchIntent =
      mocks.lastDraggableFabCreatePlanDayLaunchIntent?.() as {
        starterIntent?: string;
        selectedDate?: string | null;
        briefingContext?: {
          content?: string;
          dataSnapshot?: Record<string, unknown> | null;
        } | null;
      };

    expect(mocks.lastDraggableFabPlanDayLabel).toBe("Plan Today");
    expect(launchIntent).toEqual(expect.objectContaining({
      starterIntent: "plan_day",
      selectedDate: "2026-05-12",
    }));
    expect(launchIntent.briefingContext?.content).toContain("2 open quests");
    expect(launchIntent.briefingContext?.dataSnapshot).toEqual(expect.objectContaining({
      selectedDate: "2026-05-12",
      ritualQuestCount: 1,
      activeCampaignTitles: ["Launch Planner"],
      activeCampaigns: [expect.objectContaining({
        id: "epic-1",
        title: "Launch Planner",
      })],
      topOpenQuests: expect.arrayContaining([
        expect.stringContaining("Morning ritual"),
        expect.stringContaining("campaign: Launch Planner"),
      ]),
      visibleQuests: expect.arrayContaining([
        expect.objectContaining({
          id: "ritual-task",
          habit_source_id: "habit-1",
          epic_id: "epic-1",
          epic_title: "Launch Planner",
        }),
        expect.objectContaining({
          id: "campaign-task",
          epic_id: "epic-1",
          epic_title: "Launch Planner",
        }),
      ]),
    }));

    act(() => {
      mocks.lastDraggableFabOnOpenCompanionPlanner?.(launchIntent);
    });

    expect(mocks.lastCompanionPlannerModalProps?.launchIntent).toEqual(launchIntent);
  });

  it("opens the companion planner modal from the desktop journeys launcher", async () => {
    mocks.isMacHostedIOSApp = true;
    Object.defineProperty(window, "innerWidth", {
      configurable: true,
      writable: true,
      value: 1100,
    });

    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={["/journeys"]}>
          <Journeys />
        </MemoryRouter>
      </QueryClientProvider>,
    );

    const launcher = await screen.findByRole("button", { name: /Plan (Today|Day)/i });
    fireEvent.click(launcher);

    await waitFor(() => {
      expect(mocks.lastCompanionPlannerModalProps?.open).toBe(true);
    });
    expect(screen.getByTestId("journeys-companion-planner-modal")).toBeInTheDocument();
  });

  it("passes the selected journeys date into the companion planner modal", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(new Date("2026-05-12T12:00:00"));
    mocks.isMacHostedIOSApp = true;
    Object.defineProperty(window, "innerWidth", {
      configurable: true,
      writable: true,
      value: 1100,
    });
    const expectedDateKey = format(new Date(), "yyyy-MM-dd");

    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={["/journeys"]}>
          <Journeys />
        </MemoryRouter>
      </QueryClientProvider>,
    );

    const launcher = await screen.findByRole("button", { name: /Plan (Today|Day)/i });
    fireEvent.click(launcher);

    await waitFor(() => {
      expect(mocks.lastCompanionPlannerModalProps?.open).toBe(true);
    });
    expect(
      mocks.lastCompanionPlannerModalProps?.selectedDate?.toISOString().slice(0, 10),
    ).toBe(expectedDateKey);
  });

  it("keeps the planner closed on first load even when an old pinned preference exists", async () => {
    localStorageState.store.set("journeys-companion-planner-pinned-v1", "true");

    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={["/journeys"]}>
          <Journeys />
        </MemoryRouter>
      </QueryClientProvider>,
    );

    await waitFor(() => {
      expect(mocks.lastCompanionPlannerModalProps).not.toBeNull();
    });
    expect(mocks.lastCompanionPlannerModalProps?.open).toBe(false);
    expect(screen.queryByTestId("journeys-companion-planner-modal")).not.toBeInTheDocument();
  });

  it("opens the planner when journeys receives a route launch intent", async () => {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={[{
          pathname: "/journeys",
          state: {
            companionPlannerLaunchIntent: {
              id: "launch-intent-1",
              message: "Help me plan my afternoon.",
              starterIntent: "plan_my_day",
              target: "planner",
              briefingContext: null,
            },
          },
        }]}>
          <Journeys />
        </MemoryRouter>
      </QueryClientProvider>,
    );

    await waitFor(() => {
      expect(mocks.lastCompanionPlannerModalProps?.open).toBe(true);
    });
    expect(mocks.lastCompanionPlannerModalProps?.launchIntent).toEqual(expect.objectContaining({
      id: "launch-intent-1",
      message: "Help me plan my afternoon.",
    }));
    expect(screen.getByTestId("journeys-companion-planner-modal")).toBeInTheDocument();
  });

  it("closes the planner when the guided tutorial leaves Plan My Day", async () => {
    mocks.tutorialGuidance = {
      isActive: true,
      currentStep: "plan_my_day",
      currentSubstep: null,
    };
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });

    const renderTree = () => (
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={["/journeys"]}>
          <Journeys />
        </MemoryRouter>
      </QueryClientProvider>
    );

    const { rerender } = render(renderTree());

    await waitFor(() => {
      expect(mocks.lastCompanionPlannerModalProps).not.toBeNull();
    });

    act(() => {
      mocks.lastCompanionPlannerModalProps?.onOpenChange?.(true);
    });

    await waitFor(() => {
      expect(mocks.lastCompanionPlannerModalProps?.open).toBe(true);
    });

    mocks.tutorialGuidance = {
      isActive: true,
      currentStep: "first_plan_closeout",
      currentSubstep: null,
    };
    rerender(renderTree());

    await waitFor(() => {
      expect(mocks.lastCompanionPlannerModalProps?.open).toBe(false);
    });
    expect(mocks.lastCompanionPlannerModalProps?.launchIntent).toBeNull();
    expect(screen.queryByTestId("journeys-companion-planner-modal")).not.toBeInTheDocument();
  });

  it("closes stale blocking overlays when the guided tutorial changes steps", async () => {
    mocks.tutorialGuidance = {
      isActive: true,
      currentStep: "plan_my_day",
      currentSubstep: null,
    };
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });

    const renderTree = () => (
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={["/journeys"]}>
          <Journeys />
        </MemoryRouter>
      </QueryClientProvider>
    );

    const { rerender } = render(renderTree());

    await waitFor(() => {
      expect(mocks.lastAddQuestSheetProps).not.toBeNull();
      expect(mocks.lastPathfinderProps).not.toBeNull();
    });

    act(() => {
      mocks.lastAddQuestSheetProps?.onOpenChange?.(true);
      mocks.lastPathfinderProps?.onOpenChange?.(true);
    });

    await waitFor(() => {
      expect(mocks.lastAddQuestSheetProps?.open).toBe(true);
      expect(mocks.lastPathfinderProps?.open).toBe(true);
    });

    mocks.tutorialGuidance = {
      isActive: true,
      currentStep: "first_plan_closeout",
      currentSubstep: null,
    };
    rerender(renderTree());

    await waitFor(() => {
      expect(mocks.lastAddQuestSheetProps?.open).toBe(false);
      expect(mocks.lastPathfinderProps?.open).toBe(false);
    });

    act(() => {
      mocks.lastPathfinderProps?.onOpenChange?.(true);
    });
    await waitFor(() => {
      expect(mocks.lastPathfinderProps?.open).toBe(true);
    });

    rerender(renderTree());
    expect(mocks.lastPathfinderProps?.open).toBe(true);
  });

  it("opens the companion planner from a route launch intent", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(new Date("2026-04-09T12:00:00"));

    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={[{
          pathname: "/journeys",
          state: {
            companionPlannerLaunchIntent: {
              id: "planner-route-1",
              message: "Plan my day",
              starterIntent: "plan_day",
              target: "planner",
              briefingContext: null,
            },
          },
        }]}>
          <Journeys />
        </MemoryRouter>
      </QueryClientProvider>,
    );

    await waitFor(() => {
      expect(mocks.lastCompanionPlannerModalProps?.open).toBe(true);
    });

    expect(mocks.lastCompanionPlannerModalProps?.launchIntent).toEqual(
      expect.objectContaining({
        id: "planner-route-1",
        message: "Plan my day",
        starterIntent: "plan_day",
      }),
    );
    expect(mocks.lastAddQuestSheetProps?.open).not.toBe(true);
  });

  it("opens create quest from the floating fab route request without opening the companion planner", async () => {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={[{
          pathname: "/journeys",
          state: {
            companionPlannerLaunchIntent: {
              id: "stale-planner-intent-1",
              message: "Plan my day",
              starterIntent: "plan_day",
              target: "planner",
              briefingContext: null,
            },
            journeysCreateQuestRequest: {
              id: "create-quest-fab-1",
            },
          },
        }]}>
          <Journeys />
        </MemoryRouter>
      </QueryClientProvider>,
    );

    await waitFor(() => {
      expect(mocks.lastAddQuestSheetProps?.open).toBe(true);
    });

    expect(mocks.lastCompanionPlannerModalProps?.open).not.toBe(true);
    expect(mocks.lastAddQuestSheetProps?.prefillDraft).toBeNull();
  });

  it("keeps the planner open while a planner quest edit handoff is active and resolves back after save", async () => {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={[{
          pathname: "/journeys",
          state: {
            companionPlannerLaunchIntent: {
              id: "planner-handoff-1",
              message: "Help me plan my afternoon.",
              starterIntent: "plan_day",
              target: "planner",
              briefingContext: null,
            },
          },
        }]}>
          <Journeys />
        </MemoryRouter>
      </QueryClientProvider>,
    );

    await waitFor(() => {
      expect(mocks.lastCompanionPlannerModalProps?.open).toBe(true);
    });

    let handoffPromise:
      | Promise<{ saved: boolean; savedTitle?: string | null }>
      | undefined;

    await act(async () => {
      handoffPromise = mocks.lastCompanionPlannerModalProps?.onQuestProposalEditHandoff?.({
        id: "proposal-create-1",
        kind: "create_quest",
        title: "Respond to emails",
        summary: "Carve out a short inbox block first thing.",
        payload: {
          taskText: "Respond to emails",
          taskDate: "2026-02-13",
          scheduledTime: "09:00",
          estimatedDuration: 30,
          notes: "Start with urgent threads.",
          location: "Desk",
          subtasks: ["Reply to founders", "Clear urgent threads"],
        },
        status: "pending",
        readyToConfirm: true,
      });
    });

    await waitFor(() => {
      expect(mocks.lastAddQuestSheetProps?.open).toBe(true);
    });
    expect(mocks.lastCompanionPlannerModalProps?.open).toBe(true);
    expect(mocks.lastAddQuestSheetProps?.prefillDraft).toEqual(expect.objectContaining({
      text: "Respond to emails",
      taskDate: "2026-02-13",
      scheduledTime: "09:00",
      estimatedDuration: 30,
      moreInformation: "Start with urgent threads.",
      location: "Desk",
      subtasks: ["Reply to founders", "Clear urgent threads"],
    }));

    await act(async () => {
      await mocks.lastAddQuestSheetProps?.onAdd?.({
        text: "Respond to emails",
        taskDate: "2026-02-13",
        difficulty: "medium",
        scheduledTime: "09:00",
        estimatedDuration: 30,
        recurrencePattern: null,
        recurrenceDays: [],
        recurrenceMonthDays: [],
        recurrenceCustomPeriod: null,
        reminderEnabled: false,
        reminderMinutesBefore: 15,
        moreInformation: "Start with urgent threads.",
        location: "Desk",
        contactId: null,
        autoLogInteraction: false,
        sendToInbox: false,
        sendToCalendar: false,
        sendToCalendarTarget: null,
        subtasks: ["Reply to founders", "Clear urgent threads"],
        imageUrl: null,
        attachments: [],
        creationSource: "nlp",
      });
    });

    await expect(handoffPromise).resolves.toEqual({
      saved: true,
      savedTitle: "Respond to emails",
    });
    await waitFor(() => {
      expect(mocks.lastAddQuestSheetProps?.open).toBe(false);
    });
    expect(mocks.lastCompanionPlannerModalProps?.open).toBe(true);
  });

  it("opens Pathfinder immediately for campaign-builder launcher intents without opening companion chat", async () => {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={[{
          pathname: "/journeys",
          state: {
            companionPlannerLaunchIntent: {
              id: "launch-goal",
              message: "Let's lock in a new goal",
              starterIntent: "goal_breakdown_start",
              target: "campaign_builder",
              briefingContext: null,
            },
          },
        }]}>
          <Journeys />
        </MemoryRouter>
      </QueryClientProvider>,
    );

    await waitFor(() => {
      expect(mocks.lastPathfinderProps?.open).toBe(true);
    });
    expect(mocks.lastPathfinderProps?.initialGoal ?? "").toBe("");
    expect(mocks.lastCompanionPlannerModalProps?.open).not.toBe(true);
  });

  it("opens the add flow with meta+n on Mac-hosted iOS", async () => {
    mocks.isMacHostedIOSApp = true;
    Object.defineProperty(window, "innerWidth", {
      configurable: true,
      writable: true,
      value: 1100,
    });

    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={["/journeys"]}>
          <Journeys />
        </MemoryRouter>
      </QueryClientProvider>,
    );

    await waitFor(() => {
      expect(mocks.lastAddQuestSheetProps?.open).toBe(false);
    });

    fireEvent.keyDown(window, { key: "n", metaKey: true });

    await waitFor(() => {
      expect(mocks.lastAddQuestSheetProps?.open).toBe(true);
    });
  });

  it("ignores meta+n while typing in an input on Mac-hosted iOS", async () => {
    mocks.isMacHostedIOSApp = true;
    Object.defineProperty(window, "innerWidth", {
      configurable: true,
      writable: true,
      value: 1100,
    });

    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={["/journeys"]}>
          <Journeys />
        </MemoryRouter>
      </QueryClientProvider>,
    );

    await waitFor(() => {
      expect(mocks.lastAddQuestSheetProps?.open).toBe(false);
    });

    const input = document.createElement("input");
    document.body.appendChild(input);
    input.focus();

    fireEvent.keyDown(input, { key: "n", metaKey: true });

    expect(mocks.lastAddQuestSheetProps?.open).toBe(false);

    input.remove();
  });

  it("does not reschedule a quest from pointer row drag on /journeys", async () => {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={["/journeys"]}>
          <Journeys />
        </MemoryRouter>
      </QueryClientProvider>,
    );

    expect(screen.getByTestId("calendar-toolbar")).toBeInTheDocument();
    const row = await screen.findByTestId("timeline-row-task-1");

    act(() => {
      fireEvent(row, createPointerDownEvent(100));
      dispatchPointerMove(825);
      window.dispatchEvent(new Event("pointerup"));
    });

    expect(mocks.updateTask).not.toHaveBeenCalled();
    expect(screen.getByTestId("calendar-toolbar")).toBeInTheDocument();
  });

  it("does not reschedule a quest from a sub-threshold timeline row wiggle on /journeys", async () => {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={["/journeys"]}>
          <Journeys />
        </MemoryRouter>
      </QueryClientProvider>,
    );

    const row = await screen.findByTestId("timeline-row-task-1");

    act(() => {
      fireEvent(row, createPointerDownEvent(100));
      dispatchPointerMove(111);
      window.dispatchEvent(new Event("pointerup"));
    });

    expect(mocks.updateTask).not.toHaveBeenCalled();
  });

  it("does not reschedule a quest from the timeline row touch drag path on /journeys", async () => {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={["/journeys"]}>
          <Journeys />
        </MemoryRouter>
      </QueryClientProvider>,
    );

    const row = await screen.findByTestId("timeline-row-task-1");

    performTouchTimelineDrag(row, 820);

    expect(mocks.updateTask).not.toHaveBeenCalled();
  });

  it("does not start the scheduled-time update queue from touch drag", async () => {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={["/journeys"]}>
          <Journeys />
        </MemoryRouter>
      </QueryClientProvider>,
    );

    const row = await screen.findByTestId("timeline-row-task-1");

    performTouchTimelineDrag(row, 825);

    expect(mocks.updateTask).not.toHaveBeenCalled();
  });

  it("does not run calendar sync after touch drag", async () => {
    mocks.updateTask.mockResolvedValueOnce({ queued: true });

    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={["/journeys"]}>
          <Journeys />
        </MemoryRouter>
      </QueryClientProvider>,
    );

    const row = await screen.findByTestId("timeline-row-task-1");

    performTouchTimelineDrag(row, 825);

    expect(mocks.updateTask).not.toHaveBeenCalled();
  });

  it("does not reschedule when row is clicked without drag movement", async () => {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={["/journeys"]}>
          <Journeys />
        </MemoryRouter>
      </QueryClientProvider>,
    );

    const row = await screen.findByTestId("timeline-row-task-1");

    act(() => {
      fireEvent(row, createPointerDownEvent(100));
      window.dispatchEvent(new Event("pointerup"));
    });

    expect(mocks.updateTask).not.toHaveBeenCalled();
  });

  it("does not reschedule any quest from touch drag when multiple quests are present", async () => {
    mocks.dailyTasks = [
      {
        id: "task-1",
        task_text: "Morning focus",
        completed: false,
        xp_reward: 20,
        task_date: "2026-02-13",
        scheduled_time: "08:00",
        difficulty: "medium",
        is_main_quest: false,
      },
      {
        id: "task-2",
        task_text: "Deep work",
        completed: false,
        xp_reward: 30,
        task_date: "2026-02-13",
        scheduled_time: "10:00",
        difficulty: "hard",
        is_main_quest: false,
      },
    ];

    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={["/journeys"]}>
          <Journeys />
        </MemoryRouter>
      </QueryClientProvider>,
    );

    const rowTaskOne = await screen.findByTestId("timeline-row-task-1");
    await screen.findByTestId("timeline-row-task-2");

    performTouchTimelineDrag(rowTaskOne, 825);

    expect(mocks.updateTask).not.toHaveBeenCalled();
  });

  it("does not clamp far-below touch drag movement into a quest time update", async () => {
    mocks.dailyTasks = [
      {
        id: "task-1",
        task_text: "Morning focus",
        completed: false,
        xp_reward: 20,
        task_date: "2026-02-13",
        scheduled_time: "08:00",
        difficulty: "medium",
        is_main_quest: false,
      },
      {
        id: "task-2",
        task_text: "Deep work",
        completed: false,
        xp_reward: 30,
        task_date: "2026-02-13",
        scheduled_time: "10:00",
        difficulty: "hard",
        is_main_quest: false,
      },
    ];

    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={["/journeys"]}>
          <Journeys />
        </MemoryRouter>
      </QueryClientProvider>,
    );

    const rowTaskOne = await screen.findByTestId("timeline-row-task-1");
    await screen.findByTestId("timeline-row-task-2");

    performTouchTimelineDrag(rowTaskOne, 6000);

    expect(mocks.updateTask).not.toHaveBeenCalled();
  });

  it("skips polling and auto-surface side effects while tab is inactive", async () => {
    mocks.isTabActive = false;
    mocks.unsurfacedEpicHabitsCount = 2;
    mocks.pendingRecurringCount = 2;
    mocks.calendarConnections = [
      {
        provider: "google",
        sync_mode: "send_only",
      },
    ];

    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={["/journeys"]}>
          <Journeys />
        </MemoryRouter>
      </QueryClientProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId("calendar-toolbar")).toBeInTheDocument();
    });

    expect(mocks.surfaceAllEpicHabits).not.toHaveBeenCalled();
    expect(mocks.spawnRecurringTasks).not.toHaveBeenCalled();
  });

  it("surfaces newly added campaign rituals when the unsurfaced count grows on the same date", async () => {
    mocks.unsurfacedEpicHabitsCount = 1;

    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });

    const view = render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={["/journeys"]}>
          <Journeys />
        </MemoryRouter>
      </QueryClientProvider>,
    );

    await waitFor(() => {
      expect(mocks.surfaceAllEpicHabits).toHaveBeenCalledTimes(1);
    });

    mocks.unsurfacedEpicHabitsCount = 3;

    view.rerender(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={["/journeys"]}>
          <Journeys />
        </MemoryRouter>
      </QueryClientProvider>,
    );

    await waitFor(() => {
      expect(mocks.surfaceAllEpicHabits).toHaveBeenCalledTimes(2);
    });
  });

  it("processes deep-linked task edit flow when journeys tab is active", async () => {
    mocks.pendingTaskId = "task-1";

    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={["/journeys"]}>
          <Journeys />
        </MemoryRouter>
      </QueryClientProvider>,
    );

    await waitFor(() => {
      expect(mocks.clearPendingTask).toHaveBeenCalledTimes(1);
    });
  });


  // These tests use the real compact toolbar. The removed date-pill mock and
  // internal centering counters did not exercise the current calendar controls.
  const selectedDayLabel = () => document.querySelector('[data-testid="journeys-mobile-date-strip"] button[aria-pressed="true"]')?.getAttribute("aria-label");
  const CalendarHarness = () => {
    const navigate = useNavigate();
    const location = useLocation();
    return <><button onClick={() => navigate("/mentor")}>leave-calendar</button>
      <button onClick={() => navigate("/journeys")}>return-calendar</button>
      <button onClick={() => navigate("/journeys?section=calendar")}>calendar-query</button>
      <span data-testid="calendar-route">{location.pathname}</span><Journeys /></>;
  };
  const renderCalendar = (date = "2026-05-12T12:00:00") => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(new Date(date));
    const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
    const renderTree = () => <QueryClientProvider client={client}><MemoryRouter initialEntries={["/journeys"]}><CalendarHarness /></MemoryRouter></QueryClientProvider>;
    return { ...render(renderTree()), renderTree };
  };
  const choosePreviousWeek = () => fireEvent.click(screen.getByRole("button", { name: "Previous week" }));
  const expectToday = () => expect(selectedDayLabel()).toBe("Tuesday, May 12, 2026");

  it("restores the mobile companion while keeping campaign sections off the calendar", () => {
    renderCalendar();
    expect(screen.queryByRole("button", { name: "Open campaigns page" })).not.toBeInTheDocument();
    expect(screen.queryByTestId("draggable-fab")).toBeInTheDocument();
    expect(screen.queryByText("No tasks for this day")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Calendar view" })).toBeInTheDocument();
  });
  it("navigates weeks and returns to today from the compact toolbar", async () => {
    renderCalendar(); expectToday(); choosePreviousWeek();
    expect(selectedDayLabel()).toBe("Tuesday, May 5, 2026");
    fireEvent.click(screen.getByRole("button", { name: "Today" }));
    await waitFor(expectToday);
  });
  it("resets stale selection when returning to the calendar route", async () => {
    renderCalendar(); choosePreviousWeek();
    fireEvent.click(screen.getByRole("button", { name: "leave-calendar" }));
    fireEvent.click(screen.getByRole("button", { name: "return-calendar" }));
    await waitFor(expectToday);
  });
  it("honors reset-to-today events without remounting the date strip", async () => {
    renderCalendar(); const strip = screen.getByTestId("journeys-mobile-date-strip"); choosePreviousWeek();
    act(() => window.dispatchEvent(new Event(JOURNEYS_RESET_TO_TODAY_EVENT)));
    await waitFor(expectToday);
    expect(screen.getByTestId("journeys-mobile-date-strip")).toBe(strip);
  });
  it("resets stale selection on foreground visibility and window focus", async () => {
    renderCalendar(); choosePreviousWeek();
    Object.defineProperty(document, "visibilityState", { configurable: true, value: "visible" });
    act(() => document.dispatchEvent(new Event("visibilitychange")));
    await waitFor(expectToday);
    choosePreviousWeek(); act(() => window.dispatchEvent(new Event("focus")));
    await waitFor(expectToday);
  });
  it("resets the calendar when its tab becomes active again", async () => {
    const view = renderCalendar(); choosePreviousWeek();
    mocks.isTabActive = false; view.rerender(view.renderTree());
    mocks.isTabActive = true; view.rerender(view.renderTree());
    await waitFor(expectToday);
  });
  it("preserves manual day selection when completing a quest", async () => {
    mocks.toggleTask.mockImplementation((payload, options) => options?.onSuccess?.({ completed: payload.completed, contact: null, autoLogInteraction: false }));
    renderCalendar(); choosePreviousWeek();
    fireEvent.click((await screen.findAllByRole("checkbox", { name: /mark task as complete/i }))[0]);
    await waitFor(() => expect(mocks.toggleTask).toHaveBeenCalled());
    expect(selectedDayLabel()).toBe("Tuesday, May 5, 2026");
  });
  it("defers query-navigation date resets while a quest sheet is open", async () => {
    renderCalendar(); choosePreviousWeek();
    fireEvent.click(screen.getByRole("button", { name: "Add quest" }));
    fireEvent.click(screen.getByRole("button", { name: "calendar-query" }));
    expect(selectedDayLabel()).toBe("Tuesday, May 5, 2026");
    act(() => mocks.lastAddQuestSheetProps?.onOpenChange?.(false));
    await waitFor(expectToday);
  });
  it("uses the previous mission date before the 2 AM boundary", async () => {
    renderCalendar("2026-05-12T01:30:00");
    act(() => window.dispatchEvent(new Event("focus")));
    await waitFor(() => expect(selectedDayLabel()).toBe("Monday, May 11, 2026"));
  });
});
