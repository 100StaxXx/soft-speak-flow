import type { ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const windowScrollToSpy = vi.spyOn(window, "scrollTo").mockImplementation(() => undefined);
if (!HTMLElement.prototype.scrollTo) {
  Object.defineProperty(HTMLElement.prototype, "scrollTo", {
    value: () => undefined,
    configurable: true,
    writable: true,
  });
}
const elementScrollToSpy = vi.spyOn(HTMLElement.prototype, "scrollTo").mockImplementation(() => undefined);

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
    dragOffsetMotionValue,
    dragEdgeMotionValue,
    timelineDragState,
  };
});

vi.mock("@/hooks/useProfile", () => ({
  useProfile: () => ({
    profile: { completed_tasks_stay_in_place: true },
  }),
}));

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
  useTimelineDrag: () => ({
    ...mocks.timelineDragState,
    nudgeByFineStep: mocks.nudgeByFineStepMock,
    getDragHandleProps: mocks.getDragHandlePropsMock,
    getRowDragProps: mocks.getRowDragPropsMock,
  }),
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
  JourneyPathDrawer: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

vi.mock("@/components/TimelineTaskRow", () => ({
  TimelineTaskRow: ({
    children,
    overrideTime,
    time,
    tone,
    durationMinutes: _durationMinutes,
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
    return (
      <div
        data-testid="timeline-row"
        data-timeline-lane={laneIndex}
        data-timeline-lane-count={laneCount}
        data-timeline-overlap={overlapCount}
        data-timeline-tone={tone}
        {...props}
      >
        {displayTime ? <span data-testid="timeline-row-time">{displayTime}</span> : null}
        {children}
      </div>
    );
  },
}));

vi.mock("@/components/ui/marquee-text", () => ({
  MarqueeText: ({ text, className }: { text: string; className?: string }) => (
    <span className={className}>{text}</span>
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

const getRenderedPlaceholderMinutes = (): number[] => {
  return Array.from(document.querySelectorAll<HTMLElement>('[data-testid^="timeline-marker-placeholder-"]'))
    .map((element) => element.getAttribute("data-testid"))
    .map((testId) => testId?.replace("timeline-marker-placeholder-", "") ?? null)
    .map((token) => {
      if (!token || !/^\d{4}$/.test(token)) return null;
      const hour = Number(token.slice(0, 2));
      const minute = Number(token.slice(2, 4));
      if (!Number.isFinite(hour) || !Number.isFinite(minute)) return null;
      return (hour * 60) + minute;
    })
    .filter((minute): minute is number => minute !== null)
    .sort((a, b) => a - b);
};

beforeEach(() => {
  windowScrollToSpy.mockClear();
  elementScrollToSpy.mockClear();
  document.documentElement.style.removeProperty("--bottom-nav-runtime-offset");
  document.documentElement.style.removeProperty("--bottom-nav-safe-offset");
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

  it("shows subtasks when expanded and persists subtask toggle", async () => {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });

    const { container } = render(
      <TodaysAgenda
        tasks={[
          {
            id: "task-1",
            task_text: "Launch campaign",
            completed: false,
            xp_reward: 50,
            scheduled_time: "09:00",
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

    const chevron = container.querySelector("svg.lucide-chevron-down");
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

describe("TodaysAgenda campaign visibility", () => {
  it("renders campaigns inside the scheduled timeline pane when scheduled rows exist", () => {
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
      />,
      { wrapper: createWrapper(queryClient) },
    );

    const scheduledPane = screen.getByTestId("scheduled-timeline-pane");
    expect(within(scheduledPane).getByText("Campaigns")).toBeInTheDocument();
    expect(within(scheduledPane).getByText("Fallback Campaign")).toBeInTheDocument();
    expect(screen.getAllByText("Campaigns")).toHaveLength(1);
  });

  it("renders campaign ritual groups collapsed by default and lets users toggle them", async () => {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });

    const { container } = render(
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
        activeEpics={[]}
      />,
      { wrapper: createWrapper(queryClient) },
    );

    expect(screen.getByText("Campaigns")).toBeInTheDocument();
    expect(screen.getByText("Fallback Campaign")).toBeInTheDocument();
    expect(screen.queryByText("Morning journal")).not.toBeInTheDocument();

    const expandChevron = container.querySelector("svg.lucide-chevron-down");
    expect(expandChevron).toBeTruthy();
    const expandButton = expandChevron?.closest("button");
    expect(expandButton).toBeTruthy();

    fireEvent.click(expandButton!);
    expect(await screen.findByText("Morning journal")).toBeInTheDocument();

    const collapseChevron = container.querySelector("svg.lucide-chevron-up");
    expect(collapseChevron).toBeTruthy();
    const collapseButton = collapseChevron?.closest("button");
    expect(collapseButton).toBeTruthy();

    fireEvent.click(collapseButton!);
    await waitFor(() => {
      expect(screen.queryByText("Morning journal")).not.toBeInTheDocument();
    });
  });

  it("keeps newly added campaign groups collapsed by default", () => {
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

    expect(screen.queryByText("Morning journal")).not.toBeInTheDocument();

    view.rerender(
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
          {
            id: "ritual-2",
            task_text: "Evening stretch",
            completed: false,
            xp_reward: 12,
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
    expect(screen.queryByText("Morning journal")).not.toBeInTheDocument();
    expect(screen.queryByText("Evening stretch")).not.toBeInTheDocument();
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

    expect(screen.queryByText("Campaigns")).not.toBeInTheDocument();
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

    const { container } = render(
      <TodaysAgenda
        tasks={[
          {
            id: "task-1",
            task_text: "Review budget",
            completed: false,
            xp_reward: 25,
            scheduled_time: "10:00",
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

    const chevron = container.querySelector("svg.lucide-chevron-down");
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

    const { container } = render(
      <TodaysAgenda
        tasks={[
          {
            id: "task-legacy",
            task_text: "Legacy image quest",
            completed: false,
            xp_reward: 12,
            scheduled_time: "11:00",
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

    const chevron = container.querySelector("svg.lucide-chevron-down");
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

    await waitFor(() => {
      expect(screen.queryByTestId("combo-banner")).not.toBeInTheDocument();
    });

    fireEvent.click(screen.getAllByRole("checkbox", { name: /mark task as complete/i })[0]);
    expect(screen.queryByTestId("combo-banner")).not.toBeInTheDocument();
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
      expect(scheduledPane).toHaveClass("overflow-y-auto", "overflow-x-hidden");
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
      expect(scheduledPane).toHaveClass("overflow-y-auto", "overflow-x-hidden");
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

    let emptyStateRectSpy: ReturnType<typeof vi.spyOn> | null = null;
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
      emptyStateRectSpy = vi
        .spyOn(emptyStatePane, "getBoundingClientRect")
        .mockReturnValue(createDomRect({ top: 280, bottom: 520, left: 0, right: 800, width: 800, height: 240 }));

      act(() => {
        window.dispatchEvent(new Event("resize"));
      });

      await waitFor(() => {
        expect(emptyStatePane.style.minHeight).toBe("480px");
      });
      expect(emptyStatePane.style.height).toBe("");
    } finally {
      emptyStateRectSpy?.mockRestore();
      restoreViewport();
    }
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
    expect(within(pane).getByTestId("timeline-row-task-scheduled-1")).toBeInTheDocument();
    expect(screen.queryByTestId("timeline-row-task-unscheduled-1")).not.toBeInTheDocument();
    expect(screen.queryByText("Anytime focus")).not.toBeInTheDocument();
    expect(screen.queryByText("Anytime")).not.toBeInTheDocument();
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

  it("forwards row pointer down to row drag handler", () => {
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

    expect(mocks.rowPointerDownCaptureSpy).toHaveBeenCalledTimes(1);
    expect(mocks.rowPointerDownSpy).toHaveBeenCalledTimes(1);
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

  it("does not forward row pointer and touch starts to handle-only drag handlers", () => {
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

    expect(mocks.rowPointerDownCaptureSpy).toHaveBeenCalledTimes(1);
    expect(mocks.rowPointerDownSpy).toHaveBeenCalledTimes(1);
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
    expect(mocks.nudgeByFineStepMock.mock.calls.every(([direction]) => direction === -1)).toBe(true);

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
    expect(mocks.nudgeByFineStepMock.mock.calls.every(([direction]) => direction === 1)).toBe(true);

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
      expect(mocks.nudgeByFineStepMock.mock.calls.every(([direction]) => direction === 1)).toBe(true);
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

  it("emits drag preview time updates and resets when drag ends", () => {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });
    const onTimelineDragPreviewTimeChange = vi.fn();

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
        onTimelineDragPreviewTimeChange={onTimelineDragPreviewTimeChange}
      />,
      { wrapper: createWrapper(queryClient) },
    );

    mocks.timelineDragState.draggingTaskId = "task-scheduled-1";
    mocks.timelineDragState.isDragging = true;
    mocks.timelineDragState.previewTime = "10:15";

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
        onTimelineDragPreviewTimeChange={onTimelineDragPreviewTimeChange}
      />,
    );

    expect(onTimelineDragPreviewTimeChange).toHaveBeenCalledWith("10:15");

    mocks.timelineDragState.draggingTaskId = null;
    mocks.timelineDragState.isDragging = false;
    mocks.timelineDragState.previewTime = undefined;

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
        onTimelineDragPreviewTimeChange={onTimelineDragPreviewTimeChange}
      />,
    );

    expect(onTimelineDragPreviewTimeChange).toHaveBeenCalledWith(null);
  });

  it("renders minimal 3-hour placeholders outside scheduled quest times", () => {
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
            scheduled_time: "10:30",
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

    expect(screen.getByTestId("timeline-marker-placeholder-1200")).toBeInTheDocument();
    expect(screen.queryByTestId("timeline-marker-placeholder-0600")).not.toBeInTheDocument();
    expect(screen.queryByTestId("timeline-marker-placeholder-0900")).not.toBeInTheDocument();
    expect(screen.queryByTestId("timeline-marker-placeholder-1330")).not.toBeInTheDocument();
    expect(screen.queryByTestId("timeline-marker-placeholder-0000")).not.toBeInTheDocument();
    expect(screen.queryByTestId("timeline-marker-placeholder-1800")).not.toBeInTheDocument();
    expect(screen.queryByTestId("timeline-marker-placeholder-2359")).not.toBeInTheDocument();
  });

  it("uses outside anchors when a quest is exactly on a 3-hour boundary", () => {
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
            task_text: "Boundary quest",
            completed: false,
            xp_reward: 20,
            scheduled_time: "09:00",
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

    expect(screen.getByTestId("timeline-marker-placeholder-1200")).toBeInTheDocument();
    expect(screen.queryByTestId("timeline-marker-placeholder-0600")).not.toBeInTheDocument();
    expect(screen.queryByTestId("timeline-marker-placeholder-0900")).not.toBeInTheDocument();
  });

  it("does not render placeholders at or before the first scheduled quest", () => {
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
            scheduled_time: "10:30",
          },
          {
            id: "task-scheduled-2",
            task_text: "Review",
            completed: false,
            xp_reward: 25,
            scheduled_time: "16:30",
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

    const firstQuestMinute = minuteFromTime("10:30");
    const placeholderMinutes = getRenderedPlaceholderMinutes();
    expect(placeholderMinutes.every((minute) => minute > firstQuestMinute)).toBe(true);
  });

  it("renders exactly one placeholder between far-apart consecutive scheduled quests", () => {
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
            scheduled_time: "10:30",
          },
          {
            id: "task-scheduled-2",
            task_text: "Review",
            completed: false,
            xp_reward: 25,
            scheduled_time: "16:30",
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

    const betweenPlaceholders = getRenderedPlaceholderMinutes().filter((minute) => (
      minute > minuteFromTime("10:30") && minute < minuteFromTime("16:30")
    ));
    expect(betweenPlaceholders).toEqual([minuteFromTime("13:00")]);
    expect(screen.queryByTestId("timeline-marker-placeholder-1400")).not.toBeInTheDocument();
    expect(screen.queryByTestId("timeline-marker-placeholder-1500")).not.toBeInTheDocument();
  });

  it("centers between-quest placeholder marker timestamps between neighboring quests", () => {
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
            scheduled_time: "10:30",
          },
          {
            id: "task-scheduled-2",
            task_text: "Review",
            completed: false,
            xp_reward: 25,
            scheduled_time: "16:30",
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

    const betweenQuestMarker = screen.getByTestId("timeline-marker-placeholder-1300");
    const markerInnerWrapper = betweenQuestMarker.firstElementChild as HTMLElement | null;
    expect(betweenQuestMarker).toHaveClass("h-0", "overflow-visible");
    expect(markerInnerWrapper?.style.transform).toContain("translateY(-50%)");
  });

  it("aligns all non-now placeholders to exact-hour timestamps", () => {
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
            scheduled_time: "10:30",
          },
          {
            id: "task-scheduled-2",
            task_text: "Review",
            completed: false,
            xp_reward: 25,
            scheduled_time: "16:30",
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

    const placeholderMinutes = getRenderedPlaceholderMinutes();
    expect(placeholderMinutes.length).toBeGreaterThan(0);
    expect(placeholderMinutes.every((minute) => minute % 60 === 0)).toBe(true);
  });

  it("uses a single hourly placeholder for medium gaps between consecutive quests", () => {
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
            task_text: "Planning",
            completed: false,
            xp_reward: 25,
            scheduled_time: "09:15",
          },
          {
            id: "task-scheduled-2",
            task_text: "Check-in",
            completed: false,
            xp_reward: 20,
            scheduled_time: "11:45",
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

    const betweenPlaceholders = getRenderedPlaceholderMinutes().filter((minute) => (
      minute > minuteFromTime("09:15") && minute < minuteFromTime("11:45")
    ));
    expect(betweenPlaceholders).toEqual([minuteFromTime("10:00")]);
    expect(screen.queryByTestId("timeline-marker-placeholder-1100")).not.toBeInTheDocument();
  });

  it("does not render between-quest placeholders for quests within the same hour", () => {
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
            task_text: "Prep",
            completed: false,
            xp_reward: 15,
            scheduled_time: "10:10",
          },
          {
            id: "task-scheduled-2",
            task_text: "Sync",
            completed: false,
            xp_reward: 15,
            scheduled_time: "10:50",
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

    const betweenPlaceholders = getRenderedPlaceholderMinutes().filter((minute) => (
      minute > minuteFromTime("10:10") && minute < minuteFromTime("10:50")
    ));
    expect(betweenPlaceholders).toHaveLength(0);
  });

  it("shows only the 6AM placeholder when no quests are scheduled", () => {
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
            id: "task-unscheduled-1",
            task_text: "Anytime focus",
            completed: false,
            xp_reward: 25,
            scheduled_time: null,
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

    expect(screen.getByTestId("timeline-marker-placeholder-0600")).toBeInTheDocument();
    expect(screen.queryByTestId("timeline-marker-placeholder-0900")).not.toBeInTheDocument();
    expect(screen.queryByTestId("timeline-marker-placeholder-1200")).not.toBeInTheDocument();
    expect(screen.queryByTestId("timeline-marker-now")).not.toBeInTheDocument();
  });

  it("adds around-now placeholders for today without scheduled quests", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-02-14T16:34:00"));

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
            id: "task-unscheduled-1",
            task_text: "Anytime focus",
            completed: false,
            xp_reward: 25,
            scheduled_time: null,
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

    expect(screen.getByTestId("timeline-marker-placeholder-0600")).toBeInTheDocument();
    expect(screen.getByTestId("timeline-marker-placeholder-1500")).toBeInTheDocument();
    expect(screen.getByTestId("timeline-marker-placeholder-1800")).toBeInTheDocument();
    expect(screen.getByTestId("timeline-marker-now")).toBeInTheDocument();
    expect(
      within(screen.getByTestId("timeline-marker-now")).getByTestId("timeline-row-time"),
    ).toHaveTextContent("16:34");
    expect(screen.queryByTestId("timeline-now-pill")).not.toBeInTheDocument();

    vi.useRealTimers();
  });

  it("suppresses around-now placeholders when scheduled quests exist today", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-02-14T16:34:00"));

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
    expect(screen.queryByTestId("timeline-marker-placeholder-1500")).not.toBeInTheDocument();
    expect(screen.queryByTestId("timeline-marker-placeholder-1800")).not.toBeInTheDocument();

    vi.useRealTimers();
  });

  it("keeps boundary now markers in normal flow while preserving timestamp visibility", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-02-14T16:34:00"));

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

    const nowMarker = screen.getByTestId("timeline-marker-now");
    const nowMarkerInner = nowMarker.firstElementChild as HTMLElement | null;
    expect(nowMarker).not.toHaveClass("h-0");
    expect(nowMarker).not.toHaveClass("overflow-visible");
    expect(nowMarkerInner?.style.transform).not.toContain("translateY(-50%)");
    expect(within(nowMarker).getByTestId("timeline-row-time")).toHaveTextContent("16:34");

    vi.useRealTimers();
  });

  it("uses now as the only marker between quests when now falls in that gap", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-02-14T13:20:00"));

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
            scheduled_time: "10:30",
          },
          {
            id: "task-scheduled-2",
            task_text: "Review",
            completed: false,
            xp_reward: 25,
            scheduled_time: "16:30",
          },
        ]}
        selectedDate={new Date()}
        onToggle={vi.fn()}
        onAddQuest={vi.fn()}
        completedCount={0}
        totalCount={2}
      />,
      { wrapper: createWrapper(queryClient) },
    );

    const nowMarker = screen.getByTestId("timeline-marker-now");
    const nowMarkerInner = nowMarker.firstElementChild as HTMLElement | null;
    expect(nowMarker).toBeInTheDocument();
    expect(nowMarker).toHaveClass("h-0", "overflow-visible");
    expect(nowMarkerInner?.style.transform).toContain("translateY(-50%)");
    expect(
      within(nowMarker).getByTestId("timeline-row-time"),
    ).toHaveTextContent("13:20");

    const betweenPlaceholders = getRenderedPlaceholderMinutes().filter((minute) => (
      minute > minuteFromTime("10:30") && minute < minuteFromTime("16:30")
    ));
    expect(betweenPlaceholders).toHaveLength(0);

    vi.useRealTimers();
  });

  it("keeps now marker at exact current minute before the first quest", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-02-14T07:12:00"));

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
            scheduled_time: "10:30",
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

    const nowMarker = screen.getByTestId("timeline-marker-now");
    const nowMarkerInner = nowMarker.firstElementChild as HTMLElement | null;
    expect(nowMarker).toBeInTheDocument();
    expect(nowMarker).not.toHaveClass("h-0");
    expect(nowMarkerInner?.style.transform).not.toContain("translateY(-50%)");
    expect(
      within(nowMarker).getByTestId("timeline-row-time"),
    ).toHaveTextContent("07:12");
    expect(screen.queryByTestId("timeline-marker-placeholder-0600")).not.toBeInTheDocument();
    expect(screen.queryByTestId("timeline-now-pill")).not.toBeInTheDocument();

    vi.useRealTimers();
  });

  it("does not render a separate now chip in the empty state", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-02-14T16:34:00"));

    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });

    render(
      <TodaysAgenda
        tasks={[]}
        selectedDate={new Date()}
        onToggle={vi.fn()}
        onAddQuest={vi.fn()}
        completedCount={0}
        totalCount={0}
      />,
      { wrapper: createWrapper(queryClient) },
    );

    expect(screen.getByText("No tasks for this day")).toBeInTheDocument();
    expect(screen.queryByTestId("timeline-marker-now")).not.toBeInTheDocument();
    expect(screen.queryByTestId("timeline-now-pill")).not.toBeInTheDocument();

    vi.useRealTimers();
  });

  it("updates now marker timestamp every minute on today", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-02-14T16:34:00"));

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

    expect(
      within(screen.getByTestId("timeline-marker-now")).getByTestId("timeline-row-time"),
    ).toHaveTextContent("16:34");

    act(() => {
      vi.advanceTimersByTime(60_000);
    });

    expect(
      within(screen.getByTestId("timeline-marker-now")).getByTestId("timeline-row-time"),
    ).toHaveTextContent("16:35");

    vi.useRealTimers();
  });

  it("shows now marker only on today", () => {
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

    expect(screen.getByTestId("timeline-marker-now")).toBeInTheDocument();
    expect(screen.queryByTestId("timeline-now-pill")).not.toBeInTheDocument();

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
  });
});
