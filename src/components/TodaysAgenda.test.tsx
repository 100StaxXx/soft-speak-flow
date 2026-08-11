import { cloneElement, isValidElement, type CSSProperties, type MouseEvent, type ReactElement, type ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SHARED_TIMELINE_DRAG_INTERACTION_PROFILE } from "@/components/calendar/dragSnap";
import { QUEST_LAUNCHER_SCROLL_CLEARANCE_PX } from "@/components/quest-launchers/metrics";

const windowScrollToSpy = vi.spyOn(window, "scrollTo").mockImplementation(() => undefined);
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

const mocks = vi.hoisted(() => {
  const createMotionValueMock = (initial = 0) => {
    let current = initial;
    const listeners = new Set<(value: number) => void>();
    return {
      get: () => current,
      set: (value: number) => {
        current = value;
        listeners.forEach((listener) => listener(value));
      },
      on: (_event: "change", listener: (value: number) => void) => {
        listeners.add(listener);
        return () => listeners.delete(listener);
      },
    };
  };
  const dragOffsetMotionValue = createMotionValueMock(0);
  const dragEdgeMotionValue = createMotionValueMock(0);
  const subtaskEqMock = vi.fn();
  const subtaskUpdateMock = vi.fn();
  const handlePointerDownCaptureSpy = vi.fn();
  const handleTouchStartCaptureSpy = vi.fn();
  const handlePointerDownSpy = vi.fn();
  const handleTouchStartSpy = vi.fn();
  const rowPointerDownCaptureSpy = vi.fn();
  const rowTouchStartCaptureSpy = vi.fn();
  const rowPointerDownSpy = vi.fn();
  const rowTouchStartSpy = vi.fn();
  const nudgeByFineStepMock = vi.fn(() => true);
  const getDragHandlePropsMock = vi.fn(() => ({
    onPointerDownCapture: handlePointerDownCaptureSpy,
    onPointerDown: handlePointerDownSpy,
    onTouchStartCapture: handleTouchStartCaptureSpy,
    onTouchStart: handleTouchStartSpy,
  }));
  const getRowDragPropsMock = vi.fn(() => ({
    onPointerDownCapture: rowPointerDownCaptureSpy,
    onPointerDown: rowPointerDownSpy,
    onTouchStartCapture: rowTouchStartCaptureSpy,
    onTouchStart: rowTouchStartSpy,
  }));
  const timelineDragState = {
    draggingTaskId: null as string | null,
    longPressTaskId: null as string | null,
    isDragging: false,
    justDroppedId: null as string | null,
    dragOffsetY: dragOffsetMotionValue,
    dragVisualOffsetY: dragOffsetMotionValue,
    dragEdgeOffsetY: dragOffsetMotionValue,
    previewTime: undefined as string | undefined,
    snapMode: "coarse" as const,
    zoomRail: null as
      | {
          mode: "coarse" | "fine";
          clientY: number;
          snappedMinute: number;
          ticks: Array<{ minute: number; label: string; isCenter: boolean; isMajor: boolean }>;
        }
      | null,
  };
  const useTimelineDragMock = vi.fn(() => ({
    ...timelineDragState,
    nudgeByFineStep: nudgeByFineStepMock,
    getDragHandleProps: getDragHandlePropsMock,
    getRowDragProps: getRowDragPropsMock,
  }));

  return {
    subtaskEqMock,
    subtaskUpdateMock,
    handlePointerDownCaptureSpy,
    handleTouchStartCaptureSpy,
    handlePointerDownSpy,
    handleTouchStartSpy,
    rowPointerDownCaptureSpy,
    rowTouchStartCaptureSpy,
    rowPointerDownSpy,
    rowTouchStartSpy,
    nudgeByFineStepMock,
    getDragHandlePropsMock,
    getRowDragPropsMock,
    useTimelineDragMock,
    dragOffsetMotionValue,
    dragEdgeMotionValue,
    timelineDragState,
    loadLocalHabitsMock: vi.fn(),
    journeyPathDrawerOpenMock: vi.fn(),
  };
});

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({
    user: { id: "user-1" },
  }),
}));

vi.mock("@/hooks/useProfile", () => ({
  useProfile: () => ({
    profile: { completed_tasks_stay_in_place: true },
  }),
}));

vi.mock("@/utils/plannerSync", async () => {
  const actual = await vi.importActual<typeof import("@/utils/plannerSync")>("@/utils/plannerSync");
  return {
    ...actual,
    loadLocalHabits: (...args: unknown[]) => mocks.loadLocalHabitsMock(...args),
  };
});

vi.mock("@/hooks/useMotionProfile", () => ({
  useMotionProfile: () => ({
    profile: "balanced",
    capabilities: {
      allowParallax: false,
      maxParticles: 32,
      allowBackgroundAnimation: true,
      enableTabTransitions: true,
      hapticsMode: "web",
    },
  }),
}));

vi.mock("@/hooks/useTimelineDrag", () => ({
  useTimelineDrag: (...args: Parameters<typeof mocks.useTimelineDragMock>) =>
    mocks.useTimelineDragMock(...args),
}));

vi.mock("@/utils/soundEffects", () => ({
  playStrikethrough: vi.fn(),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: vi.fn((table: string) => {
      if (table === "subtasks") {
        return {
          update: mocks.subtaskUpdateMock,
        };
      }

      return {};
    }),
  },
}));

vi.mock("@capacitor/haptics", () => ({
  Haptics: {
    impact: vi.fn(),
  },
  ImpactStyle: {
    Light: "LIGHT",
    Medium: "MEDIUM",
  },
}));

vi.mock("@/components/HourlyViewModal", () => ({
  HourlyViewModal: () => null,
}));

vi.mock("@/components/calendar/DragTimeZoomRail", () => ({
  DragTimeZoomRail: () => null,
}));

vi.mock("@/components/JourneyPathDrawer", () => ({
  JourneyPathDrawer: ({
    children,
    epic,
  }: {
    children: ReactNode;
    epic: { id: string };
  }) => {
    if (!isValidElement(children)) return <>{children}</>;

    const child = children as ReactElement<{
      onClick?: (event: MouseEvent<HTMLElement>) => void;
    }>;

    return cloneElement(child, {
      onClick: (event: MouseEvent<HTMLElement>) => {
        child.props.onClick?.(event);
        mocks.journeyPathDrawerOpenMock(epic.id);
      },
    });
  },
}));

vi.mock("@/components/TimelineTaskRow", () => ({
  TimelineTaskRow: ({
    children,
    overrideTime,
    time,
    tone,
    durationMinutes,
    durationLayout,
    laneIndex,
    laneCount,
    overlapCount,
    rowKind: _rowKind,
    label: _label,
    showLine: _showLine,
    isLast: _isLast,
    isDragTarget: _isDragTarget,
    ...props
  }: {
    children: ReactNode;
    overrideTime?: string | null;
    time?: string | null;
    tone?: "default" | "now";
    durationMinutes?: number | null;
    durationLayout?: {
      fallbackMinutes: number;
      minHeightPx: number;
      pxPerMinute: number;
    } | null;
    laneIndex?: number;
    laneCount?: number;
    overlapCount?: number;
    rowKind?: "task" | "marker";
    label?: string | null;
    showLine?: boolean;
    isLast?: boolean;
    isDragTarget?: boolean;
  } & Record<string, unknown>) => {
    const displayTime = overrideTime ?? time;
    const resolvedDurationMinutes = !durationLayout
      ? null
      : !Number.isFinite(durationMinutes) || (durationMinutes ?? 0) <= 0
      ? durationLayout.fallbackMinutes
      : Number(durationMinutes);
    const minHeight = !durationLayout || resolvedDurationMinutes === null
      ? undefined
      : `${Math.max(
          durationLayout.minHeightPx,
          resolvedDurationMinutes * durationLayout.pxPerMinute,
        )}px`;
    return (
      <div
        data-testid="timeline-row"
        data-timeline-lane={laneIndex}
        data-timeline-lane-count={laneCount}
        data-timeline-overlap={overlapCount}
        data-timeline-tone={tone}
        style={minHeight ? { minHeight } : undefined}
        {...props}
      >
        {displayTime ? <span data-testid="timeline-row-time">{displayTime}</span> : null}
        {children}
      </div>
    );
  },
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

import { TodaysAgenda } from "./TodaysAgenda";

const createWrapper = (client: QueryClient) => {
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
};

const minuteFromTime = (time: string) => {
  const [hour, minute] = time.split(":").map(Number);
  return (hour * 60) + minute;
};

const openDropdownMenu = (trigger: HTMLElement) => {
  act(() => {
    trigger.focus();
    fireEvent.keyDown(trigger, { key: "Enter", code: "Enter" });
  });
};

const getQuestCardShell = (container: HTMLElement) => {
  const shell = container.querySelector('[data-quest-card-shell="true"]');
  expect(shell).toBeInstanceOf(HTMLElement);
  return shell as HTMLElement;
};

const createDomRect = (overrides: Partial<DOMRect> = {}): DOMRect => ({
  x: 0,
  y: 0,
  width: 0,
  height: 0,
  top: 0,
  right: 0,
  bottom: 0,
  left: 0,
  toJSON: () => ({}),
  ...overrides,
}) as DOMRect;

const mockViewport = ({ height, offsetTop = 0 }: { height: number; offsetTop?: number }) => {
  const originalInnerHeight = window.innerHeight;
  const originalVisualViewport = window.visualViewport;

  Object.defineProperty(window, "innerHeight", {
    configurable: true,
    value: height,
  });

  Object.defineProperty(window, "visualViewport", {
    configurable: true,
    value: {
      height,
      offsetTop,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    },
  });

  return () => {
    Object.defineProperty(window, "innerHeight", {
      configurable: true,
      value: originalInnerHeight,
    });
    Object.defineProperty(window, "visualViewport", {
      configurable: true,
      value: originalVisualViewport,
    });
  };
};

const EXPECTED_MOBILE_FAB_SCROLL_CLEARANCE = `${QUEST_LAUNCHER_SCROLL_CLEARANCE_PX}px`;

const getRenderedGridSlotMinutes = (): number[] => {
  return Array.from(document.querySelectorAll<HTMLElement>('[data-testid^="journeys-day-grid-slot-"]'))
    .map((element) => Number(element.getAttribute("data-minute")))
    .filter((minute): minute is number => Number.isFinite(minute))
    .sort((a, b) => a - b);
};

const getTimelineRowWrapper = (taskId: string) => {
  const wrapper = screen.getByTestId(`timeline-row-${taskId}`).parentElement;
  expect(wrapper).toBeInstanceOf(HTMLElement);
  return wrapper as HTMLElement;
};

beforeEach(() => {
  windowScrollToSpy.mockClear();
  elementScrollToSpy.mockClear();
  document.documentElement.style.removeProperty("--bottom-nav-runtime-offset");
  document.documentElement.style.removeProperty("--bottom-nav-safe-offset");
  mocks.loadLocalHabitsMock.mockReset();
  mocks.loadLocalHabitsMock.mockResolvedValue([]);
  mocks.journeyPathDrawerOpenMock.mockClear();
});

describe("TodaysAgenda subtasks", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.timelineDragState.draggingTaskId = null;
    mocks.timelineDragState.longPressTaskId = null;
    mocks.timelineDragState.isDragging = false;
    mocks.timelineDragState.justDroppedId = null;
    mocks.dragOffsetMotionValue.set(0);
    mocks.dragEdgeMotionValue.set(0);
    mocks.timelineDragState.dragEdgeOffsetY = mocks.dragOffsetMotionValue;
    mocks.timelineDragState.previewTime = undefined;
    mocks.timelineDragState.snapMode = "coarse";
    mocks.timelineDragState.zoomRail = null;
    mocks.handlePointerDownCaptureSpy.mockClear();
    mocks.handleTouchStartCaptureSpy.mockClear();
    mocks.handlePointerDownSpy.mockClear();
    mocks.handleTouchStartSpy.mockClear();
    mocks.rowPointerDownCaptureSpy.mockClear();
    mocks.rowTouchStartCaptureSpy.mockClear();
    mocks.rowPointerDownSpy.mockClear();
    mocks.rowTouchStartSpy.mockClear();
    mocks.nudgeByFineStepMock.mockReset();
    mocks.nudgeByFineStepMock.mockReturnValue(true);
    mocks.getDragHandlePropsMock.mockClear();
    mocks.getRowDragPropsMock.mockClear();
    mocks.subtaskEqMock.mockResolvedValue({ error: null });
    mocks.subtaskUpdateMock.mockReturnValue({
      eq: mocks.subtaskEqMock,
    });
  });

  it("shows subtasks for untimed quests when expanded and persists subtask toggle", async () => {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });

    render(
      <TodaysAgenda
        tasks={[
          {
            id: "task-1",
            task_text: "Launch campaign",
            completed: false,
            xp_reward: 50,
            scheduled_time: null,
            subtasks: [
              {
                id: "subtask-1",
                title: "Write launch notes",
                completed: false,
                sort_order: 0,
              },
            ],
          },
        ]}
        selectedDate={new Date("2026-02-13T09:00:00.000Z")}
        onToggle={vi.fn()}
        onAddQuest={vi.fn()}
        completedCount={0}
        totalCount={1}
      />,
      { wrapper: createWrapper(queryClient) }
    );

    fireEvent.click(screen.getByTestId("untimed-quests-drawer-trigger"));

    const drawer = await screen.findByTestId("untimed-quests-drawer");
    const untimedQuest = within(drawer).getByTestId("untimed-quest-task-1");
    const chevron = untimedQuest.querySelector("svg.lucide-chevron-down");
    expect(chevron).toBeTruthy();
    const chevronButton = chevron?.closest("button");
    expect(chevronButton).toBeTruthy();

    fireEvent.click(chevronButton!);

    expect(await screen.findByText("Subtasks")).toBeInTheDocument();
    const subtaskRow = screen.getByText("Write launch notes").closest("label");
    expect(subtaskRow).toBeTruthy();

    const subtaskCheckbox = within(subtaskRow!).getByRole("checkbox");
    fireEvent.click(subtaskCheckbox);

    await waitFor(() => {
      expect(mocks.subtaskUpdateMock).toHaveBeenCalledWith(
        expect.objectContaining({
          completed: true,
          completed_at: expect.any(String),
        })
      );
    });

    expect(mocks.subtaskEqMock).toHaveBeenCalledWith("id", "subtask-1");
  });
});

describe("TodaysAgenda quest completion styling", () => {
  it("scopes companion frosted aliases to quest card shells", () => {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });
    const companionFrostedThemeStyle = {
      "--companion-frosted-primary": "282 68% 62%",
    } as CSSProperties;

    const { container } = render(
      <TodaysAgenda
        tasks={[
          {
            id: "task-theme-1",
            task_text: "Tinted quest",
            completed: false,
            xp_reward: 16,
            scheduled_time: "10:00",
          },
        ]}
        selectedDate={new Date("2026-03-27T10:00:00.000Z")}
        onToggle={vi.fn()}
        onAddQuest={vi.fn()}
        completedCount={0}
        totalCount={1}
        companionFrostedThemeStyle={companionFrostedThemeStyle}
      />,
      { wrapper: createWrapper(queryClient) },
    );

    expect(screen.getByTestId("todays-agenda")).toHaveClass("companion-frosted-planner-dark");
    expect(screen.getByTestId("todays-agenda")).toHaveStyle({
      "--companion-frosted-primary": "282 68% 62%",
    });
    expect(getQuestCardShell(container)).toHaveClass("companion-frosted-theme-scope");
  });

  it("keeps completed quest text struck through after the completion animation ends", () => {
    vi.useFakeTimers();

    try {
      const queryClient = new QueryClient({
        defaultOptions: {
          queries: { retry: false },
          mutations: { retry: false },
        },
      });
      const onToggle = vi.fn();

      render(
        <TodaysAgenda
          tasks={[
            {
              id: "task-strike-1",
              task_text: "Walk 800 w 6th",
              completed: false,
              xp_reward: 16,
              scheduled_time: "10:00",
            },
          ]}
          selectedDate={new Date("2026-03-27T10:00:00.000Z")}
          onToggle={onToggle}
          onAddQuest={vi.fn()}
          completedCount={0}
          totalCount={1}
        />,
        { wrapper: createWrapper(queryClient) },
      );

      fireEvent.click(screen.getByRole("checkbox", { name: "Mark task as complete" }));

      expect(screen.getByText("Walk 800 w 6th")).toHaveClass("animate-strikethrough");

      act(() => {
        vi.advanceTimersByTime(601);
      });

      expect(screen.getByText("Walk 800 w 6th")).toHaveClass("line-through", "text-muted-foreground");
      expect(screen.getByText("Walk 800 w 6th")).not.toHaveClass("animate-strikethrough");
      expect(onToggle).toHaveBeenCalledTimes(1);
      expect(onToggle).toHaveBeenCalledWith("task-strike-1", true, 16);
    } finally {
      vi.useRealTimers();
    }
  });
});

