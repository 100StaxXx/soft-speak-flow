import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { ComponentProps, ReactNode } from "react";
import type { CalendarTask } from "@/types/quest";

const mocks = vi.hoisted(() => ({
  playSound: vi.fn(),
  toastError: vi.fn(),
}));

vi.mock("./ui/scroll-area", () => ({
  ScrollArea: ({ children, className }: { children: ReactNode; className?: string }) => (
    <div className={className}>{children}</div>
  ),
}));

vi.mock("./QuestDropZone", () => ({
  QuestDropZone: ({
    children,
    hasConflict,
    onDrop,
    onTouchStart,
    onTouchEnd,
    onMouseDown,
    onMouseUp,
    onMouseLeave,
  }: {
    children?: ReactNode;
    hasConflict?: boolean;
    onDrop: (e: React.DragEvent<HTMLDivElement>) => void;
    onTouchStart?: (e: React.TouchEvent<HTMLDivElement>) => void;
    onTouchEnd?: (e: React.TouchEvent<HTMLDivElement>) => void;
    onMouseDown?: (e: React.MouseEvent<HTMLDivElement>) => void;
    onMouseUp?: (e: React.MouseEvent<HTMLDivElement>) => void;
    onMouseLeave?: (e: React.MouseEvent<HTMLDivElement>) => void;
  }) => (
    <div
      data-testid={hasConflict ? "drop-zone-conflict" : "drop-zone-open"}
      data-conflict={hasConflict ? "true" : "false"}
      onDrop={onDrop}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
      onMouseDown={onMouseDown}
      onMouseUp={onMouseUp}
      onMouseLeave={onMouseLeave}
    >
      {children}
    </div>
  ),
}));

vi.mock("./QuestDragCard", () => ({
  QuestDragCard: ({
    task,
    onDragStart,
    onDragEnd,
  }: {
    task: { id: string; task_text: string };
    onDragStart?: (e: React.DragEvent<HTMLDivElement>) => void;
    onDragEnd?: (e: React.DragEvent<HTMLDivElement>) => void;
  }) => (
    <div
      data-testid={`quest-card-${task.id}`}
      data-quest-card="true"
      draggable={Boolean(onDragStart)}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
    >
      {task.task_text}
    </div>
  ),
}));

vi.mock("@/utils/soundEffects", () => ({
  playSound: mocks.playSound,
}));

vi.mock("sonner", () => ({
  toast: {
    error: mocks.toastError,
  },
}));

import { CalendarWeekView } from "./CalendarWeekView";

const selectedDate = new Date("2026-02-13T09:00:00.000Z");

const baseTask = (overrides: Partial<CalendarTask> = {}): CalendarTask => ({
  id: "task-1",
  task_text: "Week quest",
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

const createDataTransfer = (taskId: string = "") => ({
  getData: vi.fn((key: string) => (key === "taskId" ? taskId : "")),
});

const setup = (tasks: CalendarTask[], overrides?: Partial<ComponentProps<typeof CalendarWeekView>>) => {
  const onTaskDrop = vi.fn();

  render(
    <CalendarWeekView
      selectedDate={selectedDate}
      onDateSelect={vi.fn()}
      tasks={tasks}
      onTaskDrop={onTaskDrop}
      {...overrides}
    />,
  );

  return { onTaskDrop };
};

describe("CalendarWeekView drops", () => {
  it("calls onTaskDrop once with one task id for a valid payload", () => {
    const { onTaskDrop } = setup([]);
    const openZone = screen.getAllByTestId("drop-zone-open")[0];
    const dataTransfer = createDataTransfer("drop-task-1");

    fireEvent.drop(openZone, { dataTransfer });

    expect(onTaskDrop).toHaveBeenCalledTimes(1);
    expect(onTaskDrop.mock.calls[0]?.[0]).toBe("drop-task-1");
    expect(onTaskDrop.mock.calls[0]?.[2]).toMatch(/^\d{2}:00$/);
  });

  it("does not call onTaskDrop when payload task id is missing", () => {
    const { onTaskDrop } = setup([]);
    const openZone = screen.getAllByTestId("drop-zone-open")[0];
    const dataTransfer = createDataTransfer("");

    fireEvent.drop(openZone, { dataTransfer });

    expect(dataTransfer.getData).toHaveBeenCalledWith("taskId");
    expect(onTaskDrop).not.toHaveBeenCalled();
    expect(mocks.toastError).not.toHaveBeenCalled();
  });

  it("blocks conflicting drop and keeps conflict error path", () => {
    const { onTaskDrop } = setup([
      baseTask({ id: "task-a", task_text: "Conflict A", scheduled_time: "09:00" }),
      baseTask({ id: "task-b", task_text: "Conflict B", scheduled_time: "09:30" }),
    ]);
    const conflictZone = screen.getAllByTestId("drop-zone-conflict")[0];
    const dataTransfer = createDataTransfer("drop-task-conflict");

    fireEvent.drop(conflictZone, { dataTransfer });

    expect(onTaskDrop).not.toHaveBeenCalled();
    expect(mocks.toastError).toHaveBeenCalledTimes(1);
    expect(mocks.playSound).toHaveBeenCalledWith("error");
  });
});
