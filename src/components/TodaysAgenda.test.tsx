import type { ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
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
