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
  scrollIntoView: vi.fn(),
}));

vi.mock("@/components/PageTransition", () => ({
  PageTransition: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

vi.mock("@/components/StarfieldBackground", () => ({
  StarfieldBackground: () => null,
}));

vi.mock("@/components/DatePillsScroller", () => ({
  DatePillsScroller: () => <div data-testid="date-pills" />,
}));

vi.mock("@/components/DesktopWeekStrip", () => ({
  DesktopWeekStrip: () => <div data-testid="desktop-week-strip" />,
}));

vi.mock("@/components/TodaysAgenda", () => ({
  TodaysAgenda: () => <div data-testid="todays-agenda">agenda</div>,
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

vi.mock("@/components/SmartDayPlanner/components/QuickAdjustDrawer", () => ({
  QuickAdjustDrawer: () => null,
}));

vi.mock("@/components/Pathfinder", () => ({
  Pathfinder: () => null,
}));

vi.mock("@/components/CampaignCreatedAnimation", () => ({
  CampaignCreatedAnimation: () => null,
}));

vi.mock("@/components/DraggableFAB", () => ({
  DraggableFAB: ({ onTap }: { onTap: () => void }) => (
    <button type="button" onClick={onTap}>
      open-add-quest
    </button>
  ),
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
  useCalendarTasks: () => ({
    tasks: [],
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
    epics: [],
    activeEpics: [],
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
  useJourneysLayoutMode: () => "mobile",
}));

vi.mock("@/utils/platformTargets", () => ({
  isMacDesignedForIPadIOSApp: () => false,
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
});
