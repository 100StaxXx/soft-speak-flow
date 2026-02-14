import type { ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const subtaskEqMock = vi.fn();
  const subtaskUpdateMock = vi.fn();
  const handlePointerDownSpy = vi.fn();
  const handleTouchStartSpy = vi.fn();
  const rowPointerDownSpy = vi.fn();
  const rowTouchStartSpy = vi.fn();
  const getDragHandlePropsMock = vi.fn(() => ({
    onPointerDown: handlePointerDownSpy,
    onTouchStart: handleTouchStartSpy,
  }));
  const getRowDragPropsMock = vi.fn(() => ({
    onPointerDown: rowPointerDownSpy,
    onTouchStart: rowTouchStartSpy,
  }));
  const swipeableDisabledStates: Array<boolean | undefined> = [];
  const timelineDragState = {
    draggingTaskId: null as string | null,
    isDragging: false,
    justDroppedId: null as string | null,
    dragOffsetY: 0,
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
    handlePointerDownSpy,
    handleTouchStartSpy,
    rowPointerDownSpy,
    rowTouchStartSpy,
    getDragHandlePropsMock,
    getRowDragPropsMock,
    swipeableDisabledStates,
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
    durationMinutes,
    laneIndex,
    laneCount,
    overlapCount,
    label: _label,
    showLine: _showLine,
    isLast: _isLast,
    isDragTarget: _isDragTarget,
    ...props
  }: {
    children: ReactNode;
    overrideTime?: string | null;
    time?: string | null;
    durationMinutes?: number | null;
    laneIndex?: number;
    laneCount?: number;
    overlapCount?: number;
    label?: string | null;
    showLine?: boolean;
    isLast?: boolean;
    isDragTarget?: boolean;
  } & Record<string, unknown>) => (
    <div
      data-testid="timeline-row"
      data-timeline-lane={laneIndex}
      data-timeline-lane-count={laneCount}
      data-timeline-overlap={overlapCount}
      {...props}
    >
      {overrideTime ? <span>{overrideTime}</span> : null}
      {time ? (
        <div
          data-testid="timeline-duration-indicator"
          data-duration-minutes={durationMinutes ?? 30}
        />
      ) : null}
      {children}
    </div>
  ),
}));

vi.mock("./SwipeableTaskItem", () => ({
  SwipeableTaskItem: ({
    children,
    disabled,
  }: {
    children: ReactNode;
    disabled?: boolean;
  }) => {
    mocks.swipeableDisabledStates.push(disabled);
    return <>{children}</>;
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

describe("TodaysAgenda subtasks", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.swipeableDisabledStates.length = 0;
    mocks.timelineDragState.draggingTaskId = null;
    mocks.timelineDragState.isDragging = false;
    mocks.timelineDragState.justDroppedId = null;
    mocks.timelineDragState.dragOffsetY = 0;
    mocks.timelineDragState.previewTime = undefined;
    mocks.timelineDragState.snapMode = "coarse";
    mocks.timelineDragState.zoomRail = null;
    mocks.handlePointerDownSpy.mockClear();
    mocks.handleTouchStartSpy.mockClear();
    mocks.rowPointerDownSpy.mockClear();
    mocks.rowTouchStartSpy.mockClear();
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
          { id: "task-1", task_text: "Task One", completed: false, xp_reward: 10, scheduled_time: null },
          { id: "task-2", task_text: "Task Two", completed: false, xp_reward: 10, scheduled_time: null },
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
          { id: "task-1", task_text: "Task One", completed: false, xp_reward: 10, scheduled_time: null },
          { id: "task-2", task_text: "Task Two", completed: false, xp_reward: 10, scheduled_time: null },
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
          { id: "task-1", task_text: "Task One", completed: false, xp_reward: 10, scheduled_time: null },
          { id: "task-2", task_text: "Task Two", completed: false, xp_reward: 10, scheduled_time: null },
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
    mocks.timelineDragState.isDragging = false;
    mocks.timelineDragState.justDroppedId = null;
    mocks.timelineDragState.dragOffsetY = 0;
    mocks.timelineDragState.previewTime = undefined;
    mocks.timelineDragState.snapMode = "coarse";
    mocks.timelineDragState.zoomRail = null;
    mocks.handlePointerDownSpy.mockClear();
    mocks.handleTouchStartSpy.mockClear();
    mocks.rowPointerDownSpy.mockClear();
    mocks.rowTouchStartSpy.mockClear();
    mocks.getDragHandlePropsMock.mockClear();
    mocks.getRowDragPropsMock.mockClear();
    mocks.swipeableDisabledStates.length = 0;
  });

  it("shows scheduled header without a dedicated drag-handle button", () => {
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

    expect(screen.getByText("Scheduled")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /drag to reschedule/i })).not.toBeInTheDocument();
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

  it("forwards pointer down from timeline row to drag handler", () => {
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

    expect(mocks.rowPointerDownSpy).toHaveBeenCalledTimes(1);
  });

  it("forwards touch start from timeline row to drag handler", () => {
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

  it("reorders scheduled rows based on drag preview time", () => {
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
      "timeline-row-task-scheduled-2",
      "timeline-row-task-scheduled-1",
    ]);
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

  it("shows duration rail with explicit and fallback durations", () => {
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

    const explicitDuration = within(screen.getByTestId("timeline-row-task-scheduled-1"))
      .getByTestId("timeline-duration-indicator");
    const fallbackDuration = within(screen.getByTestId("timeline-row-task-scheduled-2"))
      .getByTestId("timeline-duration-indicator");

    expect(explicitDuration).toHaveAttribute("data-duration-minutes", "45");
    expect(fallbackDuration).toHaveAttribute("data-duration-minutes", "30");
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

    expect(screen.getByText("09:45")).toBeInTheDocument();
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

  it("keeps swipe enabled when not dragging and disables it for the active dragged row", () => {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });
    mocks.timelineDragState.draggingTaskId = null;
    mocks.timelineDragState.isDragging = false;
    mocks.timelineDragState.previewTime = undefined;
    mocks.swipeableDisabledStates.length = 0;

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

    expect(mocks.swipeableDisabledStates.at(-1)).toBe(false);

    mocks.swipeableDisabledStates.length = 0;
    mocks.timelineDragState.draggingTaskId = "task-scheduled-1";
    mocks.timelineDragState.isDragging = true;

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

    expect(mocks.swipeableDisabledStates.at(-1)).toBe(true);
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

  it("renders six-hour timeline placeholders including end-of-day marker", () => {
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

    expect(screen.getByTestId("timeline-marker-placeholder-0000")).toBeInTheDocument();
    expect(screen.getByTestId("timeline-marker-placeholder-0600")).toBeInTheDocument();
    expect(screen.getByTestId("timeline-marker-placeholder-1200")).toBeInTheDocument();
    expect(screen.getByTestId("timeline-marker-placeholder-1800")).toBeInTheDocument();
    expect(screen.getByTestId("timeline-marker-placeholder-2359")).toBeInTheDocument();
  });

  it("shows a subtle now marker only on today", () => {
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
  });
});