describe("TodaysAgenda touch toggles", () => {
  it("ignores the follow-up click after a touch completion tap", () => {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });
    const onToggle = vi.fn();

    render(
      <TodaysAgenda
        tasks={[
          {
            id: "task-touch-1",
            task_text: "Walk 800 w 6th",
            completed: false,
            xp_reward: 16,
            scheduled_time: "10:00",
          },
        ]}
        selectedDate={new Date("2026-03-27T10:00:00.000Z")}
        onToggle={onToggle}
        onAddQuest={vi.fn()}
        completedCount={0}
        totalCount={1}
      />,
      { wrapper: createWrapper(queryClient) },
    );

    const checkbox = screen.getByRole("checkbox", { name: "Mark task as complete" });

    fireEvent.touchStart(checkbox, {
      touches: [{ clientX: 24, clientY: 24 }],
    });
    fireEvent.touchEnd(checkbox, {
      changedTouches: [{ clientX: 25, clientY: 24 }],
    });
    fireEvent.click(checkbox);

    expect(onToggle).toHaveBeenCalledTimes(1);
    expect(onToggle).toHaveBeenCalledWith("task-touch-1", true, 16);
  });

  it("ignores the follow-up click after a touch undo tap", () => {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });
    const onToggle = vi.fn();
    const onUndoToggle = vi.fn();

    render(
      <TodaysAgenda
        tasks={[
          {
            id: "task-touch-2",
            task_text: "Call uncle Derrick",
            completed: true,
            xp_reward: 22,
            scheduled_time: "09:30",
          },
        ]}
        selectedDate={new Date("2026-03-27T09:30:00.000Z")}
        onToggle={onToggle}
        onUndoToggle={onUndoToggle}
        onAddQuest={vi.fn()}
        completedCount={1}
        totalCount={1}
      />,
      { wrapper: createWrapper(queryClient) },
    );

    const checkbox = screen.getByRole("checkbox", { name: "Mark task as incomplete" });

    fireEvent.touchStart(checkbox, {
      touches: [{ clientX: 24, clientY: 24 }],
    });
    fireEvent.touchEnd(checkbox, {
      changedTouches: [{ clientX: 24, clientY: 24 }],
    });
    fireEvent.click(checkbox);

    expect(onUndoToggle).toHaveBeenCalledTimes(1);
    expect(onUndoToggle).toHaveBeenCalledWith("task-touch-2", 22);
    expect(onToggle).not.toHaveBeenCalled();
  });
});

describe("TodaysAgenda campaign visibility", () => {
  it("renders campaigns inside the scheduled timeline pane when scheduled rows exist", () => {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });
    const onOpenCampaigns = vi.fn();

    render(
      <TodaysAgenda
        tasks={[
          {
            id: "quest-1",
            task_text: "Morning focus",
            completed: false,
            xp_reward: 20,
            scheduled_time: "08:00",
          },
          {
            id: "ritual-1",
            task_text: "Daily journal",
            completed: false,
            xp_reward: 15,
            habit_source_id: "habit-1",
            epic_id: "epic-1",
            epic_title: "Fallback Campaign",
          },
        ]}
        selectedDate={new Date("2026-02-14T16:34:00")}
        onToggle={vi.fn()}
        onAddQuest={vi.fn()}
        completedCount={0}
        totalCount={2}
        activeEpics={[]}
        onOpenCampaigns={onOpenCampaigns}
      />,
      { wrapper: createWrapper(queryClient) },
    );

    const scheduledPane = screen.getByTestId("scheduled-timeline-pane");
    expect(within(scheduledPane).getByText("Campaigns")).toBeInTheDocument();
    expect(within(scheduledPane).getByText("Fallback Campaign")).toBeInTheDocument();
    expect(screen.getAllByText("Campaigns")).toHaveLength(1);

    fireEvent.click(within(scheduledPane).getByRole("button", { name: "Open campaigns page" }));
    expect(onOpenCampaigns).toHaveBeenCalledTimes(1);
  });

  it("renders campaign rituals as scheduled items and campaign rows without expand controls", () => {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });

    render(
      <TodaysAgenda
        tasks={[
          {
            id: "ritual-1",
            task_text: "Morning journal",
            completed: false,
            xp_reward: 15,
            scheduled_time: "07:00",
            estimated_duration: 60,
            habit_source_id: "habit-1",
            epic_id: "epic-1",
            epic_title: "Fallback Campaign",
          },
        ]}
        selectedDate={new Date("2026-02-14T16:34:00")}
        onToggle={vi.fn()}
        onAddQuest={vi.fn()}
        completedCount={0}
        totalCount={1}
        activeEpics={[]}
      />,
      { wrapper: createWrapper(queryClient) },
    );

    expect(screen.getByText("Campaigns")).toBeInTheDocument();
    expect(screen.getByText("Fallback Campaign")).toBeInTheDocument();
    expect(screen.getByText("Morning journal")).toBeInTheDocument();
    expect(screen.getByText("Campaign Ritual - Fallback Campaign")).toBeInTheDocument();
    expect(screen.getByText("Morning journal").closest('[data-quest-card-shell="true"]')).toHaveClass(
      "campaign-ritual-card",
      "border-primary/35",
      "bg-primary/[0.08]",
    );
    expect(screen.queryByRole("button", { name: "Expand Fallback Campaign rituals" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Collapse Fallback Campaign rituals" })).not.toBeInTheDocument();
  });

  it("renders hydrated campaign names as clickable buttons that open the campaign drawer flow", () => {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });

    render(
      <TodaysAgenda
        tasks={[
          {
            id: "ritual-1",
            task_text: "Morning journal",
            completed: false,
            xp_reward: 15,
            habit_source_id: "habit-1",
            epic_id: "epic-1",
            epic_title: "Fallback Campaign",
          },
        ]}
        selectedDate={new Date("2026-02-14T16:34:00")}
        onToggle={vi.fn()}
        onAddQuest={vi.fn()}
        completedCount={0}
        totalCount={1}
        activeEpics={[
          {
            id: "epic-1",
            title: "Fallback Campaign",
            description: null,
            progress_percentage: 42,
            target_days: 30,
            start_date: "2026-02-01",
            end_date: "2026-03-02",
            epic_habits: [],
          },
        ]}
      />,
      { wrapper: createWrapper(queryClient) },
    );

    const campaignButton = screen.getByRole("button", {
      name: "Open campaign Fallback Campaign",
    });

    fireEvent.click(campaignButton);

    expect(mocks.journeyPathDrawerOpenMock).toHaveBeenCalledWith("epic-1");
  });

  it("opens the campaign drawer from the campaign row without a ritual expand button", () => {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });

    render(
      <TodaysAgenda
        tasks={[
          {
            id: "ritual-1",
            task_text: "Morning journal",
            completed: false,
            xp_reward: 15,
            habit_source_id: "habit-1",
            epic_id: "epic-1",
            epic_title: "Fallback Campaign",
          },
        ]}
        selectedDate={new Date("2026-02-14T16:34:00")}
        onToggle={vi.fn()}
        onAddQuest={vi.fn()}
        completedCount={0}
        totalCount={1}
        activeEpics={[
          {
            id: "epic-1",
            title: "Fallback Campaign",
            description: null,
            progress_percentage: 42,
            target_days: 30,
            start_date: "2026-02-01",
            end_date: "2026-03-02",
            epic_habits: [],
          },
        ]}
      />,
      { wrapper: createWrapper(queryClient) },
    );

    expect(screen.queryByRole("button", { name: "Expand Fallback Campaign rituals" })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", {
      name: "Open campaign Fallback Campaign",
    }));

    expect(mocks.journeyPathDrawerOpenMock).toHaveBeenCalledWith("epic-1");
  });

  it("renders active campaigns without ritual groups when another campaign has rituals", () => {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });

    render(
      <TodaysAgenda
        tasks={[
          {
            id: "ritual-1",
            task_text: "Mobility",
            completed: false,
            xp_reward: 15,
            habit_source_id: "habit-1",
            epic_id: "epic-1",
            epic_title: "Get fit",
          },
        ]}
        selectedDate={new Date("2026-02-14T16:34:00")}
        onToggle={vi.fn()}
        onAddQuest={vi.fn()}
        completedCount={0}
        totalCount={1}
        activeEpics={[
          {
            id: "epic-1",
            title: "Get fit",
            description: null,
            progress_percentage: 42,
            target_days: 30,
            start_date: "2026-02-01",
            end_date: "2026-03-02",
            epic_habits: [],
          },
          {
            id: "epic-2",
            title: "Drop 10 of my golf score",
            description: null,
            progress_percentage: 5,
            target_days: 60,
            start_date: "2026-02-01",
            end_date: "2026-04-01",
            epic_habits: [],
          },
        ]}
      />,
      { wrapper: createWrapper(queryClient) },
    );

    const campaignButton = screen.getByRole("button", {
      name: "Open campaign Drop 10 of my golf score",
    });

    fireEvent.click(campaignButton);

    expect(mocks.journeyPathDrawerOpenMock).toHaveBeenCalledWith("epic-2");
  });

  it("keeps scheduled campaign ritual details out of the inline timeline row until the chevron opens the drawer", async () => {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });

    render(
      <TodaysAgenda
        tasks={[
          {
            id: "ritual-1",
            task_text: "Morning journal",
            completed: false,
            xp_reward: 15,
            scheduled_time: "07:00",
            habit_source_id: "habit-1",
            epic_id: "epic-1",
            epic_title: "Fallback Campaign",
          },
        ]}
        selectedDate={new Date("2026-02-14T16:34:00")}
        onToggle={vi.fn()}
        onAddQuest={vi.fn()}
        completedCount={0}
        totalCount={1}
        activeEpics={[
          {
            id: "epic-1",
            title: "Fallback Campaign",
            description: null,
            progress_percentage: 42,
            target_days: 30,
            start_date: "2026-02-01",
            end_date: "2026-03-02",
            epic_habits: [
              {
                habit_id: "habit-1",
                habits: {
                  id: "habit-1",
                  title: "Morning journal",
                  difficulty: "medium",
                  description: "Capture wins, friction, and tomorrow's focus.",
                },
              },
            ],
          },
        ]}
      />,
      { wrapper: createWrapper(queryClient) },
    );

    const ritualLabel = screen.getByText("Morning journal");
    const ritualCard = ritualLabel.closest('[data-quest-card-shell="true"]');
    expect(ritualCard).toBeTruthy();

    expect(ritualCard).toHaveAttribute("data-scheduled-timeline-card", "true");
    const detailToggle = within(ritualCard as HTMLElement).getByRole("button", {
      name: "Show quest details for Morning journal",
    });
    expect(detailToggle).toHaveAttribute("data-interactive", "true");
    expect(detailToggle).toHaveAttribute("data-tap-control", "true");
    expect(screen.queryByText("Capture wins, friction, and tomorrow's focus.")).not.toBeInTheDocument();

    fireEvent.click(detailToggle);

    const drawer = await screen.findByTestId("mobile-scheduled-quest-detail-drawer-ritual-1");
    expect(within(drawer).getByText("Capture wins, friction, and tomorrow's focus.")).toBeInTheDocument();
  });

  it("renders newly added campaign rituals directly as normal scheduled rows", () => {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });

    const view = render(
      <TodaysAgenda
        tasks={[
          {
            id: "ritual-1",
            task_text: "Morning journal",
            completed: false,
            xp_reward: 15,
            scheduled_time: "07:00",
            estimated_duration: 60,
            habit_source_id: "habit-1",
            epic_id: "epic-1",
            epic_title: "Fallback Campaign",
          },
        ]}
        selectedDate={new Date("2026-02-14T16:34:00")}
        onToggle={vi.fn()}
        onAddQuest={vi.fn()}
        completedCount={0}
        totalCount={1}
        activeEpics={[]}
      />,
      { wrapper: createWrapper(queryClient) },
    );

    expect(screen.getByText("Morning journal")).toBeInTheDocument();
    expect(screen.getByText("Campaign Ritual - Fallback Campaign")).toBeInTheDocument();

    view.rerender(
      <TodaysAgenda
        tasks={[
          {
            id: "ritual-1",
            task_text: "Morning journal",
            completed: false,
            xp_reward: 15,
            scheduled_time: "07:00",
            estimated_duration: 60,
            habit_source_id: "habit-1",
            epic_id: "epic-1",
            epic_title: "Fallback Campaign",
          },
          {
            id: "ritual-2",
            task_text: "Evening stretch",
            completed: false,
            xp_reward: 12,
            scheduled_time: "18:00",
            estimated_duration: 60,
            habit_source_id: "habit-2",
            epic_id: "epic-2",
            epic_title: "New Campaign",
          },
        ]}
        selectedDate={new Date("2026-02-14T16:34:00")}
        onToggle={vi.fn()}
        onAddQuest={vi.fn()}
        completedCount={0}
        totalCount={2}
        activeEpics={[]}
      />,
    );

    expect(screen.getByText("New Campaign")).toBeInTheDocument();
    expect(screen.getByText("Morning journal")).toBeInTheDocument();
    expect(screen.getByText("Evening stretch")).toBeInTheDocument();
    expect(screen.getByText("Campaign Ritual - New Campaign")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Expand New Campaign rituals" })).not.toBeInTheDocument();
  });

  it("shows campaign strip when rituals exist but none are campaign-linked", () => {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });

    render(
      <TodaysAgenda
        tasks={[
          {
            id: "ritual-standalone",
            task_text: "Hydrate",
            completed: false,
            xp_reward: 12,
            habit_source_id: "habit-standalone",
          },
        ]}
        selectedDate={new Date("2026-02-14T16:34:00")}
        onToggle={vi.fn()}
        onAddQuest={vi.fn()}
        completedCount={0}
        totalCount={1}
        activeEpics={[
          {
            id: "epic-1",
            title: "Hydrated Epic",
            description: "desc",
            progress_percentage: 32,
            target_days: 30,
            start_date: "2026-02-01",
            end_date: "2026-03-02",
            epic_habits: [],
          },
        ]}
      />,
      { wrapper: createWrapper(queryClient) },
    );

    expect(screen.getByText("Campaigns")).toBeInTheDocument();
    expect(screen.getByText("Hydrated Epic")).toBeInTheDocument();
  });

  it("renders campaign loading placeholder while campaigns are still fetching", () => {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });

    render(
      <TodaysAgenda
        tasks={[
          {
            id: "quest-1",
            task_text: "Read chapter",
            completed: false,
            xp_reward: 18,
          },
        ]}
        selectedDate={new Date("2026-02-14T16:34:00")}
        onToggle={vi.fn()}
        onAddQuest={vi.fn()}
        completedCount={0}
        totalCount={1}
        activeEpics={[]}
        isCampaignsLoading
      />,
      { wrapper: createWrapper(queryClient) },
    );

    expect(screen.getByText("Loading campaigns...")).toBeInTheDocument();
  });
});

