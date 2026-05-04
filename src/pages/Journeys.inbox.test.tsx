import type { ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import Journeys from "./Journeys";

const mocks = vi.hoisted(() => ({
  inboxTasks: [] as Array<{
    id: string;
    task_text: string;
    completed: boolean;
    task_date: string | null;
    difficulty?: string | null;
    scheduled_time?: string | null;
  }>,
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
  }>,
  addTask: vi.fn(async (params: { taskText: string; taskDate: string | null; difficulty: string }) => {
    if (params.taskDate === null) {
      mocks.inboxTasks = [
        ...mocks.inboxTasks,
        {
          id: `inbox-${mocks.inboxTasks.length + 1}`,
          task_text: params.taskText,
          completed: false,
          task_date: null,
          difficulty: params.difficulty,
          scheduled_time: null,
        },
      ];
    }

    return {
      id: `task-${Date.now()}`,
      task_date: params.taskDate,
      scheduled_time: null,
      difficulty: params.difficulty,
      task_text: params.taskText,
    };
  }),
  toggleTask: vi.fn(),
  updateTask: vi.fn().mockResolvedValue({ queued: false }),
  deleteTask: vi.fn(),
  restoreTask: vi.fn(),
  moveTaskToDate: vi.fn(),
  toggleInboxTask: vi.fn(),
  deleteInboxTask: vi.fn(),
  syncTaskUpdateMutateAsync: vi.fn().mockResolvedValue(undefined),
  syncTaskDeleteMutateAsync: vi.fn().mockResolvedValue(undefined),
  sendTaskToCalendarMutateAsync: vi.fn().mockResolvedValue(undefined),
  syncProviderPullMutate: vi.fn(),
  hasLinkedEvent: vi.fn(() => false),
  createEpic: vi.fn(),
  useFreeze: vi.fn(),
  resetStreak: vi.fn(),
  clearPendingTask: vi.fn(),
  handleTaskCompleted: vi.fn(),
  logInteraction: vi.fn(),
  skipInteraction: vi.fn(),
  closeInteractionModal: vi.fn(),
  surfaceAllEpicHabits: vi.fn(),
  spawnRecurringTasks: vi.fn(),
  queueAction: vi.fn().mockResolvedValue(undefined),
  retryNow: vi.fn().mockResolvedValue(undefined),
  scrollIntoView: vi.fn(),
  activeEpics: [] as Array<{
    id: string;
    title: string;
    status: string;
    progress_percentage?: number | null;
    target_days?: number;
    start_date?: string;
    end_date?: string | null;
    epic_habits?: Array<{ habit_id: string }>;
  }>,
  layoutMode: "mobile" as "mobile" | "desktop",
  weekCalendarTasks: [] as Array<{
    id: string;
    task_text: string;
    completed: boolean;
    xp_reward: number;
    task_date: string;
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

vi.mock("@/components/DatePillsScroller", () => ({
  DatePillsScroller: () => <div data-testid="date-pills" />,
}));

vi.mock("@/components/TodaysAgenda", () => ({
  TodaysAgenda: ({
    tasks,
    activeEpics,
    selectedDate,
    desktopPlannerMode,
    onDesktopPlannerModeChange,
    onAddQuest,
  }: {
    tasks: Array<{ id: string; task_text: string; habit_source_id?: string | null }>;
    activeEpics: Array<{ id: string; title: string }>;
    selectedDate: Date;
    desktopPlannerMode?: "week" | "day";
    onDesktopPlannerModeChange?: (mode: "week" | "day") => void;
    onAddQuest?: () => void;
  }) => (
    <div data-testid="todays-agenda">
      <div>agenda</div>
      <div data-testid="todays-agenda-selected-date">{selectedDate.toISOString()}</div>
      <div data-testid="todays-agenda-mode">{desktopPlannerMode ?? "unset"}</div>
      <button type="button" onClick={() => onAddQuest?.()}>
        open-add-quest
      </button>
      <button type="button" onClick={() => onDesktopPlannerModeChange?.("week")}>
        set-week-mode
      </button>
      <div data-testid="agenda-task-list">
        {tasks.map((task) => (
          <div key={task.id}>
            {task.task_text}
            {task.habit_source_id ? " (ritual)" : " (quest)"}
          </div>
        ))}
      </div>
      <div data-testid="agenda-campaign-list">
        {activeEpics.map((epic) => (
          <div key={epic.id}>{epic.title}</div>
        ))}
      </div>
    </div>
  ),
}));

vi.mock("@/components/DesktopWeekPlanner", () => ({
  DesktopWeekPlanner: ({
    selectedDate,
    onDateSelect,
    plannerMode,
    onPlannerModeChange,
  }: {
    selectedDate: Date;
    onDateSelect: (date: Date) => void;
    plannerMode?: "week" | "day";
    onPlannerModeChange?: (mode: "week" | "day") => void;
  }) => (
    <div data-testid="desktop-week-planner">
      <div data-testid="desktop-week-planner-selected-date">{selectedDate.toISOString()}</div>
      <div data-testid="desktop-week-planner-mode">{plannerMode ?? "unset"}</div>
      <button
        type="button"
        onClick={() => onDateSelect(new Date("2026-03-28T12:00:00.000Z"))}
      >
        select-desktop-week-date
      </button>
      <button type="button" onClick={() => onPlannerModeChange?.("day")}>
        set-day-mode
      </button>
    </div>
  ),
}));

vi.mock("@/components/AddQuestSheet", () => ({
  AddQuestSheet: ({
    open,
    onAdd,
  }: {
    open: boolean;
    onAdd: (data: unknown) => Promise<void>;
  }) =>
    open ? (
      <button
        type="button"
        onClick={() => {
          void onAdd({
            text: "Draft roadmap",
            taskDate: null,
            difficulty: "medium",
            scheduledTime: null,
            estimatedDuration: 30,
            recurrencePattern: null,
            recurrenceDays: [],
            recurrenceMonthDays: [],
            recurrenceCustomPeriod: null,
            reminderEnabled: false,
            reminderMinutesBefore: 15,
            moreInformation: null,
            location: null,
            contactId: null,
            autoLogInteraction: false,
            sendToInbox: true,
            sendToCalendar: false,
            subtasks: [],
            imageUrl: null,
            attachments: [],
          });
        }}
      >
        submit-inbox
      </button>
    ) : null,
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
  EditQuestDialog: () => null,
}));

vi.mock("@/components/EditRitualSheet", () => ({
  EditRitualSheet: () => null,
}));

vi.mock("@/components/HourlyViewModal", () => ({
  HourlyViewModal: () => null,
}));

vi.mock("@/components/tasks/InteractionLogModal", () => ({
  InteractionLogModal: () => null,
}));

vi.mock("@/components/Pathfinder", () => ({
  Pathfinder: () => null,
}));

vi.mock("@/components/CampaignCreatedAnimation", () => ({
  CampaignCreatedAnimation: () => null,
}));

vi.mock("@/components/DraggableFAB", () => ({
  DraggableFAB: ({ onOpenCompanionPlanner }: { onOpenCompanionPlanner?: () => void }) => (
    <button type="button" onClick={() => onOpenCompanionPlanner?.()}>
      open-companion-fab
    </button>
  ),
}));

vi.mock("@/components/journeys/JourneysCompanionPlannerModal", () => ({
  JourneysCompanionPlannerModal: () => null,
}));

vi.mock("@/hooks/useJourneysCompanionVisual", () => ({
  useJourneysCompanionVisual: () => ({
    companionLabel: "Nova",
    presetId: "dragon",
    imageUrl: "/placeholder-companion.svg",
    focalX: null,
    focalY: null,
    element: "fire",
    usesPortraitShell: false,
    launcherAwayImageUrl: "/placeholder-companion.svg",
    launcherAwayFocalX: null,
    launcherAwayFocalY: null,
    launcherAwayUsesPortraitShell: false,
    launcherImageUrl: "/placeholder-companion.svg",
    launcherImageFocalX: 0.5,
    launcherImageFocalY: 0.5,
    launcherImageFresh: false,
    launcherImageStatus: "ready",
    retryLauncherImage: vi.fn(),
  }),
}));

vi.mock("@/components/SectionErrorBoundary", () => ({
  QuestsErrorBoundary: ({ children }: { children: ReactNode }) => <>{children}</>,
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
    },
    loading: false,
  }),
}));

vi.mock("@/contexts/ResilienceContext", () => ({
  useResilience: () => ({
    queueAction: mocks.queueAction,
    shouldQueueWrites: false,
    retryNow: mocks.retryNow,
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
    completedCount: 0,
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
  useCalendarTasks: (_selectedDate: Date, view: "list" | "month" | "week") => ({
    tasks: view === "week" ? mocks.weekCalendarTasks : [],
  }),
}));

vi.mock("@/hooks/useStreakMultiplier", () => ({
  useStreakMultiplier: () => ({
    currentStreak: 0,
  }),
}));

vi.mock("@/hooks/useHabitSurfacing", () => ({
  useHabitSurfacing: () => ({
    surfaceAllEpicHabits: mocks.surfaceAllEpicHabits,
    unsurfacedEpicHabitsCount: 0,
  }),
}));

vi.mock("@/hooks/useRecurringTaskSpawner", () => ({
  useRecurringTaskSpawner: () => ({
    pendingRecurringCount: 0,
    spawnRecurringTasks: mocks.spawnRecurringTasks,
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

vi.mock("@/hooks/useOnboardingTaskCleanup", () => ({
  useOnboardingTaskCleanup: () => undefined,
}));

vi.mock("@/hooks/useEpics", () => ({
  useEpics: () => ({
    epics: mocks.activeEpics,
    activeEpics: mocks.activeEpics,
    completedEpics: [],
    isLoading: false,
    createEpic: mocks.createEpic,
    isCreating: false,
    updateEpicStatus: vi.fn(),
  }),
}));

vi.mock("@/contexts/DeepLinkContext", () => ({
  useDeepLink: () => ({
    pendingTaskId: null,
    clearPendingTask: mocks.clearPendingTask,
  }),
}));

vi.mock("@/hooks/useAIInteractionTracker", () => ({
  useAIInteractionTracker: () => ({
    trackDailyPlanOutcome: vi.fn(),
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

vi.mock("@/hooks/useQuestCalendarSync", () => ({
  useQuestCalendarSync: () => ({
    sendTaskToCalendar: {
      mutateAsync: mocks.sendTaskToCalendarMutateAsync,
      isPending: false,
    },
    syncTaskUpdate: {
      mutateAsync: mocks.syncTaskUpdateMutateAsync,
    },
    syncTaskDelete: {
      mutateAsync: mocks.syncTaskDeleteMutateAsync,
    },
    syncProviderPull: {
      mutate: mocks.syncProviderPullMutate,
    },
    hasLinkedEvent: mocks.hasLinkedEvent,
  }),
}));

vi.mock("@/hooks/useCalendarIntegrations", () => ({
  useCalendarIntegrations: () => ({
    connections: [],
  }),
}));

vi.mock("@/hooks/usePostOnboardingMentorGuidance", () => ({
  usePostOnboardingMentorGuidance: () => ({
    isActive: false,
    currentStep: null,
    currentSubstep: null,
  }),
}));

vi.mock("@/contexts/MainTabVisibilityContext", () => ({
  useMainTabVisibility: () => ({
    isTabActive: true,
  }),
}));

vi.mock("@/hooks/useJourneysLayoutMode", () => ({
  useJourneysLayoutMode: () => mocks.layoutMode,
}));

vi.mock("@/utils/platformTargets", () => ({
  isMacDesignedForIPadIOSApp: () => false,
  isMacSession: () => false,
}));

const renderJourneys = (initialEntry = "/journeys") => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[initialEntry]}>
        <Journeys />
      </MemoryRouter>
    </QueryClientProvider>,
  );
};

describe("Journeys inbox integration", () => {
  beforeEach(() => {
    mocks.inboxTasks = [];
    mocks.dailyTasks = [
      {
        id: "scheduled-1",
        task_text: "Morning workout",
        completed: false,
        xp_reward: 12,
        task_date: "2026-03-27",
        scheduled_time: "09:00",
        difficulty: "medium",
        is_main_quest: false,
      },
    ];
    mocks.addTask.mockClear();
    mocks.toggleInboxTask.mockClear();
    mocks.deleteInboxTask.mockClear();
    mocks.scrollIntoView.mockClear();
    mocks.activeEpics = [];
    mocks.layoutMode = "mobile";
    mocks.weekCalendarTasks = [];

    vi.spyOn(window, "requestAnimationFrame").mockImplementation((callback: FrameRequestCallback) => {
      callback(0);
      return 1;
    });
    vi.spyOn(window, "cancelAnimationFrame").mockImplementation(() => undefined);
    Object.defineProperty(HTMLElement.prototype, "scrollIntoView", {
      configurable: true,
      writable: true,
      value: mocks.scrollIntoView,
    });
  });

  it("uses the quests cinematic wallpaper preset", () => {
    renderJourneys();

    expect(screen.getByTestId("cinematic-background")).toHaveAttribute("data-preset", "quests");
  });

  it("renders the inbox section above the agenda when unscheduled quests exist", async () => {
    mocks.inboxTasks = [
      {
        id: "inbox-1",
        task_text: "Email Alex",
        completed: false,
        task_date: null,
        scheduled_time: null,
      },
    ];

    renderJourneys();

    expect(screen.getByTestId("journeys-inbox-section")).toBeInTheDocument();
    expect(screen.getByText("Email Alex")).toBeInTheDocument();

    const orderedSections = Array.from(
      document.querySelectorAll('[data-testid="journeys-inbox-section"], [data-testid="todays-agenda"]'),
    ).map((node) => node.getAttribute("data-testid"));

    expect(orderedSections).toEqual(["journeys-inbox-section", "todays-agenda"]);
  });

  it("shows and focuses the embedded inbox section for legacy inbox links", async () => {
    renderJourneys("/journeys?section=inbox");

    expect(screen.getByTestId("journeys-inbox-section")).toBeInTheDocument();
    expect(screen.getByTestId("journeys-inbox-empty")).toBeInTheDocument();

    await waitFor(() => {
      expect(mocks.scrollIntoView).toHaveBeenCalled();
    });
  });

  it("adds inbox quests into the embedded section immediately", async () => {
    renderJourneys();

    expect(screen.queryByTestId("journeys-inbox-section")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "open-add-quest" }));
    fireEvent.click(screen.getByRole("button", { name: "submit-inbox" }));

    await waitFor(() => {
      expect(mocks.addTask).toHaveBeenCalled();
      expect(screen.getByTestId("journeys-inbox-section")).toBeInTheDocument();
      expect(screen.getByText("Draft roadmap")).toBeInTheDocument();
    });
  });

  it("shows the March 27 quests and active campaigns for Darryl's account shape", async () => {
    mocks.dailyTasks = [
      {
        id: "manual-1",
        task_text: "Morning Routine",
        completed: true,
        xp_reward: 20,
        task_date: "2026-03-27",
        scheduled_time: "04:30:00",
        difficulty: "hard",
        is_main_quest: false,
      },
      {
        id: "manual-2",
        task_text: "Bids for Next week",
        completed: false,
        xp_reward: 20,
        task_date: "2026-03-27",
        scheduled_time: "16:00:00",
        difficulty: "medium",
        is_main_quest: false,
      },
      {
        id: "manual-3",
        task_text: "Walk 800 w 6th",
        completed: true,
        xp_reward: 20,
        task_date: "2026-03-27",
        scheduled_time: "10:00:00",
        difficulty: "medium",
        is_main_quest: false,
      },
      {
        id: "manual-4",
        task_text: "Evening reset",
        completed: false,
        xp_reward: 20,
        task_date: "2026-03-27",
        scheduled_time: "19:00:00",
        difficulty: "easy",
        is_main_quest: false,
      },
      {
        id: "ritual-1",
        task_text: "Daily CRM Update",
        completed: false,
        xp_reward: 20,
        task_date: "2026-03-27",
        scheduled_time: null,
        difficulty: "medium",
        is_main_quest: false,
        habit_source_id: "crm-habit",
        epic_id: "epic-money",
      },
      {
        id: "ritual-2",
        task_text: "Daily Workout Routine",
        completed: false,
        xp_reward: 20,
        task_date: "2026-03-27",
        scheduled_time: null,
        difficulty: "medium",
        is_main_quest: false,
        habit_source_id: "workout-habit",
        epic_id: "epic-summer",
      },
      {
        id: "ritual-3",
        task_text: "Nutrition Tracking",
        completed: false,
        xp_reward: 20,
        task_date: "2026-03-27",
        scheduled_time: null,
        difficulty: "medium",
        is_main_quest: false,
        habit_source_id: "nutrition-habit",
        epic_id: "epic-summer",
      },
    ];
    mocks.activeEpics = [
      {
        id: "epic-summer",
        title: "Summer Gains",
        status: "active",
        progress_percentage: 0,
        target_days: 91,
        start_date: "2026-03-03",
        end_date: "2026-06-02",
        epic_habits: [],
      },
      {
        id: "epic-money",
        title: "Get Money",
        status: "active",
        progress_percentage: 0,
        target_days: 304,
        start_date: "2026-03-03",
        end_date: "2027-01-01",
        epic_habits: [],
      },
    ];

    renderJourneys();

    await waitFor(() => {
      expect(screen.getByTestId("agenda-task-list")).toBeInTheDocument();
    });

    expect(screen.getByText("Morning Routine (quest)")).toBeInTheDocument();
    expect(screen.getByText("Bids for Next week (quest)")).toBeInTheDocument();
    expect(screen.getByText("Walk 800 w 6th (quest)")).toBeInTheDocument();
    expect(screen.getByText("Evening reset (quest)")).toBeInTheDocument();
    expect(screen.getByText("Daily CRM Update (ritual)")).toBeInTheDocument();
    expect(screen.getByText("Daily Workout Routine (ritual)")).toBeInTheDocument();
    expect(screen.getByText("Nutrition Tracking (ritual)")).toBeInTheDocument();
    expect(screen.getByText("Summer Gains")).toBeInTheDocument();
    expect(screen.getByText("Get Money")).toBeInTheDocument();
  });

  it("passes every active campaign through to the agenda", async () => {
    mocks.activeEpics = Array.from({ length: 6 }, (_, index) => ({
      id: `epic-${index + 1}`,
      title: `Campaign ${index + 1}`,
      status: "active",
      progress_percentage: 0,
      target_days: 30,
      start_date: "2026-03-03",
      end_date: "2026-04-02",
      epic_habits: [],
    }));

    renderJourneys();

    await waitFor(() => {
      expect(screen.getByTestId("agenda-campaign-list")).toBeInTheDocument();
    });

    expect(screen.getByText("Campaign 1")).toBeInTheDocument();
    expect(screen.getByText("Campaign 5")).toBeInTheDocument();
    expect(screen.getByText("Campaign 6")).toBeInTheDocument();
  });

  it("defaults desktop quests to week mode and preserves the selected date when switching back to day", async () => {
    mocks.layoutMode = "desktop";
    mocks.weekCalendarTasks = [
      {
        id: "week-1",
        task_text: "Week task",
        completed: false,
        xp_reward: 10,
        task_date: "2026-03-28",
        scheduled_time: "08:00",
        difficulty: "medium",
        is_main_quest: false,
      },
    ];

    renderJourneys();

    expect(screen.queryByTestId("desktop-week-strip")).not.toBeInTheDocument();
    expect(screen.getByTestId("desktop-week-planner-mode")).toHaveTextContent("week");
    expect(screen.getByTestId("desktop-week-planner")).toBeInTheDocument();
    expect(screen.queryByTestId("todays-agenda")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "select-desktop-week-date" }));
    fireEvent.click(screen.getByRole("button", { name: "set-day-mode" }));

    expect(screen.getByTestId("todays-agenda")).toBeInTheDocument();
    expect(screen.getByTestId("todays-agenda-mode")).toHaveTextContent("day");
    expect(screen.queryByTestId("desktop-week-planner")).not.toBeInTheDocument();
    expect(screen.getByTestId("todays-agenda-selected-date")).toHaveTextContent("2026-03-28");
  });
});
