import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { CalendarTask } from "@/types/quest";
import type { ComponentProps, ReactNode } from "react";

vi.mock("./ui/scroll-area", () => ({
  ScrollArea: ({ children, className }: { children: ReactNode; className?: string }) => (
    <div className={className}>{children}</div>
  ),
}));

vi.mock("./QuestDragCard", () => ({
  QuestDragCard: ({ task }: { task: { task_text: string } }) => <div>{task.task_text}</div>,
}));

vi.mock("./MilestoneCalendarCard", () => ({
  MilestoneCalendarCard: () => <div />,
}));

vi.mock("@/utils/soundEffects", () => ({
  playSound: vi.fn(),
}));

import { CalendarDayView } from "./CalendarDayView";

const selectedDate = new Date("2026-02-13T09:00:00.000Z");

const baseTask = (overrides: Partial<CalendarTask> = {}): CalendarTask => ({
  id: "task-1",
  task_text: "Scheduled quest",
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

const setup = (tasks: CalendarTask[], overrides?: Partial<ComponentProps<typeof CalendarDayView>>) => {
  const onTaskDrop = vi.fn();
  const onTimeSlotLongPress = vi.fn();

  render(
    <CalendarDayView
      selectedDate={selectedDate}
      onDateSelect={vi.fn()}
      tasks={tasks}
      onTaskDrop={onTaskDrop}
      onTimeSlotLongPress={onTimeSlotLongPress}
      {...overrides}
    />,
  );

  return { onTaskDrop, onTimeSlotLongPress };
};

const mockRowBounds = (row: HTMLElement, top: number = 100) => {
  Object.defineProperty(row, "getBoundingClientRect", {
    configurable: true,
    value: () =>
      ({
        x: 0,
        y: top,
        top,
        left: 0,
        right: 300,
        bottom: top + 60,
        width: 300,
        height: 60,
        toJSON: () => ({}),
      }) as DOMRect,
  });
};

const createDropEvent = (clientY: number, dataTransfer: { getData: ReturnType<typeof vi.fn> }) => {
  const event = new Event("drop", { bubbles: true, cancelable: true }) as DragEvent;
  Object.defineProperty(event, "clientY", { configurable: true, value: clientY });
  Object.defineProperty(event, "dataTransfer", { configurable: true, value: dataTransfer });
  return event;
};

const createDragOverEvent = (clientY: number) => {
  const event = new Event("dragover", { bubbles: true, cancelable: true }) as DragEvent;
  Object.defineProperty(event, "clientY", { configurable: true, value: clientY });
  return event;
};

describe("CalendarDayView interactions", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
  });

  it("snaps standard-view drop time to 15-minute increments before fine mode", () => {
    const { onTaskDrop } = setup([baseTask()]);

    const label = screen.getByText("8:30 AM");
    const row = label.closest("div.flex");
    expect(row).toBeTruthy();
    mockRowBounds(row!, 100);

    const dataTransfer = {
      getData: vi.fn().mockReturnValue("drop-task"),
    };

    fireEvent(row!, createDropEvent(122, dataTransfer)); // 22px into row => coarse snap to nearest 15 min

    expect(dataTransfer.getData).toHaveBeenCalledWith("taskId");
    expect(onTaskDrop).toHaveBeenCalledWith("drop-task", selectedDate, "08:45");
  });

  it("enters fine mode after dwell and allows 5-minute drop precision", () => {
    const { onTaskDrop } = setup([baseTask()]);

    const label = screen.getByText("8:30 AM");
    const row = label.closest("div.flex");
    expect(row).toBeTruthy();
    mockRowBounds(row!, 100);

    const dataTransfer = {
      getData: vi.fn().mockReturnValue("drop-task"),
    };

    fireEvent(row!, createDragOverEvent(122));
    act(() => {
      vi.advanceTimersByTime(230);
    });
    fireEvent(row!, createDragOverEvent(122)); // switches into fine mode after dwell
    fireEvent(row!, createDragOverEvent(152)); // +30px in fine mode => +5 minutes
    fireEvent(row!, createDropEvent(152, dataTransfer));

    expect(onTaskDrop).toHaveBeenCalledWith("drop-task", selectedDate, "08:50");
  });

  it("snaps long-press add time to 5-minute increments in standard view", () => {
    const { onTimeSlotLongPress } = setup([baseTask()]);

    const label = screen.getByText("8:30 AM");
    const row = label.closest("div.flex");
    expect(row).toBeTruthy();
    mockRowBounds(row!, 100);

    act(() => {
      fireEvent.touchStart(row!, {
        touches: [{ clientX: 0, clientY: 140 }], // 40px into row => +20 minutes
      });
      vi.advanceTimersByTime(600);
    });

    expect(onTimeSlotLongPress).toHaveBeenCalledWith(selectedDate, "08:50");
  });
});