describe("TodaysAgenda ritual descriptions", () => {
  it("gives untimed ritual rows a chevron when the linked description is their only extra detail", async () => {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });

    render(
      <TodaysAgenda
        tasks={[
          {
            id: "ritual-1",
            task_text: "Hydrate",
            completed: false,
            xp_reward: 12,
            scheduled_time: null,
            habit_source_id: "habit-1",
            epic_id: "epic-1",
            epic_title: "Hydrated Campaign",
          },
        ]}
        selectedDate={new Date("2026-02-14T16:34:00")}
        onToggle={vi.fn()}
        onAddQuest={vi.fn()}
        completedCount={0}
        totalCount={1}
        activeEpics={[
          {
            id: "epic-1",
            title: "Hydrated Campaign",
            description: null,
            progress_percentage: 32,
            target_days: 30,
            start_date: "2026-02-01",
            end_date: "2026-03-02",
            epic_habits: [
              {
                habit_id: "habit-1",
                habits: {
                  id: "habit-1",
                  title: "Hydrate",
                  difficulty: "easy",
                  description: "Drink water before coffee and after workouts.",
                },
              },
            ],
          },
        ]}
      />,
      { wrapper: createWrapper(queryClient) },
    );

    fireEvent.click(screen.getByTestId("untimed-quests-drawer-trigger"));

    const drawer = await screen.findByTestId("untimed-quests-drawer");
    const ritualLabel = within(drawer).getByText("Hydrate");
    const ritualCard = ritualLabel.closest('[data-quest-card-shell="true"]');
    expect(ritualCard).toBeTruthy();

    await waitFor(() => {
      expect(within(ritualCard as HTMLElement).getAllByRole("button")).toHaveLength(1);
    });

    fireEvent.click(within(ritualCard as HTMLElement).getByRole("button"));

    expect(await screen.findByText("Drink water before coffee and after workouts.")).toBeInTheDocument();
  });

  it("renders duplicate task notes only once when they match the linked ritual description", async () => {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });

    render(
      <TodaysAgenda
        tasks={[
          {
            id: "ritual-1",
            task_text: "Lift",
            completed: false,
            xp_reward: 18,
            scheduled_time: null,
            habit_source_id: "habit-1",
            epic_id: "epic-1",
            epic_title: "Strength Campaign",
            notes: "**Lift heavy and log sets.**",
          },
        ]}
        selectedDate={new Date("2026-02-14T16:34:00")}
        onToggle={vi.fn()}
        onAddQuest={vi.fn()}
        completedCount={0}
        totalCount={1}
        activeEpics={[
          {
            id: "epic-1",
            title: "Strength Campaign",
            description: null,
            progress_percentage: 28,
            target_days: 45,
            start_date: "2026-02-01",
            end_date: "2026-03-17",
            epic_habits: [
              {
                habit_id: "habit-1",
                habits: {
                  id: "habit-1",
                  title: "Lift",
                  difficulty: "hard",
                  description: "Lift heavy and log sets.",
                },
              },
            ],
          },
        ]}
      />,
      { wrapper: createWrapper(queryClient) },
    );

    fireEvent.click(screen.getByTestId("untimed-quests-drawer-trigger"));

    const drawer = await screen.findByTestId("untimed-quests-drawer");
    const ritualLabel = within(drawer).getByText("Lift");
    const ritualCard = ritualLabel.closest('[data-quest-card-shell="true"]');
    expect(ritualCard).toBeTruthy();

    await waitFor(() => {
      expect(within(ritualCard as HTMLElement).getAllByRole("button")).toHaveLength(1);
    });

    fireEvent.click(within(ritualCard as HTMLElement).getByRole("button"));

    await waitFor(() => {
      expect(screen.getAllByText("Lift heavy and log sets.")).toHaveLength(1);
    });
  });
});

describe("TodaysAgenda attachments", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.timelineDragState.draggingTaskId = null;
    mocks.timelineDragState.longPressTaskId = null;
    mocks.timelineDragState.isDragging = false;
    mocks.timelineDragState.justDroppedId = null;
    mocks.dragOffsetMotionValue.set(0);
    mocks.dragEdgeMotionValue.set(0);
    mocks.timelineDragState.dragEdgeOffsetY = mocks.dragOffsetMotionValue;
    mocks.timelineDragState.previewTime = undefined;
    mocks.timelineDragState.snapMode = "coarse";
    mocks.timelineDragState.zoomRail = null;
    mocks.handlePointerDownCaptureSpy.mockClear();
    mocks.handleTouchStartCaptureSpy.mockClear();
    mocks.handlePointerDownSpy.mockClear();
    mocks.handleTouchStartSpy.mockClear();
    mocks.rowPointerDownCaptureSpy.mockClear();
    mocks.rowTouchStartCaptureSpy.mockClear();
    mocks.rowPointerDownSpy.mockClear();
    mocks.rowTouchStartSpy.mockClear();
    mocks.nudgeByFineStepMock.mockReset();
    mocks.nudgeByFineStepMock.mockReturnValue(true);
    mocks.getDragHandlePropsMock.mockClear();
    mocks.getRowDragPropsMock.mockClear();
  });

  it("shows clickable attachment file names when expanded", async () => {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });

    render(
      <TodaysAgenda
        tasks={[
          {
            id: "task-1",
            task_text: "Review budget",
            completed: false,
            xp_reward: 25,
            scheduled_time: null,
            attachments: [
              {
                id: "att-1",
                taskId: "task-1",
                fileUrl: "https://example.com/budget.pdf",
                filePath: "users/u1/budget.pdf",
                fileName: "Budget Plan.pdf",
                mimeType: "application/pdf",
                fileSizeBytes: 2048,
                isImage: false,
                sortOrder: 0,
                createdAt: "2026-02-13T10:00:00.000Z",
              },
            ],
          },
        ]}
        selectedDate={new Date("2026-02-13T10:00:00.000Z")}
        onToggle={vi.fn()}
        onAddQuest={vi.fn()}
        completedCount={0}
        totalCount={1}
      />,
      { wrapper: createWrapper(queryClient) },
    );

    fireEvent.click(screen.getByTestId("untimed-quests-drawer-trigger"));

    const drawer = await screen.findByTestId("untimed-quests-drawer");
    const untimedQuest = within(drawer).getByTestId("untimed-quest-task-1");
    const chevron = untimedQuest.querySelector("svg.lucide-chevron-down");
    expect(chevron).toBeTruthy();
    const chevronButton = chevron?.closest("button");
    expect(chevronButton).toBeTruthy();

    fireEvent.click(chevronButton!);

    expect(await screen.findByText("Attachments")).toBeInTheDocument();
    const attachmentLink = screen.getByRole("link", { name: "Budget Plan.pdf" });
    expect(attachmentLink).toHaveAttribute("href", "https://example.com/budget.pdf");
    expect(attachmentLink).toHaveAttribute("target", "_blank");
  });

  it("falls back to a clickable photo attachment label for legacy image_url", async () => {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });

    render(
      <TodaysAgenda
        tasks={[
          {
            id: "task-legacy",
            task_text: "Legacy image quest",
            completed: false,
            xp_reward: 12,
            scheduled_time: null,
            image_url: "https://example.com/legacy-image.png",
          },
        ]}
        selectedDate={new Date("2026-02-13T11:00:00.000Z")}
        onToggle={vi.fn()}
        onAddQuest={vi.fn()}
        completedCount={0}
        totalCount={1}
      />,
      { wrapper: createWrapper(queryClient) },
    );

    fireEvent.click(screen.getByTestId("untimed-quests-drawer-trigger"));

    const drawer = await screen.findByTestId("untimed-quests-drawer");
    const untimedQuest = within(drawer).getByTestId("untimed-quest-task-legacy");
    const chevron = untimedQuest.querySelector("svg.lucide-chevron-down");
    expect(chevron).toBeTruthy();
    const chevronButton = chevron?.closest("button");
    expect(chevronButton).toBeTruthy();

    fireEvent.click(chevronButton!);

    expect(await screen.findByText("Attachments")).toBeInTheDocument();
    const fallbackLink = screen.getByRole("link", { name: "Photo attachment" });
    expect(fallbackLink).toHaveAttribute("href", "https://example.com/legacy-image.png");
    expect(fallbackLink).toHaveAttribute("target", "_blank");
  });
});

describe("TodaysAgenda combo feedback", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("increments combo for consecutive completions", async () => {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });

    render(
      <TodaysAgenda
        tasks={[
          { id: "task-1", task_text: "Task One", completed: false, xp_reward: 10, scheduled_time: "09:00" },
          { id: "task-2", task_text: "Task Two", completed: false, xp_reward: 10, scheduled_time: "09:30" },
        ]}
        selectedDate={new Date("2026-02-13T09:00:00.000Z")}
        onToggle={vi.fn()}
        onAddQuest={vi.fn()}
        completedCount={0}
        totalCount={2}
        onUndoToggle={vi.fn()}
      />,
      { wrapper: createWrapper(queryClient) },
    );

    fireEvent.click(screen.getAllByRole("checkbox", { name: /mark task as complete/i })[0]);
    fireEvent.click(screen.getAllByRole("checkbox", { name: /mark task as complete/i })[0]);

    expect(await screen.findByTestId("combo-banner")).toHaveTextContent("Combo x2");
  });

  it("resets combo on undo and does not immediately retrigger", async () => {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });

    render(
      <TodaysAgenda
        tasks={[
          { id: "task-1", task_text: "Task One", completed: false, xp_reward: 10, scheduled_time: "09:00" },
          { id: "task-2", task_text: "Task Two", completed: false, xp_reward: 10, scheduled_time: "09:30" },
        ]}
        selectedDate={new Date("2026-02-13T09:00:00.000Z")}
        onToggle={vi.fn()}
        onAddQuest={vi.fn()}
        completedCount={0}
        totalCount={2}
        onUndoToggle={vi.fn()}
      />,
      { wrapper: createWrapper(queryClient) },
    );

    fireEvent.click(screen.getAllByRole("checkbox", { name: /mark task as complete/i })[0]);
    fireEvent.click(screen.getAllByRole("checkbox", { name: /mark task as complete/i })[0]);
    expect(await screen.findByTestId("combo-banner")).toHaveTextContent("Combo x2");

    fireEvent.click(screen.getAllByRole("checkbox", { name: /mark task as incomplete/i })[0]);

    await waitFor(
      () => {
        expect(screen.queryByTestId("combo-banner")).not.toBeInTheDocument();
      },
      { timeout: 1200 },
    );

    fireEvent.click(screen.getAllByRole("checkbox", { name: /mark task as complete/i })[0]);
    const comboBanner = screen.queryByTestId("combo-banner");
    if (comboBanner) {
      expect(comboBanner).toHaveStyle({ opacity: "0" });
    } else {
      expect(comboBanner).not.toBeInTheDocument();
    }
  });

  it("does not chain combo when completion window is exceeded", () => {
    vi.useFakeTimers();
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });

    render(
      <TodaysAgenda
        tasks={[
          { id: "task-1", task_text: "Task One", completed: false, xp_reward: 10, scheduled_time: "09:00" },
          { id: "task-2", task_text: "Task Two", completed: false, xp_reward: 10, scheduled_time: "09:30" },
        ]}
        selectedDate={new Date("2026-02-13T09:00:00.000Z")}
        onToggle={vi.fn()}
        onAddQuest={vi.fn()}
        completedCount={0}
        totalCount={2}
        onUndoToggle={vi.fn()}
      />,
      { wrapper: createWrapper(queryClient) },
    );

    fireEvent.click(screen.getAllByRole("checkbox", { name: /mark task as complete/i })[0]);

    act(() => {
      vi.advanceTimersByTime(9000);
    });

    fireEvent.click(screen.getAllByRole("checkbox", { name: /mark task as complete/i })[0]);
    expect(screen.queryByTestId("combo-banner")).not.toBeInTheDocument();

    vi.useRealTimers();
  });
});

