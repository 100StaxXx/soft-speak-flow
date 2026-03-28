import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
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

const dispatchTouchMove = (clientY: number) => {
  const event = new Event("touchmove", { bubbles: true, cancelable: true }) as TouchEvent;
  Object.defineProperty(event, "touches", { value: [{ clientY }] });
  document.dispatchEvent(event);
};

const dispatchTouchEnd = () => {
  document.dispatchEvent(new Event("touchend", { bubbles: true, cancelable: true }));
};

const createPointerDownEvent = (clientY: number) => {
  const event = new Event("pointerdown", { bubbles: true, cancelable: true }) as PointerEvent;
  Object.defineProperty(event, "pointerType", { value: "mouse" });
  Object.defineProperty(event, "button", { value: 0 });
  Object.defineProperty(event, "clientY", { value: clientY });
  return event;
};

describe("TimelineView drag integration", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

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

    const dragRow = screen.getByText("Focus block");

    act(() => {
      fireEvent(dragRow, createPointerDownEvent(100));

      dispatchPointerMove(124); // +24px with 20px combined activation/deadzone => +5m
      window.dispatchEvent(new Event("pointerup"));
    });

    await waitFor(() => {
      expect(onTaskReschedule).toHaveBeenCalledWith("task-1", "09:05");
    });
  });

  it("does not reschedule for a pointer wiggle below the shared desktop threshold", async () => {
    const onTaskReschedule = vi.fn();

    render(
      <TimelineView
        selectedDate={new Date("2026-02-13T09:00:00.000Z")}
        onDateSelect={vi.fn()}
        tasks={[baseTask()]}
        onTaskReschedule={onTaskReschedule}
      />,
    );

    const dragRow = screen.getByText("Focus block");
    act(() => {
      fireEvent(dragRow, createPointerDownEvent(100));
      dispatchPointerMove(111);
      window.dispatchEvent(new Event("pointerup"));
    });

    expect(onTaskReschedule).not.toHaveBeenCalled();
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

    const dragRow = screen.getByText("Focus block");
    act(() => {
      fireEvent(dragRow, createPointerDownEvent(100));

      dispatchPointerMove(120);
    });

    await waitFor(() => {
      expect(screen.queryByTestId("drag-time-zoom-rail")).not.toBeInTheDocument();
    });
  });

  it("does not reschedule when row is pressed without movement", async () => {
    const onTaskReschedule = vi.fn();

    render(
      <TimelineView
        selectedDate={new Date("2026-02-13T09:00:00.000Z")}
        onDateSelect={vi.fn()}
        tasks={[baseTask()]}
        onTaskReschedule={onTaskReschedule}
      />,
    );

    const dragRow = screen.getByText("Focus block");
    act(() => {
      fireEvent(dragRow, createPointerDownEvent(100));
      window.dispatchEvent(new Event("pointerup"));
    });

    expect(onTaskReschedule).not.toHaveBeenCalled();
  });

  it("requires touch hold before row drag reschedules", () => {
    vi.useFakeTimers();
    const onTaskReschedule = vi.fn();

    render(
      <TimelineView
        selectedDate={new Date("2026-02-13T09:00:00.000Z")}
        onDateSelect={vi.fn()}
        tasks={[baseTask()]}
        onTaskReschedule={onTaskReschedule}
      />,
    );

    const dragRow = screen.getByText("Focus block");
    act(() => {
      fireEvent.touchStart(dragRow, { touches: [{ clientX: 0, clientY: 100 }] });
      dispatchTouchMove(130);
      dispatchTouchEnd();
    });
    expect(onTaskReschedule).not.toHaveBeenCalled();

    act(() => {
      fireEvent.touchStart(dragRow, { touches: [{ clientX: 0, clientY: 100 }] });
      vi.advanceTimersByTime(500);
      dispatchTouchMove(140);
      vi.advanceTimersByTime(16);
      dispatchTouchEnd();
    });
    expect(onTaskReschedule).toHaveBeenCalledWith("task-1", "09:10");

  });

  it("locks row touch action during hold", () => {
    vi.useFakeTimers();
    const onTaskReschedule = vi.fn();

    render(
      <TimelineView
        selectedDate={new Date("2026-02-13T09:00:00.000Z")}
        onDateSelect={vi.fn()}
        tasks={[baseTask()]}
        onTaskReschedule={onTaskReschedule}
      />,
    );

    const getRowWrapper = () => {
      const taskText = screen.getByText("Focus block");
      const cardRoot = taskText.closest("div.flex.items-center.gap-4.py-3.cursor-pointer.transition-all.select-none") as HTMLElement;
      return cardRoot.parentElement as HTMLElement;
    };

    expect(getRowWrapper().style.touchAction).toBe("pan-y");

    act(() => {
      const dragRow = screen.getByText("Focus block");
      fireEvent.touchStart(dragRow, { touches: [{ clientX: 0, clientY: 100 }] });
      vi.advanceTimersByTime(500);
    });

    expect(getRowWrapper().style.touchAction).toBe("none");

    act(() => {
      dispatchTouchEnd();
    });
  });
});
