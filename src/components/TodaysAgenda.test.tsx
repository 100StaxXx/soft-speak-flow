import type { ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const subtaskEqMock = vi.fn();
  const subtaskUpdateMock = vi.fn();

  return {
    subtaskEqMock,
    subtaskUpdateMock,
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
    draggingTaskId: null,
    isDragging: false,
    justDroppedId: null,
    dragOffsetY: 0,
    previewTime: undefined,
    getDragHandleProps: () => ({}),
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

vi.mock("@/components/JourneyPathDrawer", () => ({
  JourneyPathDrawer: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

vi.mock("@/components/TimelineTaskRow", () => ({
  TimelineTaskRow: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

vi.mock("@/components/SwipeableTaskItem", () => ({
  SwipeableTaskItem: ({ children }: { children: ReactNode }) => <>{children}</>,
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

describe("TodaysAgenda scheduled header copy", () => {
  it("shows Scheduled label, hides helper copy, and keeps drag handle", () => {
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
    expect(screen.queryByText(/Drag handle to reschedule/i)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /drag to reschedule/i })).toBeInTheDocument();
  });
});