describe("TodaysAgenda scheduled timeline behavior", () => {
  beforeEach(() => {
    mocks.timelineDragState.draggingTaskId = null;
    mocks.timelineDragState.longPressTaskId = null;
    mocks.timelineDragState.isDragging = false;
    mocks.timelineDragState.justDroppedId = null;
    mocks.dragOffsetMotionValue.set(0);
    mocks.dragEdgeMotionValue.set(0);
    mocks.timelineDragState.dragEdgeOffsetY = mocks.dragOffsetMotionValue;
    mocks.timelineDragState.previewTime = undefined;
    mocks.timelineDragState.snapMode = "coarse";
    mocks.timelineDragState.zoomRail = null;
    mocks.handlePointerDownCaptureSpy.mockClear();
    mocks.handleTouchStartCaptureSpy.mockClear();
    mocks.handlePointerDownSpy.mockClear();
    mocks.handleTouchStartSpy.mockClear();
    mocks.rowPointerDownCaptureSpy.mockClear();
    mocks.rowTouchStartCaptureSpy.mockClear();
    mocks.rowPointerDownSpy.mockClear();
    mocks.rowTouchStartSpy.mockClear();
    mocks.nudgeByFineStepMock.mockReset();
    mocks.nudgeByFineStepMock.mockReturnValue(true);
    mocks.getDragHandlePropsMock.mockClear();
    mocks.getRowDragPropsMock.mockClear();
  });

  it("auto-centers around now when today is visible", () => {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });

    render(
      <TodaysAgenda
        tasks={[
          {
            id: "task-scheduled-1",
            task_text: "Morning focus",
            completed: false,
            xp_reward: 25,
            scheduled_time: "08:00",
          },
        ]}
        selectedDate={new Date()}
        onToggle={vi.fn()}
        onAddQuest={vi.fn()}
        completedCount={0}
        totalCount={1}
      />,
      { wrapper: createWrapper(queryClient) },
    );

    expect(screen.getByTestId("timeline-marker-now")).toBeInTheDocument();
    expect(windowScrollToSpy.mock.calls.length + elementScrollToSpy.mock.calls.length).toBeGreaterThan(0);
  });

  it("does not auto-center for non-today dates", () => {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });

    render(
      <TodaysAgenda
        tasks={[
          {
            id: "task-scheduled-1",
            task_text: "Morning focus",
            completed: false,
            xp_reward: 25,
            scheduled_time: "08:00",
          },
        ]}
        selectedDate={new Date("2000-01-01T09:00:00.000Z")}
        onToggle={vi.fn()}
        onAddQuest={vi.fn()}
        completedCount={0}
        totalCount={1}
      />,
      { wrapper: createWrapper(queryClient) },
    );

    expect(windowScrollToSpy).not.toHaveBeenCalled();
    expect(elementScrollToSpy).not.toHaveBeenCalled();
  });

  it("re-centers when today remains selected and visibility toggles on", () => {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });

    const { rerender } = render(
      <TodaysAgenda
        tasks={[
          {
            id: "task-scheduled-1",
            task_text: "Morning focus",
            completed: false,
            xp_reward: 25,
            scheduled_time: "08:00",
          },
        ]}
        selectedDate={new Date()}
        isVisible={false}
        onToggle={vi.fn()}
        onAddQuest={vi.fn()}
        completedCount={0}
        totalCount={1}
      />,
      { wrapper: createWrapper(queryClient) },
    );

    expect(windowScrollToSpy).not.toHaveBeenCalled();
    expect(elementScrollToSpy).not.toHaveBeenCalled();

    rerender(
      <TodaysAgenda
        tasks={[
          {
            id: "task-scheduled-1",
            task_text: "Morning focus",
            completed: false,
            xp_reward: 25,
            scheduled_time: "08:00",
          },
        ]}
        selectedDate={new Date()}
        isVisible
        onToggle={vi.fn()}
        onAddQuest={vi.fn()}
        completedCount={0}
        totalCount={1}
      />,
    );

    expect(windowScrollToSpy.mock.calls.length + elementScrollToSpy.mock.calls.length).toBeGreaterThan(0);
  });

  it("renders timeline without scheduled category header text and without a visible drag handle", () => {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });

    render(
      <TodaysAgenda
        tasks={[
          {
            id: "task-scheduled-1",
            task_text: "Morning focus",
            completed: false,
            xp_reward: 25,
            scheduled_time: "08:00",
          },
        ]}
        selectedDate={new Date("2026-02-13T09:00:00.000Z")}
        onToggle={vi.fn()}
        onAddQuest={vi.fn()}
        completedCount={0}
        totalCount={1}
      />,
      { wrapper: createWrapper(queryClient) },
    );

    expect(screen.queryByText("Scheduled")).not.toBeInTheDocument();
    const scheduledPane = screen.getByTestId("scheduled-timeline-pane");
    expect(scheduledPane).toBeInTheDocument();
    expect(scheduledPane).toHaveClass("overflow-y-auto", "overflow-x-hidden");
    expect(screen.queryByRole("button", { name: /drag to reschedule/i })).not.toBeInTheDocument();
  });

  it("routes the empty-state add quest CTA through the normal quest sheet", () => {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });
    const onOpenCompanionPlanner = vi.fn();
    const onAddQuest = vi.fn();

    render(
      <TodaysAgenda
        tasks={[]}
        selectedDate={new Date("2026-02-13T09:00:00.000Z")}
        onToggle={vi.fn()}
        onAddQuest={onAddQuest}
        onOpenCompanionPlanner={onOpenCompanionPlanner}
        completedCount={0}
        totalCount={0}
      />,
      { wrapper: createWrapper(queryClient) },
    );

    const launcher = within(screen.getByTestId("empty-state-pane")).getByRole("button", { name: /Add Quest/i });
    fireEvent.click(launcher);

    expect(onAddQuest).toHaveBeenCalledTimes(1);
    expect(onOpenCompanionPlanner).not.toHaveBeenCalled();
    expect(launcher).toHaveAttribute("data-tour", "add-quest-launcher");
    expect(screen.getByText("New quest")).toBeInTheDocument();
  });

  it("adds mobile timeline clearance for the stacked quest launchers", () => {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });

    render(
      <TodaysAgenda
        tasks={[
          {
            id: "task-scheduled-clearance",
            task_text: "Protected focus block",
            completed: false,
            xp_reward: 25,
            scheduled_time: "08:00",
          },
        ]}
        selectedDate={new Date("2026-02-13T09:00:00.000Z")}
        onToggle={vi.fn()}
        onAddQuest={vi.fn()}
        completedCount={0}
        totalCount={1}
      />,
      { wrapper: createWrapper(queryClient) },
    );

    expect(screen.getByTestId("scheduled-timeline-pane").style.scrollPaddingBottom).toBe(`${QUEST_LAUNCHER_SCROLL_CLEARANCE_PX}px`);
    expect(screen.getByTestId("scheduled-timeline-content").style.paddingBottom).toBe(`${QUEST_LAUNCHER_SCROLL_CLEARANCE_PX}px`);
  });

  it("uses a fixed desktop pane height above the runtime bottom-nav offset instead of a max-height clamp", async () => {
    const restoreViewport = mockViewport({ height: 900 });
    document.documentElement.style.setProperty("--bottom-nav-runtime-offset", "96px");

    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });

    let paneRectSpy: ReturnType<typeof vi.spyOn> | null = null;
    try {
      render(
        <TodaysAgenda
          tasks={[
            {
              id: "task-scheduled-1",
              task_text: "Morning focus",
              completed: false,
              xp_reward: 25,
              scheduled_time: "08:00",
            },
          ]}
          selectedDate={new Date("2026-02-13T09:00:00.000Z")}
          layoutMode="desktop"
          onToggle={vi.fn()}
          onAddQuest={vi.fn()}
          completedCount={0}
          totalCount={1}
        />,
        { wrapper: createWrapper(queryClient) },
      );

      const scheduledPane = screen.getByTestId("scheduled-timeline-pane");
      paneRectSpy = vi
        .spyOn(scheduledPane, "getBoundingClientRect")
        .mockReturnValue(createDomRect({ top: 220, bottom: 420, left: 0, right: 800, width: 800, height: 200 }));

      act(() => {
        window.dispatchEvent(new Event("resize"));
      });

      await waitFor(() => {
        expect(scheduledPane.style.height).toBe("584px");
      });
      expect(scheduledPane.style.maxHeight).toBe("");
      expect(scheduledPane.style.scrollPaddingBottom).toBe("");
      expect(scheduledPane).toHaveClass("overflow-y-auto", "overflow-x-hidden");
      expect(screen.getByTestId("scheduled-timeline-content").style.paddingBottom).toBe("");
    } finally {
      paneRectSpy?.mockRestore();
      restoreViewport();
    }
  });

  it("keeps short desktop quest lists expanded to the available viewport height", async () => {
    const restoreViewport = mockViewport({ height: 820 });

    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });

    let paneRectSpy: ReturnType<typeof vi.spyOn> | null = null;
    try {
      render(
        <TodaysAgenda
          tasks={[
            {
              id: "task-scheduled-1",
              task_text: "Single desktop quest",
              completed: false,
              xp_reward: 16,
              scheduled_time: "09:00",
            },
          ]}
          selectedDate={new Date("2026-02-13T09:00:00.000Z")}
          layoutMode="desktop"
          onToggle={vi.fn()}
          onAddQuest={vi.fn()}
          completedCount={0}
          totalCount={1}
        />,
        { wrapper: createWrapper(queryClient) },
      );

      const scheduledPane = screen.getByTestId("scheduled-timeline-pane");
      paneRectSpy = vi
        .spyOn(scheduledPane, "getBoundingClientRect")
        .mockReturnValue(createDomRect({ top: 310, bottom: 470, left: 0, right: 800, width: 800, height: 160 }));

      act(() => {
        window.dispatchEvent(new Event("resize"));
      });

      await waitFor(() => {
        expect(scheduledPane.style.height).toBe("406px");
      });
      expect(scheduledPane.style.scrollPaddingBottom).toBe("");
      expect(scheduledPane).toHaveClass("overflow-y-auto", "overflow-x-hidden");
      expect(screen.getByTestId("scheduled-timeline-content").style.paddingBottom).toBe("");
    } finally {
      paneRectSpy?.mockRestore();
      restoreViewport();
    }
  });

  it("stretches the desktop empty state to the same viewport budget above the bottom nav", async () => {
    const restoreViewport = mockViewport({ height: 860 });
    document.documentElement.style.setProperty("--bottom-nav-runtime-offset", "100px");

    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });

    let paneRectSpy: ReturnType<typeof vi.spyOn> | null = null;
    try {
      render(
        <TodaysAgenda
          tasks={[]}
          selectedDate={new Date("2026-02-13T09:00:00.000Z")}
          layoutMode="desktop"
          onToggle={vi.fn()}
          onAddQuest={vi.fn()}
          completedCount={0}
          totalCount={0}
        />,
        { wrapper: createWrapper(queryClient) },
      );

      const emptyStatePane = screen.getByTestId("empty-state-pane");
      const scheduledPane = screen.getByTestId("scheduled-timeline-pane");
      paneRectSpy = vi
        .spyOn(scheduledPane, "getBoundingClientRect")
        .mockReturnValue(createDomRect({ top: 280, bottom: 520, left: 0, right: 800, width: 800, height: 240 }));

      act(() => {
        window.dispatchEvent(new Event("resize"));
      });

      await waitFor(() => {
        expect(scheduledPane.style.height).toBe("480px");
        expect(emptyStatePane.style.minHeight).toBe("480px");
      });
      expect(emptyStatePane.style.height).toBe("");
    } finally {
      paneRectSpy?.mockRestore();
      restoreViewport();
    }
  });

  it("adds mobile FAB clearance to the scheduled timeline pane", () => {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });

    render(
      <TodaysAgenda
        tasks={[
          {
            id: "task-scheduled-mobile-1",
            task_text: "Mobile focus block",
            completed: false,
            xp_reward: 18,
            scheduled_time: "09:00",
          },
        ]}
        selectedDate={new Date("2026-02-13T09:00:00.000Z")}
        layoutMode="mobile"
        onToggle={vi.fn()}
        onAddQuest={vi.fn()}
        completedCount={0}
        totalCount={1}
      />,
      { wrapper: createWrapper(queryClient) },
    );

    const scheduledPane = screen.getByTestId("scheduled-timeline-pane");
    const scheduledContent = screen.getByTestId("scheduled-timeline-content");

    expect(scheduledPane.style.scrollPaddingBottom).toBe(EXPECTED_MOBILE_FAB_SCROLL_CLEARANCE);
    expect(scheduledContent.style.paddingBottom).toBe(EXPECTED_MOBILE_FAB_SCROLL_CLEARANCE);
  });

  it("keeps mobile FAB clearance when only campaign content renders beneath placeholder timeline markers", () => {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });

    render(
      <TodaysAgenda
        tasks={[
          {
            id: "ritual-mobile-1",
            task_text: "Campaign ritual",
            completed: false,
            xp_reward: 14,
            habit_source_id: "habit-mobile-1",
            epic_id: "epic-mobile-1",
            epic_title: "Campaign Mobile",
          },
        ]}
        selectedDate={new Date("2026-02-13T09:00:00.000Z")}
        layoutMode="mobile"
        onToggle={vi.fn()}
        onAddQuest={vi.fn()}
        completedCount={0}
        totalCount={1}
        activeEpics={[]}
      />,
      { wrapper: createWrapper(queryClient) },
    );

    const scheduledPane = screen.getByTestId("scheduled-timeline-pane");
    const scheduledContent = screen.getByTestId("scheduled-timeline-content");

    expect(screen.getByText("Campaign Mobile")).toBeInTheDocument();
    expect(scheduledPane.style.scrollPaddingBottom).toBe(EXPECTED_MOBILE_FAB_SCROLL_CLEARANCE);
    expect(scheduledContent.style.paddingBottom).toBe(EXPECTED_MOBILE_FAB_SCROLL_CLEARANCE);
    expect(screen.queryByTestId("timeline-row-ritual-mobile-1")).not.toBeInTheDocument();
  });

  it("keeps quests timeline scheduled-only and excludes unscheduled quests", () => {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });

    render(
      <TodaysAgenda
        tasks={[
          {
            id: "task-scheduled-1",
            task_text: "Morning focus",
            completed: false,
            xp_reward: 25,
            scheduled_time: "08:00",
          },
          {
            id: "task-unscheduled-1",
            task_text: "Anytime focus",
            completed: false,
            xp_reward: 25,
            scheduled_time: null,
          },
        ]}
        selectedDate={new Date("2026-02-13T09:00:00.000Z")}
        onToggle={vi.fn()}
        onAddQuest={vi.fn()}
        completedCount={0}
        totalCount={2}
      />,
      { wrapper: createWrapper(queryClient) },
    );

    const pane = screen.getByTestId("scheduled-timeline-pane");
    const mobileRow = within(pane).getByTestId("timeline-row-task-scheduled-1");
    expect(mobileRow).toBeInTheDocument();
    expect(getQuestCardShell(mobileRow)).toHaveClass("journeys-quest-card-shell");
    expect(screen.queryByTestId("timeline-row-task-unscheduled-1")).not.toBeInTheDocument();
    expect(screen.queryByText("Anytime focus")).not.toBeInTheDocument();
    expect(screen.queryByText("Anytime")).not.toBeInTheDocument();
  });

  it("adds the readable shell class when readable quest cards are enabled", () => {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });

    render(
      <TodaysAgenda
        tasks={[
          {
            id: "task-readable-1",
            task_text: "Readable morning focus",
            completed: false,
            xp_reward: 25,
            scheduled_time: "08:00",
          },
        ]}
        selectedDate={new Date("2026-02-13T09:00:00.000Z")}
        readableQuestCardsEnabled
        onToggle={vi.fn()}
        onAddQuest={vi.fn()}
        completedCount={0}
        totalCount={1}
      />,
      { wrapper: createWrapper(queryClient) },
    );

    const pane = screen.getByTestId("scheduled-timeline-pane");
    const mobileRow = within(pane).getByTestId("timeline-row-task-readable-1");
    const readableShell = getQuestCardShell(mobileRow);
    expect(readableShell).toHaveClass(
      "journeys-quest-card-shell",
      "journeys-quest-card-shell--readable",
    );
    expect(readableShell).not.toHaveClass("border-white/10");
    expect(readableShell).not.toHaveClass("bg-white/[0.04]");
  });

  it("lets long mobile quest titles fit beside scheduled action controls", () => {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });
    const longTitle = "Social Media Engagement Strategy Review and Reflection";

    render(
      <TodaysAgenda
        tasks={[
          {
            id: "ritual-title-width-1",
            task_text: longTitle,
            completed: false,
            xp_reward: 14,
            scheduled_time: "14:00",
            estimated_duration: 60,
            habit_source_id: "habit-title-width-1",
            epic_id: "epic-title-width-1",
            epic_title: "Master UGC content creation",
            notes: "Keep this expandable so the chevron action remains visible.",
          },
        ]}
        selectedDate={new Date("2026-02-13T09:00:00.000Z")}
        onToggle={vi.fn()}
        onAddQuest={vi.fn()}
        onEditQuest={vi.fn()}
        completedCount={0}
        totalCount={1}
      />,
      { wrapper: createWrapper(queryClient) },
    );

    const pane = screen.getByTestId("scheduled-timeline-pane");
    const mobileRow = within(pane).getByTestId("timeline-row-ritual-title-width-1");
    const titleRegion = within(mobileRow).getByTestId("mobile-quest-title-region-ritual-title-width-1");
    const titleRow = within(mobileRow).getByTestId("mobile-quest-title-row-ritual-title-width-1");
    const actions = within(mobileRow).getByTestId("mobile-quest-actions-ritual-title-width-1");
    const marquee = within(titleRow).getByText(longTitle).parentElement as HTMLElement;

    expect(titleRegion).toHaveClass("min-w-0");
    expect(titleRow).toHaveClass("flex", "min-w-0", "w-full");
    expect(marquee).toHaveClass("min-w-0", "w-full", "flex-1");
    expect(actions).toHaveClass("min-w-max", "gap-1.5");
    expect(within(actions).getByRole("button", { name: "Quest actions" })).toBeInTheDocument();
    expect(within(actions).getByRole("button", { name: `Show quest details for ${longTitle}` })).toBeInTheDocument();
    expect(within(actions).getByText("+14")).toBeInTheDocument();
    expect(within(actions).getAllByRole("button")).toHaveLength(2);
    expect(within(titleRegion).getByText("Campaign Ritual - Master UGC content creation")).toBeInTheDocument();
  });

  it("opens full scheduled quest details from the mobile chevron", async () => {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });

    render(
      <TodaysAgenda
        tasks={[
          {
            id: "task-detail-1",
            task_text: "Daily Wealth Learning",
            completed: false,
            xp_reward: 20,
            scheduled_time: "09:00",
            estimated_duration: 45,
            is_main_quest: true,
            category: "mind",
            difficulty: "hard",
            priority: "high",
            is_recurring: true,
            recurrence_pattern: "daily",
            notes: "Read chapter one and capture three takeaways.",
            location: "123 Cosmic Way",
            attachments: [
              {
                id: "att-detail-1",
                taskId: "task-detail-1",
                fileUrl: "https://example.com/lesson.pdf",
                filePath: "users/u1/lesson.pdf",
                fileName: "Lesson Plan.pdf",
                mimeType: "application/pdf",
                fileSizeBytes: 4096,
                isImage: false,
                sortOrder: 0,
                createdAt: "2026-02-13T10:00:00.000Z",
              },
            ],
            subtasks: [
              {
                id: "subtask-detail-1",
                title: "Write three takeaways",
                completed: false,
                sort_order: 0,
              },
            ],
          },
        ]}
        selectedDate={new Date("2026-02-13T09:00:00.000Z")}
        onToggle={vi.fn()}
        onAddQuest={vi.fn()}
        completedCount={0}
        totalCount={1}
      />,
      { wrapper: createWrapper(queryClient) },
    );

    const row = screen.getByTestId("timeline-row-task-detail-1");
    const toggle = within(row).getByTestId("mobile-quest-detail-toggle-task-detail-1");
    expect(toggle).toHaveAttribute("data-interactive", "true");
    expect(toggle).toHaveAttribute("data-tap-control", "true");

    fireEvent.click(toggle);

    const drawer = await screen.findByTestId("mobile-scheduled-quest-detail-drawer-task-detail-1");
    expect(within(drawer).getByText("Daily Wealth Learning")).toBeInTheDocument();
    expect(within(drawer).getByText("Quest details")).toBeInTheDocument();
    expect(within(drawer).getByText("9:00 AM")).toBeInTheDocument();
    expect(within(drawer).getByText("45 min")).toBeInTheDocument();
    expect(within(drawer).getByText("+30 XP")).toBeInTheDocument();
    expect(within(drawer).getByText("Main quest")).toBeInTheDocument();
    expect(within(drawer).getByText("Read chapter one and capture three takeaways.")).toBeInTheDocument();
    expect(within(drawer).getByText("Write three takeaways")).toBeInTheDocument();
    expect(within(drawer).getByRole("link", { name: "Lesson Plan.pdf" })).toHaveAttribute(
      "href",
      "https://example.com/lesson.pdf",
    );
    expect(within(drawer).getByText("123 Cosmic Way")).toBeInTheDocument();
    expect(within(drawer).getByText("mind")).toBeInTheDocument();
    expect(within(drawer).getByText("hard")).toBeInTheDocument();
    expect(within(drawer).getByText("high priority")).toBeInTheDocument();
    expect(within(drawer).getByText("45m")).toBeInTheDocument();
    expect(within(drawer).getByText("Daily")).toBeInTheDocument();
  });

  it("uses row drag wiring for scheduled quests", () => {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });

    render(
      <TodaysAgenda
        tasks={[
          {
            id: "task-scheduled-1",
            task_text: "Morning focus",
            completed: false,
            xp_reward: 25,
            scheduled_time: "08:00",
          },
        ]}
        selectedDate={new Date("2026-02-13T09:00:00.000Z")}
        onToggle={vi.fn()}
        onAddQuest={vi.fn()}
        completedCount={0}
        totalCount={1}
      />,
      { wrapper: createWrapper(queryClient) },
    );

    expect(mocks.getRowDragPropsMock).toHaveBeenCalledWith("task-scheduled-1", "08:00");
    expect(mocks.getDragHandlePropsMock).not.toHaveBeenCalled();
    expect(mocks.useTimelineDragMock).toHaveBeenCalledWith(
      expect.objectContaining({
        ...SHARED_TIMELINE_DRAG_INTERACTION_PROFILE,
      }),
    );
  });

  it("does not wire row drag props when timeline drag is disabled", () => {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });

    render(
      <TodaysAgenda
        tasks={[
          {
            id: "task-scheduled-1",
            task_text: "Morning focus",
            completed: false,
            xp_reward: 25,
            scheduled_time: "08:00",
          },
        ]}
        selectedDate={new Date("2026-02-13T09:00:00.000Z")}
        disableTimelineDrag
        onToggle={vi.fn()}
        onAddQuest={vi.fn()}
        completedCount={0}
        totalCount={1}
      />,
      { wrapper: createWrapper(queryClient) },
    );

    expect(screen.getByTestId("timeline-row-task-scheduled-1")).toBeInTheDocument();
    expect(mocks.getRowDragPropsMock).not.toHaveBeenCalled();
  });

  it("does not forward row pointer down to row drag handler", () => {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });

    render(
      <TodaysAgenda
        tasks={[
          {
            id: "task-scheduled-1",
            task_text: "Morning focus",
            completed: false,
            xp_reward: 25,
            scheduled_time: "08:00",
          },
        ]}
        selectedDate={new Date("2026-02-13T09:00:00.000Z")}
        onToggle={vi.fn()}
        onAddQuest={vi.fn()}
        completedCount={0}
        totalCount={1}
      />,
      { wrapper: createWrapper(queryClient) },
    );

    const row = screen.getByTestId("timeline-row-task-scheduled-1");
    fireEvent.pointerDown(row, { pointerType: "mouse", button: 0, clientY: 100 });

    expect(mocks.rowPointerDownCaptureSpy).not.toHaveBeenCalled();
    expect(mocks.rowPointerDownSpy).not.toHaveBeenCalled();
    expect(mocks.handlePointerDownCaptureSpy).not.toHaveBeenCalled();
    expect(mocks.handlePointerDownSpy).not.toHaveBeenCalled();
  });

  it("forwards row touch start to row drag handler", () => {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });

    render(
      <TodaysAgenda
        tasks={[
          {
            id: "task-scheduled-1",
            task_text: "Morning focus",
            completed: false,
            xp_reward: 25,
            scheduled_time: "08:00",
          },
        ]}
        selectedDate={new Date("2026-02-13T09:00:00.000Z")}
        onToggle={vi.fn()}
        onAddQuest={vi.fn()}
        completedCount={0}
        totalCount={1}
      />,
      { wrapper: createWrapper(queryClient) },
    );

    const row = screen.getByTestId("timeline-row-task-scheduled-1");
    fireEvent.touchStart(row, { touches: [{ clientX: 0, clientY: 100 }] });

    expect(mocks.rowTouchStartCaptureSpy).toHaveBeenCalledTimes(1);
    expect(mocks.rowTouchStartSpy).toHaveBeenCalledTimes(1);
    expect(mocks.handleTouchStartCaptureSpy).not.toHaveBeenCalled();
    expect(mocks.handleTouchStartSpy).not.toHaveBeenCalled();
  });

  it("keeps pointer starts off row drag wiring and touch starts off handle-only drag wiring", () => {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });

    render(
      <TodaysAgenda
        tasks={[
          {
            id: "task-scheduled-1",
            task_text: "Morning focus",
            completed: false,
            xp_reward: 25,
            scheduled_time: "08:00",
          },
        ]}
        selectedDate={new Date("2026-02-13T09:00:00.000Z")}
        onToggle={vi.fn()}
        onAddQuest={vi.fn()}
        completedCount={0}
        totalCount={1}
      />,
      { wrapper: createWrapper(queryClient) },
    );

    const row = screen.getByTestId("timeline-row-task-scheduled-1");
    fireEvent.pointerDown(row, { pointerType: "mouse", button: 0, clientY: 100 });
    fireEvent.touchStart(row, { touches: [{ clientX: 0, clientY: 100 }] });

    expect(mocks.rowPointerDownCaptureSpy).not.toHaveBeenCalled();
    expect(mocks.rowPointerDownSpy).not.toHaveBeenCalled();
    expect(mocks.rowTouchStartCaptureSpy).toHaveBeenCalledTimes(1);
    expect(mocks.rowTouchStartSpy).toHaveBeenCalledTimes(1);
    expect(mocks.handlePointerDownCaptureSpy).not.toHaveBeenCalled();
    expect(mocks.handlePointerDownSpy).not.toHaveBeenCalled();
    expect(mocks.handleTouchStartCaptureSpy).not.toHaveBeenCalled();
    expect(mocks.handleTouchStartSpy).not.toHaveBeenCalled();
  });

  it("locks scheduled row touch action while long-pressed and restores when released", () => {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });

    const props = {
      tasks: [
        {
          id: "task-scheduled-1",
          task_text: "Morning focus",
          completed: false,
          xp_reward: 25,
          scheduled_time: "08:00",
        },
      ],
      onToggle: vi.fn(),
      onAddQuest: vi.fn(),
      completedCount: 0,
      totalCount: 1,
    };

    const renderAgenda = () => (
      <TodaysAgenda
        {...props}
        selectedDate={new Date("2026-02-13T09:00:00.000Z")}
      />
    );

    const { rerender } = render(
      renderAgenda(),
      { wrapper: createWrapper(queryClient) },
    );

    const getScheduledRowWrapper = () => {
      const row = screen.getByTestId("timeline-row-task-scheduled-1");
      return row.parentElement as HTMLElement;
    };

    expect(getScheduledRowWrapper().style.touchAction).toBe("pan-y");

    mocks.timelineDragState.longPressTaskId = "task-scheduled-1";
    rerender(renderAgenda());
    expect(getScheduledRowWrapper().style.touchAction).toBe("none");

    mocks.timelineDragState.longPressTaskId = null;
    rerender(renderAgenda());
    expect(getScheduledRowWrapper().style.touchAction).toBe("pan-y");
  });

  it("suppresses context menus on scheduled quest rows while keeping touch drag wiring", () => {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });

    render(
      <TodaysAgenda
        tasks={[
          {
            id: "task-scheduled-1",
            task_text: "Morning focus",
            completed: false,
            xp_reward: 25,
            scheduled_time: "08:00",
          },
        ]}
        selectedDate={new Date("2026-02-13T09:00:00.000Z")}
        onToggle={vi.fn()}
        onAddQuest={vi.fn()}
        completedCount={0}
        totalCount={1}
      />,
      { wrapper: createWrapper(queryClient) },
    );

    const row = screen.getByTestId("timeline-row-task-scheduled-1");
    const contextMenuEvent = new MouseEvent("contextmenu", {
      bubbles: true,
      cancelable: true,
    });

    expect(row.dispatchEvent(contextMenuEvent)).toBe(false);
    expect(contextMenuEvent.defaultPrevented).toBe(true);

    fireEvent.touchStart(row, { touches: [{ clientX: 0, clientY: 100 }] });

    expect(mocks.rowTouchStartCaptureSpy).toHaveBeenCalledTimes(1);
    expect(mocks.rowTouchStartSpy).toHaveBeenCalledTimes(1);
  });

  it("shows compact overlap copy for conflicting tasks", () => {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });

    render(
      <TodaysAgenda
        tasks={[
          {
            id: "task-scheduled-1",
            task_text: "Morning focus",
            completed: false,
            xp_reward: 25,
            scheduled_time: "09:00",
            estimated_duration: 60,
          },
          {
            id: "task-scheduled-2",
            task_text: "Standup",
            completed: false,
            xp_reward: 15,
            scheduled_time: "09:30",
            estimated_duration: 30,
          },
        ]}
        selectedDate={new Date("2026-02-13T09:00:00.000Z")}
        onToggle={vi.fn()}
        onAddQuest={vi.fn()}
        completedCount={0}
        totalCount={2}
      />,
      { wrapper: createWrapper(queryClient) },
    );

    expect(screen.getAllByText(/Overlaps:/).length).toBeGreaterThan(0);
  });

  it("keeps scheduled row order stable during drag preview updates", () => {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });
    mocks.timelineDragState.draggingTaskId = "task-scheduled-2";
    mocks.timelineDragState.isDragging = true;
    mocks.timelineDragState.previewTime = "08:30";

    const { container } = render(
      <TodaysAgenda
        tasks={[
          {
            id: "task-scheduled-1",
            task_text: "Deep work",
            completed: false,
            xp_reward: 25,
            scheduled_time: "09:00",
            estimated_duration: 60,
          },
          {
            id: "task-scheduled-2",
            task_text: "Standup",
            completed: false,
            xp_reward: 15,
            scheduled_time: "11:00",
            estimated_duration: 30,
          },
        ]}
        selectedDate={new Date("2026-02-13T09:00:00.000Z")}
        onToggle={vi.fn()}
        onAddQuest={vi.fn()}
        completedCount={0}
        totalCount={2}
      />,
      { wrapper: createWrapper(queryClient) },
    );

    const orderedRowIds = Array.from(
      container.querySelectorAll('[data-testid^="timeline-row-task-scheduled-"]'),
    ).map((element) => element.getAttribute("data-testid"));

    expect(orderedRowIds).toEqual([
      "timeline-row-task-scheduled-1",
      "timeline-row-task-scheduled-2",
    ]);
  });

  it("keeps dragged row lane metadata stable while preview time changes", () => {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });
    mocks.timelineDragState.draggingTaskId = "task-scheduled-2";
    mocks.timelineDragState.isDragging = true;
    mocks.timelineDragState.previewTime = "09:30";

    const tasks = [
      {
        id: "task-scheduled-1",
        task_text: "Deep work",
        completed: false,
        xp_reward: 25,
        scheduled_time: "09:00",
        estimated_duration: 60,
      },
      {
        id: "task-scheduled-2",
        task_text: "Standup",
        completed: false,
        xp_reward: 15,
        scheduled_time: "09:30",
        estimated_duration: 30,
      },
    ];

    const { container, rerender } = render(
      <TodaysAgenda
        tasks={tasks}
        selectedDate={new Date("2026-02-13T09:00:00.000Z")}
        onToggle={vi.fn()}
        onAddQuest={vi.fn()}
        completedCount={0}
        totalCount={2}
      />,
      { wrapper: createWrapper(queryClient) },
    );

    const initiallyDraggedRow = screen.getByTestId("timeline-row-task-scheduled-2").parentElement;
    expect(initiallyDraggedRow).toBeTruthy();
    expect(initiallyDraggedRow).toHaveAttribute("data-timeline-lane", "1");
    expect(initiallyDraggedRow).toHaveAttribute("data-timeline-lane-count", "2");
    expect(initiallyDraggedRow).toHaveAttribute("data-timeline-overlap", "1");

    mocks.timelineDragState.previewTime = "08:30";
    rerender(
      <TodaysAgenda
        tasks={tasks}
        selectedDate={new Date("2026-02-13T09:00:00.000Z")}
        onToggle={vi.fn()}
        onAddQuest={vi.fn()}
        completedCount={0}
        totalCount={2}
      />,
    );

    const orderedRowIds = Array.from(
      container.querySelectorAll('[data-testid^="timeline-row-task-scheduled-"]'),
    ).map((element) => element.getAttribute("data-testid"));
    expect(orderedRowIds).toEqual([
      "timeline-row-task-scheduled-1",
      "timeline-row-task-scheduled-2",
    ]);

    const draggedRowAfterPreviewShift = screen.getByTestId("timeline-row-task-scheduled-2").parentElement;
    expect(draggedRowAfterPreviewShift).toBeTruthy();
    expect(draggedRowAfterPreviewShift).toHaveAttribute("data-timeline-lane", "1");
    expect(draggedRowAfterPreviewShift).toHaveAttribute("data-timeline-lane-count", "2");
    expect(draggedRowAfterPreviewShift).toHaveAttribute("data-timeline-overlap", "1");
  });

  it("exposes lane metadata for overlapping scheduled rows", () => {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });

    render(
      <TodaysAgenda
        tasks={[
          {
            id: "task-scheduled-1",
            task_text: "Morning focus",
            completed: false,
            xp_reward: 25,
            scheduled_time: "09:00",
            estimated_duration: 60,
          },
          {
            id: "task-scheduled-2",
            task_text: "Standup",
            completed: false,
            xp_reward: 15,
            scheduled_time: "09:30",
            estimated_duration: 30,
          },
        ]}
        selectedDate={new Date("2026-02-13T09:00:00.000Z")}
        onToggle={vi.fn()}
        onAddQuest={vi.fn()}
        completedCount={0}
        totalCount={2}
      />,
      { wrapper: createWrapper(queryClient) },
    );

    const firstRow = screen.getByTestId("timeline-row-task-scheduled-1");
    const secondRow = screen.getByTestId("timeline-row-task-scheduled-2");

    expect(firstRow).toHaveAttribute("data-timeline-lane", "0");
    expect(firstRow).toHaveAttribute("data-timeline-overlap", "1");
    expect(secondRow).toHaveAttribute("data-timeline-lane", "1");
    expect(secondRow).toHaveAttribute("data-timeline-overlap", "1");
  });

  it("bounds shifted overlap rows so lane offsets do not create horizontal overflow", () => {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });

    render(
      <TodaysAgenda
        tasks={[
          {
            id: "task-scheduled-1",
            task_text: "Morning focus",
            completed: false,
            xp_reward: 25,
            scheduled_time: "09:00",
            estimated_duration: 60,
          },
          {
            id: "task-scheduled-2",
            task_text: "Standup",
            completed: false,
            xp_reward: 15,
            scheduled_time: "09:30",
            estimated_duration: 30,
          },
        ]}
        selectedDate={new Date("2026-02-13T09:00:00.000Z")}
        onToggle={vi.fn()}
        onAddQuest={vi.fn()}
        completedCount={0}
        totalCount={2}
      />,
      { wrapper: createWrapper(queryClient) },
    );

    const shiftedRowWrapper = screen.getByTestId("timeline-row-task-scheduled-2").parentElement;
    expect(shiftedRowWrapper).toBeTruthy();

    const shiftPx = Number(shiftedRowWrapper?.getAttribute("data-timeline-shift-px") ?? "0");
    expect(shiftPx).toBeGreaterThan(0);
    expect(shiftedRowWrapper).toHaveStyle({ maxWidth: `calc(100% - ${shiftPx}px)` });
  });

  it("does not render side duration indicators for scheduled rows", () => {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });

    render(
      <TodaysAgenda
        tasks={[
          {
            id: "task-scheduled-1",
            task_text: "Morning focus",
            completed: false,
            xp_reward: 25,
            scheduled_time: "09:00",
            estimated_duration: 45,
          },
          {
            id: "task-scheduled-2",
            task_text: "Inbox zero",
            completed: false,
            xp_reward: 15,
            scheduled_time: "10:00",
            estimated_duration: null,
          },
        ]}
        selectedDate={new Date("2026-02-13T09:00:00.000Z")}
        onToggle={vi.fn()}
        onAddQuest={vi.fn()}
        completedCount={0}
        totalCount={2}
      />,
      { wrapper: createWrapper(queryClient) },
    );

    expect(screen.queryByTestId("timeline-duration-indicator")).not.toBeInTheDocument();
  });

  it("uses duration-proportional row heights for mac desktop scheduled tasks", () => {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });

    render(
      <TodaysAgenda
        tasks={[
          {
            id: "task-scheduled-1",
            task_text: "Deep work block",
            completed: false,
            xp_reward: 25,
            scheduled_time: "09:00",
            estimated_duration: 60,
          },
          {
            id: "task-scheduled-2",
            task_text: "Standup",
            completed: false,
            xp_reward: 15,
            scheduled_time: "10:00",
            estimated_duration: 30,
          },
          {
            id: "task-scheduled-3",
            task_text: "Fallback block",
            completed: false,
            xp_reward: 15,
            scheduled_time: "11:00",
            estimated_duration: null,
          },
        ]}
        selectedDate={new Date("2026-02-13T09:00:00.000Z")}
        layoutMode="desktop"
        useMacDurationSizedDesktopTimelineRows
        timedTaskDurationFallbackMinutes={30}
        onToggle={vi.fn()}
        onAddQuest={vi.fn()}
        completedCount={0}
        totalCount={3}
      />,
      { wrapper: createWrapper(queryClient) },
    );

    expect(screen.getByTestId("timeline-row-task-scheduled-1")).toHaveStyle({ minHeight: "120px" });
    expect(screen.getByTestId("timeline-row-task-scheduled-2")).toHaveStyle({ minHeight: "60px" });
    expect(screen.getByTestId("timeline-row-task-scheduled-3")).toHaveStyle({ minHeight: "60px" });
  });

  it("keeps default desktop scheduled row sizing when mac duration sizing is disabled", () => {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });

    render(
      <TodaysAgenda
        tasks={[
          {
            id: "task-scheduled-1",
            task_text: "Deep work block",
            completed: false,
            xp_reward: 25,
            scheduled_time: "09:00",
            estimated_duration: 60,
          },
        ]}
        selectedDate={new Date("2026-02-13T09:00:00.000Z")}
        layoutMode="desktop"
        onToggle={vi.fn()}
        onAddQuest={vi.fn()}
        completedCount={0}
        totalCount={1}
      />,
      { wrapper: createWrapper(queryClient) },
    );

    expect(screen.getByTestId("timeline-row-task-scheduled-1").style.minHeight).toBe("");
  });

  it("removes added spacing between scheduled rows", () => {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });

    render(
      <TodaysAgenda
        tasks={[
          {
            id: "task-scheduled-1",
            task_text: "Morning focus",
            completed: false,
            xp_reward: 25,
            scheduled_time: "08:00",
          },
          {
            id: "task-scheduled-2",
            task_text: "Late night review",
            completed: false,
            xp_reward: 25,
            scheduled_time: "23:00",
          },
        ]}
        selectedDate={new Date("2000-01-01T09:00:00.000Z")}
        onToggle={vi.fn()}
        onAddQuest={vi.fn()}
        completedCount={0}
        totalCount={2}
      />,
      { wrapper: createWrapper(queryClient) },
    );

    const secondRow = screen.getByTestId("timeline-row-task-scheduled-2").parentElement;
    expect(secondRow).toBeTruthy();
    const marginTop = Number.parseFloat(secondRow?.style.marginTop || "0");
    expect(marginTop).toBe(0);
  });

  it("uses drag preview time in timeline row during active drag", () => {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });
    mocks.timelineDragState.draggingTaskId = "task-scheduled-1";
    mocks.timelineDragState.isDragging = true;
    mocks.timelineDragState.previewTime = "09:45";

    render(
      <TodaysAgenda
        tasks={[
          {
            id: "task-scheduled-1",
            task_text: "Morning focus",
            completed: false,
            xp_reward: 25,
            scheduled_time: "08:00",
          },
        ]}
        selectedDate={new Date("2026-02-13T09:00:00.000Z")}
        onToggle={vi.fn()}
        onAddQuest={vi.fn()}
        completedCount={0}
        totalCount={1}
      />,
      { wrapper: createWrapper(queryClient) },
    );

    expect(within(screen.getByTestId("timeline-row-task-scheduled-1")).getByTestId("timeline-row-time")).toHaveTextContent("09:45");
  });

  it("renders a fixed high-z drag overlay and keeps in-list placeholder during active drag", async () => {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });
    mocks.timelineDragState.draggingTaskId = "task-scheduled-1";
    mocks.timelineDragState.isDragging = true;
    mocks.timelineDragState.previewTime = "09:45";
    mocks.dragOffsetMotionValue.set(32);

    render(
      <TodaysAgenda
        tasks={[
          {
            id: "task-scheduled-1",
            task_text: "Morning focus",
            completed: false,
            xp_reward: 25,
            scheduled_time: "08:00",
          },
          {
            id: "task-scheduled-2",
            task_text: "Standup",
            completed: false,
            xp_reward: 20,
            scheduled_time: "09:30",
          },
        ]}
        selectedDate={new Date("2026-02-13T09:00:00.000Z")}
        onToggle={vi.fn()}
        onAddQuest={vi.fn()}
        completedCount={0}
        totalCount={2}
      />,
      { wrapper: createWrapper(queryClient) },
    );

    await waitFor(() => {
      expect(screen.getByTestId("timeline-drag-overlay")).toBeInTheDocument();
    });
    expect(screen.getByTestId("timeline-drag-overlay")).toHaveClass("fixed", "z-[120]");
    expect(screen.getByTestId("timeline-drag-overlay-row-task-scheduled-1")).toBeInTheDocument();

    const draggedRowInList = screen.getByTestId("timeline-row-task-scheduled-1").parentElement;
    expect(draggedRowInList).toBeTruthy();
    expect(draggedRowInList).toHaveStyle({ opacity: "0" });
  });

  it("requires top overshoot beyond the neutral zone before edge-hold starts, then accelerates by tier", () => {
    vi.useFakeTimers();
    const setIntervalSpy = vi.spyOn(window, "setInterval");
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });
    mocks.timelineDragState.draggingTaskId = "task-scheduled-1";
    mocks.timelineDragState.isDragging = true;
    mocks.dragOffsetMotionValue.set(0);

    render(
      <TodaysAgenda
        tasks={[
          {
            id: "task-scheduled-1",
            task_text: "Morning focus",
            completed: false,
            xp_reward: 25,
            scheduled_time: "08:00",
          },
        ]}
        selectedDate={new Date("2026-02-13T09:00:00.000Z")}
        onToggle={vi.fn()}
        onAddQuest={vi.fn()}
        completedCount={0}
        totalCount={1}
      />,
      { wrapper: createWrapper(queryClient) },
    );

    const edgeHoldDelays = () => setIntervalSpy.mock.calls
      .map(([, delay]) => delay)
      .filter((delay): delay is number => typeof delay === "number" && delay < 1000);

    act(() => {
      vi.advanceTimersByTime(260);
    });
    expect(screen.getByTestId("timeline-drag-overlay")).toBeInTheDocument();
    expect(edgeHoldDelays()).not.toContain(180);
    expect(mocks.nudgeByFineStepMock).not.toHaveBeenCalled();

    act(() => {
      mocks.dragOffsetMotionValue.set(-8);
      vi.advanceTimersByTime(260);
    });
    expect(edgeHoldDelays()).not.toContain(180);
    expect(mocks.nudgeByFineStepMock).not.toHaveBeenCalled();

    act(() => {
      mocks.dragOffsetMotionValue.set(-20);
      vi.advanceTimersByTime(190);
    });
    expect(edgeHoldDelays()).toContain(180);

    const callsBeforeNearTier = mocks.nudgeByFineStepMock.mock.calls.length;
    act(() => {
      vi.advanceTimersByTime(190);
    });
    const callsAfterNearTier = mocks.nudgeByFineStepMock.mock.calls.length;
    expect(callsAfterNearTier - callsBeforeNearTier).toBeGreaterThanOrEqual(1);

    const callsBeforeMediumTier = mocks.nudgeByFineStepMock.mock.calls.length;
    act(() => {
      mocks.dragOffsetMotionValue.set(-80);
      vi.advanceTimersByTime(150);
    });
    expect(edgeHoldDelays()).toContain(140);
    const callsAfterMediumTier = mocks.nudgeByFineStepMock.mock.calls.length;
    expect(callsAfterMediumTier - callsBeforeMediumTier).toBeGreaterThanOrEqual(1);

    const callsBeforeHighTier = mocks.nudgeByFineStepMock.mock.calls.length;
    act(() => {
      mocks.dragOffsetMotionValue.set(-140);
      vi.advanceTimersByTime(110);
    });
    expect(edgeHoldDelays()).toContain(100);
    const callsAfterHighTier = mocks.nudgeByFineStepMock.mock.calls.length;
    expect(callsAfterHighTier - callsBeforeHighTier).toBeGreaterThanOrEqual(2);

    const callsBeforeExtremeTier = mocks.nudgeByFineStepMock.mock.calls.length;
    act(() => {
      mocks.dragOffsetMotionValue.set(-220);
      vi.advanceTimersByTime(85);
    });
    expect(edgeHoldDelays()).toContain(75);
    const callsAfterExtremeTier = mocks.nudgeByFineStepMock.mock.calls.length;
    expect(callsAfterExtremeTier - callsBeforeExtremeTier).toBeGreaterThanOrEqual(3);
    expect((mocks.nudgeByFineStepMock.mock.calls as unknown as Array<[number]>).every(([direction]) => direction === -1)).toBe(true);

    setIntervalSpy.mockRestore();
    vi.useRealTimers();
  });

  it("keeps edge-hold speed tied to edge position when visual offset changes at a fixed hold point", () => {
    vi.useFakeTimers();
    const setIntervalSpy = vi.spyOn(window, "setInterval");
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });
    mocks.timelineDragState.draggingTaskId = "task-scheduled-1";
    mocks.timelineDragState.isDragging = true;
    mocks.dragOffsetMotionValue.set(0);
    mocks.dragEdgeMotionValue.set(0);
    mocks.timelineDragState.dragEdgeOffsetY = mocks.dragEdgeMotionValue;

    try {
      render(
        <TodaysAgenda
          tasks={[
            {
              id: "task-scheduled-1",
              task_text: "Morning focus",
              completed: false,
              xp_reward: 25,
              scheduled_time: "08:00",
            },
          ]}
          selectedDate={new Date("2026-02-13T09:00:00.000Z")}
          onToggle={vi.fn()}
          onAddQuest={vi.fn()}
          completedCount={0}
          totalCount={1}
        />,
        { wrapper: createWrapper(queryClient) },
      );

      act(() => {
        mocks.dragEdgeMotionValue.set(-80);
        mocks.dragOffsetMotionValue.set(-80);
        vi.advanceTimersByTime(330);
      });
      const edgeHoldDelaysAtFixedEdge = setIntervalSpy.mock.calls
        .map(([, delay]) => delay)
        .filter((delay): delay is number => typeof delay === "number" && delay < 1000);
      expect(edgeHoldDelaysAtFixedEdge).toContain(140);

      const callsBeforeVisualOnlyGrowth = mocks.nudgeByFineStepMock.mock.calls.length;
      act(() => {
        mocks.dragOffsetMotionValue.set(-220);
        vi.advanceTimersByTime(320);
      });
      const edgeHoldDelaysAfterVisualOnlyGrowth = setIntervalSpy.mock.calls
        .map(([, delay]) => delay)
        .filter((delay): delay is number => typeof delay === "number" && delay < 1000);

      expect(edgeHoldDelaysAfterVisualOnlyGrowth).toContain(140);
      expect(edgeHoldDelaysAfterVisualOnlyGrowth).not.toContain(100);
      expect(edgeHoldDelaysAfterVisualOnlyGrowth).not.toContain(75);
      expect(mocks.nudgeByFineStepMock.mock.calls.length - callsBeforeVisualOnlyGrowth).toBeGreaterThan(0);

      const callsBeforeEdgeMove = mocks.nudgeByFineStepMock.mock.calls.length;
      act(() => {
        mocks.dragEdgeMotionValue.set(-140);
        vi.advanceTimersByTime(120);
      });
      const edgeHoldDelaysAfterEdgeMove = setIntervalSpy.mock.calls
        .map(([, delay]) => delay)
        .filter((delay): delay is number => typeof delay === "number" && delay < 1000);

      expect(edgeHoldDelaysAfterEdgeMove).toContain(100);
      expect(mocks.nudgeByFineStepMock.mock.calls.length - callsBeforeEdgeMove).toBeGreaterThanOrEqual(2);
    } finally {
      mocks.timelineDragState.dragEdgeOffsetY = mocks.dragOffsetMotionValue;
      setIntervalSpy.mockRestore();
      vi.useRealTimers();
    }
  });

  it("accelerates bottom edge-hold cadence as overshoot increases", () => {
    vi.useFakeTimers();
    const setIntervalSpy = vi.spyOn(window, "setInterval");
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });
    mocks.timelineDragState.draggingTaskId = "task-scheduled-1";
    mocks.timelineDragState.isDragging = true;
    mocks.dragOffsetMotionValue.set(670);

    render(
      <TodaysAgenda
        tasks={[
          {
            id: "task-scheduled-1",
            task_text: "Morning focus",
            completed: false,
            xp_reward: 25,
            scheduled_time: "08:00",
          },
        ]}
        selectedDate={new Date("2026-02-13T09:00:00.000Z")}
        onToggle={vi.fn()}
        onAddQuest={vi.fn()}
        completedCount={0}
        totalCount={1}
      />,
      { wrapper: createWrapper(queryClient) },
    );

    act(() => {
      vi.advanceTimersByTime(180);
    });
    expect(screen.getByTestId("timeline-drag-overlay")).toBeInTheDocument();

    const callsBeforeExtremeTier = mocks.nudgeByFineStepMock.mock.calls.length;
    act(() => {
      mocks.dragOffsetMotionValue.set(1000);
      vi.advanceTimersByTime(85);
    });
    const edgeHoldDelays = setIntervalSpy.mock.calls
      .map(([, delay]) => delay)
      .filter((delay): delay is number => typeof delay === "number" && delay < 1000);
    expect(edgeHoldDelays).toContain(75);
    const callsAfterExtremeTier = mocks.nudgeByFineStepMock.mock.calls.length;
    expect(callsAfterExtremeTier - callsBeforeExtremeTier).toBeGreaterThanOrEqual(3);
    expect((mocks.nudgeByFineStepMock.mock.calls as unknown as Array<[number]>).every(([direction]) => direction === 1)).toBe(true);

    setIntervalSpy.mockRestore();
    vi.useRealTimers();
  });

  it("anchors bottom edge-hold to nav bounds even when pane bottom is higher", async () => {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });
    mocks.timelineDragState.draggingTaskId = "task-scheduled-1";
    mocks.timelineDragState.isDragging = true;
    mocks.dragOffsetMotionValue.set(0);

    const nav = document.createElement("nav");
    nav.setAttribute("aria-label", "Main navigation");
    document.body.appendChild(nav);
    const navRectSpy = vi
      .spyOn(nav, "getBoundingClientRect")
      .mockReturnValue(createDomRect({ top: 1200, bottom: 1300, left: 0, right: 320, width: 320, height: 100 }));

    let setIntervalSpy: ReturnType<typeof vi.spyOn> | null = null;
    let paneRectSpy: ReturnType<typeof vi.spyOn> | null = null;
    try {
      render(
        <TodaysAgenda
          tasks={[
            {
              id: "task-scheduled-1",
              task_text: "Morning focus",
              completed: false,
              xp_reward: 25,
              scheduled_time: "08:00",
            },
          ]}
          selectedDate={new Date("2026-02-13T09:00:00.000Z")}
          onToggle={vi.fn()}
          onAddQuest={vi.fn()}
          completedCount={0}
          totalCount={1}
        />,
        { wrapper: createWrapper(queryClient) },
      );

      expect(await screen.findByTestId("timeline-drag-overlay")).toBeInTheDocument();

      const pane = screen.getByTestId("scheduled-timeline-pane");
      paneRectSpy = vi
        .spyOn(pane, "getBoundingClientRect")
        .mockReturnValue(createDomRect({ top: 100, bottom: 260, left: 0, right: 320, width: 320, height: 160 }));

      vi.useFakeTimers();
      setIntervalSpy = vi.spyOn(window, "setInterval");
      const callsBeforeNavFreeMove = mocks.nudgeByFineStepMock.mock.calls.length;
      act(() => {
        mocks.dragOffsetMotionValue.set(500);
        vi.advanceTimersByTime(210);
      });
      expect(mocks.nudgeByFineStepMock.mock.calls.length).toBe(callsBeforeNavFreeMove);

      const callsBeforePin = mocks.nudgeByFineStepMock.mock.calls.length;
      act(() => {
        mocks.dragOffsetMotionValue.set(3000);
        vi.advanceTimersByTime(280);
      });
      const edgeHoldDelays = setIntervalSpy.mock.calls
        .map(([, delay]) => delay)
        .filter((delay): delay is number => typeof delay === "number" && delay < 1000);

      expect(edgeHoldDelays).toContain(75);
      expect(mocks.nudgeByFineStepMock.mock.calls.length - callsBeforePin).toBeGreaterThanOrEqual(3);
      expect((mocks.nudgeByFineStepMock.mock.calls as unknown as Array<[number]>).every(([direction]) => direction === 1)).toBe(true);
    } finally {
      paneRectSpy?.mockRestore();
      navRectSpy.mockRestore();
      nav.remove();
      setIntervalSpy?.mockRestore();
      vi.useRealTimers();
    }
  });

  it("stops edge-hold nudging when unpinned or drag ends", () => {
    vi.useFakeTimers();
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });
    mocks.timelineDragState.draggingTaskId = "task-scheduled-1";
    mocks.timelineDragState.isDragging = true;
    mocks.dragOffsetMotionValue.set(-1000);

    const { rerender } = render(
      <TodaysAgenda
        tasks={[
          {
            id: "task-scheduled-1",
            task_text: "Morning focus",
            completed: false,
            xp_reward: 25,
            scheduled_time: "08:00",
          },
        ]}
        selectedDate={new Date("2026-02-13T09:00:00.000Z")}
        onToggle={vi.fn()}
        onAddQuest={vi.fn()}
        completedCount={0}
        totalCount={1}
      />,
      { wrapper: createWrapper(queryClient) },
    );

    act(() => {
      vi.advanceTimersByTime(260);
    });
    expect(mocks.nudgeByFineStepMock.mock.calls.length).toBeGreaterThan(0);

    act(() => {
      mocks.dragOffsetMotionValue.set(120);
    });
    const callsAfterUnpin = mocks.nudgeByFineStepMock.mock.calls.length;

    act(() => {
      vi.advanceTimersByTime(500);
    });
    expect(mocks.nudgeByFineStepMock.mock.calls.length).toBe(callsAfterUnpin);

    mocks.timelineDragState.draggingTaskId = null;
    mocks.timelineDragState.isDragging = false;
    rerender(
      <TodaysAgenda
        tasks={[
          {
            id: "task-scheduled-1",
            task_text: "Morning focus",
            completed: false,
            xp_reward: 25,
            scheduled_time: "08:00",
          },
        ]}
        selectedDate={new Date("2026-02-13T09:00:00.000Z")}
        onToggle={vi.fn()}
        onAddQuest={vi.fn()}
        completedCount={0}
        totalCount={1}
      />,
    );

    const callsAfterDragEnd = mocks.nudgeByFineStepMock.mock.calls.length;
    act(() => {
      vi.advanceTimersByTime(500);
    });
    expect(mocks.nudgeByFineStepMock.mock.calls.length).toBe(callsAfterDragEnd);
    vi.useRealTimers();
  });

  it("stops repeating edge-hold nudges when nudgeByFineStep returns false", () => {
    vi.useFakeTimers();
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });
    mocks.nudgeByFineStepMock.mockReturnValue(false);
    mocks.timelineDragState.draggingTaskId = "task-scheduled-1";
    mocks.timelineDragState.isDragging = true;
    mocks.dragOffsetMotionValue.set(-120);

    render(
      <TodaysAgenda
        tasks={[
          {
            id: "task-scheduled-1",
            task_text: "Morning focus",
            completed: false,
            xp_reward: 25,
            scheduled_time: "08:00",
          },
        ]}
        selectedDate={new Date("2026-02-13T09:00:00.000Z")}
        onToggle={vi.fn()}
        onAddQuest={vi.fn()}
        completedCount={0}
        totalCount={1}
      />,
      { wrapper: createWrapper(queryClient) },
    );

    act(() => {
      vi.advanceTimersByTime(300);
    });

    expect(mocks.nudgeByFineStepMock).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
  });

  it("does not render zoom rail while drag preview is active", () => {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });
    mocks.timelineDragState.draggingTaskId = "task-scheduled-1";
    mocks.timelineDragState.isDragging = true;
    mocks.timelineDragState.zoomRail = {
      mode: "fine",
      clientY: 320,
      snappedMinute: 585,
      ticks: [],
    };

    render(
      <TodaysAgenda
        tasks={[
          {
            id: "task-scheduled-1",
            task_text: "Morning focus",
            completed: false,
            xp_reward: 25,
            scheduled_time: "08:00",
          },
        ]}
        selectedDate={new Date("2026-02-13T09:00:00.000Z")}
        onToggle={vi.fn()}
        onAddQuest={vi.fn()}
        completedCount={0}
        totalCount={1}
      />,
      { wrapper: createWrapper(queryClient) },
    );

    expect(screen.queryByTestId("drag-time-zoom-rail")).not.toBeInTheDocument();
  });

  it("shows the row action trigger when delete is available", () => {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });
    const onDeleteQuest = vi.fn();

    render(
      <TodaysAgenda
        tasks={[
          {
            id: "task-scheduled-1",
            task_text: "Morning focus",
            completed: false,
            xp_reward: 25,
            scheduled_time: "08:00",
          },
        ]}
        selectedDate={new Date("2026-02-13T09:00:00.000Z")}
        onToggle={vi.fn()}
        onAddQuest={vi.fn()}
        completedCount={0}
        totalCount={1}
        onDeleteQuest={onDeleteQuest}
      />,
      { wrapper: createWrapper(queryClient) },
    );

    expect(screen.getByLabelText("Quest actions")).toBeInTheDocument();
    expect(onDeleteQuest).not.toHaveBeenCalled();
  });

  it("keeps quest actions visible on touch layouts while preserving desktop hover/focus reveal classes", () => {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });

    render(
      <TodaysAgenda
        tasks={[
          {
            id: "task-scheduled-1",
            task_text: "Morning focus",
            completed: false,
            xp_reward: 25,
            scheduled_time: "08:00",
          },
        ]}
        selectedDate={new Date("2026-02-13T09:00:00.000Z")}
        onToggle={vi.fn()}
        onAddQuest={vi.fn()}
        completedCount={0}
        totalCount={1}
        onDeleteQuest={vi.fn()}
      />,
      { wrapper: createWrapper(queryClient) },
    );

    const actionTrigger = screen.getByLabelText("Quest actions");
    expect(actionTrigger).toHaveClass("opacity-100");
    expect(actionTrigger).toHaveClass("md:opacity-0");
    expect(actionTrigger).toHaveClass("md:group-hover:opacity-100");
    expect(actionTrigger).toHaveClass("md:group-focus-within:opacity-100");
    expect(actionTrigger).toHaveClass("md:focus-visible:opacity-100");
  });

  it("keeps only one quest action menu open at a time", async () => {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });

    render(
      <TodaysAgenda
        tasks={[
          {
            id: "task-scheduled-1",
            task_text: "Morning focus",
            completed: false,
            xp_reward: 25,
            scheduled_time: "08:00",
          },
          {
            id: "task-scheduled-2",
            task_text: "Deep work",
            completed: false,
            xp_reward: 30,
            scheduled_time: "10:00",
          },
        ]}
        selectedDate={new Date("2026-02-13T09:00:00.000Z")}
        onToggle={vi.fn()}
        onAddQuest={vi.fn()}
        completedCount={0}
        totalCount={2}
        onDeleteQuest={vi.fn()}
      />,
      { wrapper: createWrapper(queryClient) },
    );

    const [firstActionTrigger, secondActionTrigger] = screen.getAllByLabelText("Quest actions");

    openDropdownMenu(firstActionTrigger);

    await waitFor(() => {
      expect(screen.getAllByText("Delete quest")).toHaveLength(1);
    });

    openDropdownMenu(secondActionTrigger);

    await waitFor(() => {
      expect(screen.getAllByText("Delete quest")).toHaveLength(1);
    });
  });

  it("keeps the sort dropdown working independently of quest action menus", async () => {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });
    const companionFrostedThemeStyle = {
      "--companion-frosted-primary": "155 64% 55%",
    } as CSSProperties;

    render(
      <TodaysAgenda
        tasks={[
          {
            id: "task-scheduled-1",
            task_text: "Morning focus",
            completed: false,
            xp_reward: 25,
            scheduled_time: "08:00",
          },
          {
            id: "task-scheduled-2",
            task_text: "Deep work",
            completed: false,
            xp_reward: 30,
            scheduled_time: "10:00",
          },
        ]}
        selectedDate={new Date("2026-02-13T09:00:00.000Z")}
        onToggle={vi.fn()}
        onAddQuest={vi.fn()}
        completedCount={0}
        totalCount={2}
        onDeleteQuest={vi.fn()}
        companionFrostedThemeStyle={companionFrostedThemeStyle}
      />,
      { wrapper: createWrapper(queryClient) },
    );

    openDropdownMenu(screen.getAllByLabelText("Quest actions")[0]);

    await waitFor(() => {
      expect(screen.getAllByText("Delete quest")).toHaveLength(1);
    });
    expect(screen.getByTestId("quest-action-menu-task-scheduled-1")).toHaveClass("companion-frosted-planner-dark");
    expect(screen.getByTestId("quest-action-menu-task-scheduled-1")).toHaveStyle({
      "--companion-frosted-primary": "155 64% 55%",
    });

    openDropdownMenu(screen.getByLabelText("Sort tasks"));

    await waitFor(() => {
      expect(screen.getByText("Custom")).toBeInTheDocument();
    });

    expect(screen.getByTestId("quest-sort-menu")).toHaveClass("companion-frosted-planner-dark");
    expect(screen.getByTestId("quest-sort-menu")).toHaveStyle({
      "--companion-frosted-primary": "155 64% 55%",
    });
    expect(screen.getByText("Time")).toBeInTheDocument();
    expect(screen.getByText("Priority")).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: "XP" })).toBeInTheDocument();
  });

  it("shows the row action trigger when move-to-tomorrow is available", () => {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });
    const onMoveQuestToNextDay = vi.fn();

    render(
      <TodaysAgenda
        tasks={[
          {
            id: "task-scheduled-1",
            task_text: "Morning focus",
            completed: false,
            xp_reward: 25,
            scheduled_time: "08:00",
          },
        ]}
        selectedDate={new Date("2026-02-13T09:00:00.000Z")}
        onToggle={vi.fn()}
        onAddQuest={vi.fn()}
        completedCount={0}
        totalCount={1}
        onMoveQuestToNextDay={onMoveQuestToNextDay}
      />,
      { wrapper: createWrapper(queryClient) },
    );

    expect(screen.getByLabelText("Quest actions")).toBeInTheDocument();
    expect(onMoveQuestToNextDay).not.toHaveBeenCalled();
  });

  it("opens desktop quest details on single click and edits on double click", async () => {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });
    const onEditQuest = vi.fn();
    const companionFrostedThemeStyle = {
      "--companion-frosted-primary": "42 74% 58%",
    } as CSSProperties;

    render(
      <TodaysAgenda
        tasks={[
          {
            id: "task-scheduled-1",
            task_text: "Morning focus",
            completed: false,
            xp_reward: 25,
            scheduled_time: "08:00",
          },
        ]}
        selectedDate={new Date("2026-02-13T09:00:00.000Z")}
        layoutMode="desktop"
        onToggle={vi.fn()}
        onAddQuest={vi.fn()}
        completedCount={0}
        totalCount={1}
        onEditQuest={onEditQuest}
        companionFrostedThemeStyle={companionFrostedThemeStyle}
      />,
      { wrapper: createWrapper(queryClient) },
    );

    fireEvent.click(screen.getByTestId("desktop-timeline-task-button-task-scheduled-1"));

    await waitFor(() => {
      expect(screen.getByTestId("desktop-quest-popover-task-scheduled-1")).toBeInTheDocument();
    });

    const popoverContent = screen.getByTestId("desktop-quest-popover-content-task-scheduled-1");
    expect(popoverContent).toHaveClass("companion-frosted-theme-scope");
    expect(popoverContent).toHaveStyle({
      "--companion-frosted-primary": "42 74% 58%",
    });

    expect(
      getQuestCardShell(screen.getByTestId("timeline-row-task-scheduled-1")),
    ).toHaveClass("journeys-quest-card-shell", "journeys-quest-card-shell--active");

    fireEvent.doubleClick(screen.getByTestId("desktop-timeline-task-button-task-scheduled-1"));

    expect(onEditQuest).toHaveBeenCalledWith(expect.objectContaining({ id: "task-scheduled-1" }));
  });

  it("adds the readable shell class to desktop day cards when readable quest cards are enabled", () => {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });

    render(
      <TodaysAgenda
        tasks={[
          {
            id: "task-readable-desktop-1",
            task_text: "Desktop readable focus",
            completed: false,
            xp_reward: 25,
            scheduled_time: "08:00",
          },
        ]}
        selectedDate={new Date("2026-02-13T09:00:00.000Z")}
        layoutMode="desktop"
        readableQuestCardsEnabled
        onToggle={vi.fn()}
        onAddQuest={vi.fn()}
        completedCount={0}
        totalCount={1}
      />,
      { wrapper: createWrapper(queryClient) },
    );

    const readableShell = getQuestCardShell(screen.getByTestId("timeline-row-task-readable-desktop-1"));
    expect(readableShell).toHaveClass(
      "journeys-quest-card-shell",
      "journeys-quest-card-shell--readable",
    );
    expect(readableShell).not.toHaveClass("border-white/10");
    expect(readableShell).not.toHaveClass("bg-white/[0.04]");
  });

  it("keeps readable campaign desktop day cards on the readable shell treatment when active", async () => {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });

    render(
      <TodaysAgenda
        tasks={[
          {
            id: "task-readable-campaign-desktop-1",
            task_text: "Campaign readable focus",
            completed: false,
            xp_reward: 25,
            scheduled_time: "08:00",
            habit_source_id: "habit-1",
            epic_id: "epic-1",
            epic_title: "Build Portfolio Website",
          },
        ]}
        selectedDate={new Date("2026-02-13T09:00:00.000Z")}
        layoutMode="desktop"
        readableQuestCardsEnabled
        onToggle={vi.fn()}
        onAddQuest={vi.fn()}
        completedCount={0}
        totalCount={1}
      />,
      { wrapper: createWrapper(queryClient) },
    );

    const readableShell = getQuestCardShell(screen.getByTestId("timeline-row-task-readable-campaign-desktop-1"));
    expect(readableShell).toHaveClass(
      "campaign-ritual-card",
      "journeys-quest-card-shell--readable",
    );
    expect(readableShell).not.toHaveClass("border-primary/35");
    expect(readableShell).not.toHaveClass("bg-primary/[0.08]");
    expect(readableShell).not.toHaveClass("border-white/10");
    expect(readableShell).not.toHaveClass("bg-white/[0.04]");

    fireEvent.click(screen.getByTestId("desktop-timeline-task-button-task-readable-campaign-desktop-1"));

    await waitFor(() => {
      expect(screen.getByTestId("desktop-quest-popover-task-readable-campaign-desktop-1")).toBeInTheDocument();
    });

    expect(readableShell).toHaveClass("journeys-quest-card-shell--active");
    expect(readableShell).not.toHaveClass("border-primary/40");
    expect(readableShell).not.toHaveClass("bg-primary/[0.08]");
  });

  it("does not wire desktop scheduled rows for drag", () => {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });

    render(
      <TodaysAgenda
        tasks={[
          {
            id: "task-scheduled-1",
            task_text: "Morning focus",
            completed: false,
            xp_reward: 25,
            scheduled_time: "08:00",
          },
        ]}
        selectedDate={new Date("2026-02-13T09:00:00.000Z")}
        layoutMode="desktop"
        onToggle={vi.fn()}
        onAddQuest={vi.fn()}
        completedCount={0}
        totalCount={1}
      />,
      { wrapper: createWrapper(queryClient) },
    );

    expect(mocks.getRowDragPropsMock).not.toHaveBeenCalled();
  });

  it("renders a full 24-hour half-hour grid", () => {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });

    render(
      <TodaysAgenda
        tasks={[]}
        selectedDate={new Date("2000-01-01T09:00:00.000Z")}
        onToggle={vi.fn()}
        onAddQuest={vi.fn()}
        completedCount={0}
        totalCount={0}
      />,
      { wrapper: createWrapper(queryClient) },
    );

    const slotMinutes = getRenderedGridSlotMinutes();
    expect(slotMinutes).toHaveLength(48);
    expect(slotMinutes[0]).toBe(0);
    expect(slotMinutes.at(-1)).toBe(23 * 60 + 30);
    expect(screen.getByTestId("journeys-day-grid")).toHaveStyle({ height: "1728px" });
    expect(screen.getByText("No tasks for this day")).toBeInTheDocument();
  });

  it("positions timed quests by scheduled minute and duration", () => {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });

    render(
      <TodaysAgenda
        tasks={[
          {
            id: "task-scheduled-1",
            task_text: "Early focus",
            completed: false,
            xp_reward: 25,
            scheduled_time: "01:30",
            estimated_duration: 60,
          },
        ]}
        selectedDate={new Date("2000-01-01T09:00:00.000Z")}
        onToggle={vi.fn()}
        onAddQuest={vi.fn()}
        completedCount={0}
        totalCount={1}
      />,
      { wrapper: createWrapper(queryClient) },
    );

    const wrapper = getTimelineRowWrapper("task-scheduled-1");
    expect(Number(wrapper.getAttribute("data-start-minute"))).toBe(minuteFromTime("01:30"));
    expect(Number(wrapper.getAttribute("data-top-px"))).toBeCloseTo(108);
    expect(Number(wrapper.getAttribute("data-duration-height-px"))).toBeCloseTo(72);
    expect(wrapper).toHaveStyle({ top: "108px", height: "72px" });
  });

  it("clips 30-minute scheduled quest cards while opening details in a drawer", async () => {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });

    render(
      <TodaysAgenda
        tasks={[
          {
            id: "task-scheduled-1",
            task_text: "Half-hour focus",
            completed: false,
            xp_reward: 25,
            scheduled_time: "09:00",
            estimated_duration: 30,
            subtasks: [
              {
                id: "subtask-compact-1",
                title: "Do not expand inside the grid",
                completed: false,
                sort_order: 0,
              },
            ],
          },
        ]}
        selectedDate={new Date("2000-01-01T09:00:00.000Z")}
        onToggle={vi.fn()}
        onAddQuest={vi.fn()}
        completedCount={0}
        totalCount={1}
      />,
      { wrapper: createWrapper(queryClient) },
    );

    const wrapper = getTimelineRowWrapper("task-scheduled-1");
    const row = screen.getByTestId("timeline-row-task-scheduled-1");
    const shell = getQuestCardShell(row);

    expect(Number(wrapper.getAttribute("data-duration-height-px"))).toBeCloseTo(52);
    expect(wrapper).toHaveStyle({ height: "52px" });
    expect(row).toHaveStyle({ overflow: "hidden" });
    expect(row).toHaveAttribute("data-timeline-compact", "true");
    expect(shell).toHaveAttribute("data-compact-timeline-card", "true");
    const detailToggle = within(row).getByTestId("mobile-quest-detail-toggle-task-scheduled-1");
    expect(detailToggle).toHaveAttribute("data-interactive", "true");
    expect(detailToggle).toHaveAttribute("data-tap-control", "true");

    fireEvent.click(detailToggle);

    expect(await screen.findByTestId("mobile-scheduled-quest-detail-drawer-task-scheduled-1")).toBeInTheDocument();
    expect(screen.getByText("Do not expand inside the grid")).toBeInTheDocument();
    expect(wrapper).toHaveStyle({ height: "52px" });
    expect(row).toHaveStyle({ overflow: "hidden" });
  });

  it("keeps compact 30-minute ritual rows dense while retaining essentials", () => {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });

    render(
      <TodaysAgenda
        tasks={[
          {
            id: "ritual-compact-1",
            task_text: "Daily ritual",
            completed: false,
            xp_reward: 20,
            scheduled_time: "07:00",
            estimated_duration: 30,
            habit_source_id: "habit-compact-1",
            epic_id: "epic-compact-1",
            epic_title: "Compact Campaign",
          },
        ]}
        selectedDate={new Date("2000-01-01T09:00:00.000Z")}
        onToggle={vi.fn()}
        onAddQuest={vi.fn()}
        onEditQuest={vi.fn()}
        completedCount={0}
        totalCount={1}
      />,
      { wrapper: createWrapper(queryClient) },
    );

    const row = screen.getByTestId("timeline-row-ritual-compact-1");

    expect(within(row).getByText("Daily ritual")).toBeInTheDocument();
    expect(within(row).getByText("7:00 AM")).toBeInTheDocument();
    expect(within(row).getByText("+20")).toBeInTheDocument();
    expect(within(row).getByRole("button", { name: "Quest actions" })).toBeInTheDocument();
    expect(within(row).queryByText("Campaign Ritual - Compact Campaign")).not.toBeInTheDocument();
  });

  it("keeps 60-minute scheduled quest rows non-compact", () => {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });

    render(
      <TodaysAgenda
        tasks={[
          {
            id: "task-scheduled-60",
            task_text: "Full hour focus",
            completed: false,
            xp_reward: 25,
            scheduled_time: "10:00",
            estimated_duration: 60,
          },
        ]}
        selectedDate={new Date("2000-01-01T09:00:00.000Z")}
        onToggle={vi.fn()}
        onAddQuest={vi.fn()}
        completedCount={0}
        totalCount={1}
      />,
      { wrapper: createWrapper(queryClient) },
    );

    const wrapper = getTimelineRowWrapper("task-scheduled-60");
    const row = screen.getByTestId("timeline-row-task-scheduled-60");
    const shell = getQuestCardShell(row);

    expect(Number(wrapper.getAttribute("data-duration-height-px"))).toBeCloseTo(72);
    expect(wrapper).toHaveStyle({ height: "72px" });
    expect(row.style.overflow).toBe("");
    expect(row).not.toHaveAttribute("data-timeline-compact");
    expect(shell).not.toHaveAttribute("data-compact-timeline-card");
  });

  it("places overlapping timed quests into separate lanes", () => {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });

    render(
      <TodaysAgenda
        tasks={[
          {
            id: "task-scheduled-1",
            task_text: "Deep work",
            completed: false,
            xp_reward: 25,
            scheduled_time: "09:00",
            estimated_duration: 60,
          },
          {
            id: "task-scheduled-2",
            task_text: "Standup",
            completed: false,
            xp_reward: 15,
            scheduled_time: "09:30",
            estimated_duration: 30,
          },
        ]}
        selectedDate={new Date("2000-01-01T09:00:00.000Z")}
        onToggle={vi.fn()}
        onAddQuest={vi.fn()}
        completedCount={0}
        totalCount={2}
      />,
      { wrapper: createWrapper(queryClient) },
    );

    const firstWrapper = getTimelineRowWrapper("task-scheduled-1");
    const secondWrapper = getTimelineRowWrapper("task-scheduled-2");
    expect(firstWrapper).toHaveAttribute("data-timeline-lane", "0");
    expect(secondWrapper).toHaveAttribute("data-timeline-lane", "1");
    expect(firstWrapper).toHaveAttribute("data-timeline-lane-count", "2");
    expect(secondWrapper).toHaveAttribute("data-timeline-lane-count", "2");
    expect(firstWrapper.style.width).toContain("50%");
    expect(secondWrapper.style.left).toContain("50%");
  });

  it("keeps untimed quests out of the grid and exposes them in the drawer", async () => {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });
    const companionFrostedThemeStyle = {
      "--companion-frosted-primary": "42 74% 58%",
    } as CSSProperties;

    render(
      <TodaysAgenda
        tasks={[
          {
            id: "task-scheduled-1",
            task_text: "Timed focus",
            completed: false,
            xp_reward: 25,
            scheduled_time: "09:00",
          },
          {
            id: "task-unscheduled-1",
            task_text: "Anytime focus",
            completed: false,
            xp_reward: 15,
            scheduled_time: null,
          },
        ]}
        selectedDate={new Date("2000-01-01T09:00:00.000Z")}
        onToggle={vi.fn()}
        onAddQuest={vi.fn()}
        completedCount={0}
        totalCount={2}
        companionFrostedThemeStyle={companionFrostedThemeStyle}
      />,
      { wrapper: createWrapper(queryClient) },
    );

    expect(screen.getByTestId("timeline-row-task-scheduled-1")).toBeInTheDocument();
    expect(screen.queryByTestId("timeline-row-task-unscheduled-1")).not.toBeInTheDocument();

    const trigger = screen.getByTestId("untimed-quests-drawer-trigger");
    expect(trigger).toHaveTextContent("Untimed");
    expect(trigger).toHaveTextContent("1");

    fireEvent.click(trigger);

    const drawer = await screen.findByTestId("untimed-quests-drawer");
    expect(drawer).toBeInTheDocument();
    expect(drawer).toHaveClass("companion-frosted-planner-dark");
    expect(drawer).toHaveStyle({
      "--companion-frosted-primary": "42 74% 58%",
    });
    expect(screen.getByTestId("untimed-quest-task-unscheduled-1")).toHaveTextContent("Anytime focus");
  });

  it("renders the current-time marker only today and updates it each minute", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-02-14T16:34:00"));

    try {
      const queryClient = new QueryClient({
        defaultOptions: {
          queries: { retry: false },
          mutations: { retry: false },
        },
      });

      const { rerender } = render(
        <TodaysAgenda
          tasks={[
            {
              id: "task-scheduled-1",
              task_text: "Morning focus",
              completed: false,
              xp_reward: 25,
              scheduled_time: "08:00",
            },
          ]}
          selectedDate={new Date()}
          onToggle={vi.fn()}
          onAddQuest={vi.fn()}
          completedCount={0}
          totalCount={1}
        />,
        { wrapper: createWrapper(queryClient) },
      );

      expect(
        within(screen.getByTestId("timeline-marker-now")).getByTestId("timeline-row-time"),
      ).toHaveTextContent("16:34");

      act(() => {
        vi.advanceTimersByTime(60_000);
      });

      expect(
        within(screen.getByTestId("timeline-marker-now")).getByTestId("timeline-row-time"),
      ).toHaveTextContent("16:35");

      rerender(
        <TodaysAgenda
          tasks={[
            {
              id: "task-scheduled-1",
              task_text: "Morning focus",
              completed: false,
              xp_reward: 25,
              scheduled_time: "08:00",
            },
          ]}
          selectedDate={new Date("2000-01-01T09:00:00.000Z")}
          onToggle={vi.fn()}
          onAddQuest={vi.fn()}
          completedCount={0}
          totalCount={1}
        />,
      );

      expect(screen.queryByTestId("timeline-marker-now")).not.toBeInTheDocument();
      expect(screen.queryByTestId("timeline-now-pill")).not.toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });

  it("auto-centers the pane on today and recenters when centerNowRequestKey changes", async () => {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });

    const { rerender } = render(
      <TodaysAgenda
        tasks={[
          {
            id: "task-scheduled-1",
            task_text: "Morning focus",
            completed: false,
            xp_reward: 25,
            scheduled_time: "08:00",
          },
        ]}
        selectedDate={new Date()}
        centerNowRequestKey={0}
        onToggle={vi.fn()}
        onAddQuest={vi.fn()}
        completedCount={0}
        totalCount={1}
      />,
      { wrapper: createWrapper(queryClient) },
    );

    await waitFor(() => {
      expect(elementScrollToSpy).toHaveBeenCalled();
    });

    elementScrollToSpy.mockClear();
    rerender(
      <TodaysAgenda
        tasks={[
          {
            id: "task-scheduled-1",
            task_text: "Morning focus",
            completed: false,
            xp_reward: 25,
            scheduled_time: "08:00",
          },
        ]}
        selectedDate={new Date()}
        centerNowRequestKey={1}
        onToggle={vi.fn()}
        onAddQuest={vi.fn()}
        completedCount={0}
        totalCount={1}
      />,
    );

    await waitFor(() => {
      expect(elementScrollToSpy).toHaveBeenCalled();
    });
  });

  it("does not recenter for centerNowRequestKey changes on non-today dates", async () => {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });

    const { rerender } = render(
      <TodaysAgenda
        tasks={[
          {
            id: "task-scheduled-1",
            task_text: "Morning focus",
            completed: false,
            xp_reward: 25,
            scheduled_time: "08:00",
          },
        ]}
        selectedDate={new Date("2000-01-01T09:00:00.000Z")}
        centerNowRequestKey={0}
        onToggle={vi.fn()}
        onAddQuest={vi.fn()}
        completedCount={0}
        totalCount={1}
      />,
      { wrapper: createWrapper(queryClient) },
    );

    await waitFor(() => {
      expect(screen.getByTestId("journeys-day-grid")).toBeInTheDocument();
    });

    elementScrollToSpy.mockClear();
    windowScrollToSpy.mockClear();
    rerender(
      <TodaysAgenda
        tasks={[
          {
            id: "task-scheduled-1",
            task_text: "Morning focus",
            completed: false,
            xp_reward: 25,
            scheduled_time: "08:00",
          },
        ]}
        selectedDate={new Date("2000-01-01T09:00:00.000Z")}
        centerNowRequestKey={1}
        onToggle={vi.fn()}
        onAddQuest={vi.fn()}
        completedCount={0}
        totalCount={1}
      />,
    );

    await Promise.resolve();

    expect(elementScrollToSpy).not.toHaveBeenCalled();
    expect(windowScrollToSpy).not.toHaveBeenCalled();
  });
});

