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
  const subtaskEqMock = vi.fn();
  const subtaskUpdateMock = vi.fn();
  const handlePointerDownSpy = vi.fn();
  const handleTouchStartSpy = vi.fn();
  const rowPointerDownSpy = vi.fn();
  const rowTouchStartSpy = vi.fn();
  const nudgeByFineStepMock = vi.fn(() => true);
  const getDragHandlePropsMock = vi.fn(() => ({
    onPointerDown: handlePointerDownSpy,
    onTouchStart: handleTouchStartSpy,
  }));
  const getRowDragPropsMock = vi.fn(() => ({
    onPointerDown: rowPointerDownSpy,
    onTouchStart: rowTouchStartSpy,
  }));
  const timelineDragState = {
    draggingTaskId: null as string | null,
    isDragging: false,
    justDroppedId: null as string | null,
    dragOffsetY: dragOffsetMotionValue,
    dragVisualOffsetY: dragOffsetMotionValue,
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
    nudgeByFineStepMock,
    getDragHandlePropsMock,
    getRowDragPropsMock,
    dragOffsetMotionValue,
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
});

describe("TodaysAgenda subtasks", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.timelineDragState.draggingTaskId = null;
    mocks.timelineDragState.isDragging = false;
    mocks.timelineDragState.justDroppedId = null;
    mocks.dragOffsetMotionValue.set(0);
    mocks.timelineDragState.previewTime = undefined;
    mocks.timelineDragState.snapMode = "coarse";
    mocks.timelineDragState.zoomRail = null;
    mocks.handlePointerDownSpy.mockClear();
    mocks.handleTouchStartSpy.mockClear();
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
    mocks.timelineDragState.isDragging = false;
    mocks.timelineDragState.justDroppedId = null;
    mocks.dragOffsetMotionValue.set(0);
    mocks.timelineDragState.previewTime = undefined;
    mocks.timelineDragState.snapMode = "coarse";
    mocks.timelineDragState.zoomRail = null;
    mocks.handlePointerDownSpy.mockClear();
    mocks.handleTouchStartSpy.mockClear();
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

  it("renders timeline without scheduled category header text", () => {
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
    expect(screen.getByTestId("scheduled-timeline-pane")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /drag to reschedule/i })).not.toBeInTheDocument();
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

  it("accelerates top edge-hold cadence as overshoot increases", () => {
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

    act(() => {
      vi.advanceTimersByTime(220);
    });
    expect(screen.getByTestId("timeline-drag-overlay")).toBeInTheDocument();
    const edgeHoldDelaysAfterActivation = setIntervalSpy.mock.calls
      .map(([, delay]) => delay)
      .filter((delay): delay is number => typeof delay === "number" && delay < 1000);
    expect(edgeHoldDelaysAfterActivation).toContain(180);

    const callsBeforeMediumTier = mocks.nudgeByFineStepMock.mock.calls.length;
    act(() => {
      mocks.dragOffsetMotionValue.set(-40);
      vi.advanceTimersByTime(150);
    });
    const edgeHoldDelaysAfterMediumTier = setIntervalSpy.mock.calls
      .map(([, delay]) => delay)
      .filter((delay): delay is number => typeof delay === "number" && delay < 1000);
    expect(edgeHoldDelaysAfterMediumTier).toContain(140);
    expect(mocks.nudgeByFineStepMock.mock.calls.length).toBeGreaterThan(callsBeforeMediumTier);

    const callsBeforeFarTier = mocks.nudgeByFineStepMock.mock.calls.length;
    act(() => {
      mocks.dragOffsetMotionValue.set(-120);
      vi.advanceTimersByTime(115);
    });
    const edgeHoldDelaysAfterFarTier = setIntervalSpy.mock.calls
      .map(([, delay]) => delay)
      .filter((delay): delay is number => typeof delay === "number" && delay < 1000);
    expect(edgeHoldDelaysAfterFarTier).toContain(110);
    expect(mocks.nudgeByFineStepMock.mock.calls.length).toBeGreaterThan(callsBeforeFarTier);
    expect(mocks.nudgeByFineStepMock.mock.calls.every(([direction]) => direction === -1)).toBe(true);

    setIntervalSpy.mockRestore();
    vi.useRealTimers();
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
      vi.advanceTimersByTime(220);
    });
    expect(screen.getByTestId("timeline-drag-overlay")).toBeInTheDocument();

    const callsBeforeFarTier = mocks.nudgeByFineStepMock.mock.calls.length;
    act(() => {
      mocks.dragOffsetMotionValue.set(1000);
      vi.advanceTimersByTime(115);
    });
    const edgeHoldDelays = setIntervalSpy.mock.calls
      .map(([, delay]) => delay)
      .filter((delay): delay is number => typeof delay === "number" && delay < 1000);
    expect(edgeHoldDelays).toContain(110);
    expect(mocks.nudgeByFineStepMock.mock.calls.length).toBeGreaterThan(callsBeforeFarTier);
    expect(mocks.nudgeByFineStepMock.mock.calls.every(([direction]) => direction === 1)).toBe(true);

    setIntervalSpy.mockRestore();
    vi.useRealTimers();
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
      vi.advanceTimersByTime(220 + (180 * 2));
    });
    expect(mocks.nudgeByFineStepMock.mock.calls.length).toBeGreaterThan(0);

    act(() => {
      mocks.dragOffsetMotionValue.set(120);
    });
    const callsAfterUnpin = mocks.nudgeByFineStepMock.mock.calls.length;

    act(() => {
      vi.advanceTimersByTime(220 + (180 * 3));
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
      vi.advanceTimersByTime(220 + (180 * 3));
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
      vi.advanceTimersByTime(220 + (110 * 4));
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

  it("renders marker containers as zero-height while keeping marker timestamps visible", () => {
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
    expect(nowMarker).toHaveClass("h-0", "overflow-visible");
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

    expect(screen.getByTestId("timeline-marker-now")).toBeInTheDocument();
    expect(
      within(screen.getByTestId("timeline-marker-now")).getByTestId("timeline-row-time"),
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

    expect(screen.getByTestId("timeline-marker-now")).toBeInTheDocument();
    expect(
      within(screen.getByTestId("timeline-marker-now")).getByTestId("timeline-row-time"),
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
