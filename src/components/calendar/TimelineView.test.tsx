import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { CalendarTask } from "@/types/quest";

vi.mock("@/hooks/useAutoscroll", () => ({
  useAutoscroll: () => ({
    updatePosition: vi.fn(),
    stopScroll: vi.fn(),
  }),
}));

vi.mock("@capacitor/haptics", () => ({
  Haptics: {
    impact: vi.fn().mockResolvedValue(undefined),
  },
  ImpactStyle: {
    Light: "LIGHT",
    Medium: "MEDIUM",
  },
}));

vi.mock("./WeekStrip", () => ({
  WeekStrip: () => <div />,
}));

vi.mock("./AllDayTaskBanner", () => ({
  AllDayTaskBanner: () => <div />,
}));

vi.mock("../MilestoneCalendarCard", () => ({
  MilestoneCalendarCard: () => <div />,
}));

import { TimelineView } from "./TimelineView";

const baseTask = (overrides: Partial<CalendarTask> = {}): CalendarTask => ({
  id: "task-1",
  task_text: "Focus block",
  task_date: "2026-02-13",
  scheduled_time: "09:00",
  estimated_duration: 30,
  completed: false,
  is_main_quest: false,
  difficulty: "medium",
  xp_reward: 20,
  category: null,
  ...overrides,
});

const dispatchPointerMove = (clientY: number) => {
  const event = new Event("pointermove") as PointerEvent;
  Object.defineProperty(event, "clientY", { value: clientY });
  window.dispatchEvent(event);
};

const createPointerDownEvent = (clientY: number) => {
  const event = new Event("pointerdown", { bubbles: true, cancelable: true }) as PointerEvent;
  Object.defineProperty(event, "pointerType", { value: "mouse" });
  Object.defineProperty(event, "button", { value: 0 });
  Object.defineProperty(event, "clientY", { value: clientY });
  return event;
};

describe("TimelineView drag integration", () => {
  it("reschedules using shared adaptive drag snapping", async () => {
    const onTaskReschedule = vi.fn();

    render(
      <TimelineView
        selectedDate={new Date("2026-02-13T09:00:00.000Z")}
        onDateSelect={vi.fn()}
        tasks={[baseTask()]}
        onTaskReschedule={onTaskReschedule}
      />,
    );

    const dragHandle = screen.getByRole("button", { name: /drag to reschedule/i });

    act(() => {
      fireEvent(dragHandle, createPointerDownEvent(100));

      dispatchPointerMove(120); // +20px => shared profile preview/drop +20m
      window.dispatchEvent(new Event("pointerup"));
    });

    await waitFor(() => {
      expect(onTaskReschedule).toHaveBeenCalledWith("task-1", "09:20");
    });
  });

  it("does not show zoom rail during active drag", async () => {
    const onTaskReschedule = vi.fn();

    render(
      <TimelineView
        selectedDate={new Date("2026-02-13T09:00:00.000Z")}
        onDateSelect={vi.fn()}
        tasks={[baseTask()]}
        onTaskReschedule={onTaskReschedule}
      />,
    );

    const dragHandle = screen.getByRole("button", { name: /drag to reschedule/i });
    act(() => {
      fireEvent(dragHandle, createPointerDownEvent(100));

      dispatchPointerMove(120);
    });

    await waitFor(() => {
      expect(screen.queryByTestId("drag-time-zoom-rail")).not.toBeInTheDocument();
    });
  });
});