describe("TodaysAgenda external calendar overlay", () => {
  it("renders connected calendar events as read-only agenda items and refreshes them", () => {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });
    const onRefresh = vi.fn();
    const onManageCalendars = vi.fn();
    const onDateSelect = vi.fn();

    render(
      <TodaysAgenda
        tasks={[]}
        externalEvents={[
          {
            id: "meeting-1",
            provider: "google",
            title: "Project review",
            taskDate: "2026-02-13",
            scheduledTime: "10:00",
            estimatedDuration: 45,
            isAllDay: false,
            startDate: "2026-02-13T18:00:00.000Z",
            endDate: "2026-02-13T18:45:00.000Z",
            location: null,
            calendarId: "primary",
            calendarName: "Work",
            htmlLink: "https://calendar.google.com/event?eid=1",
          },
          {
            id: "holiday-1",
            provider: "outlook",
            title: "Holiday",
            taskDate: "2026-02-13",
            scheduledTime: null,
            estimatedDuration: 1440,
            isAllDay: true,
            startDate: "2026-02-13",
            endDate: "2026-02-14",
            location: null,
            calendarId: "work",
            calendarName: "Company",
            htmlLink: null,
          },
        ]}
        connectedCalendarCount={2}
        onRefreshExternalCalendars={onRefresh}
        onManageCalendars={onManageCalendars}
        selectedDate={new Date("2026-02-13T09:00:00.000Z")}
        onDateSelect={onDateSelect}
        onToggle={vi.fn()}
        onAddQuest={vi.fn()}
        completedCount={0}
        totalCount={0}
      />,
      { wrapper: createWrapper(queryClient) },
    );

    expect(screen.getByTestId("external-calendar-event-external:google:meeting-1")).toHaveTextContent(
      "Project review",
    );
    expect(screen.getByTestId("external-calendar-all-day-events")).toHaveTextContent("Holiday");
    expect(screen.queryByTestId("empty-state-pane")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Refresh external calendars" }));
    expect(onRefresh).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole("button", { name: "2 connected" }));
    expect(onManageCalendars).toHaveBeenCalledTimes(1);
  });
});
