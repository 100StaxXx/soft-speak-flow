import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { DragTask } from "@/types/quest";
import { QuestDragCard } from "./QuestDragCard";

vi.mock("@/utils/soundEffects", () => ({
  playSound: vi.fn(),
}));

const baseTask = (overrides: Partial<DragTask> = {}): DragTask => ({
  id: "task-1",
  task_text: "Card quest",
  scheduled_time: "09:00",
  estimated_duration: 30,
  difficulty: "medium",
  is_main_quest: false,
  completed: false,
  ...overrides,
});

const getCardRoot = (taskText: string) => {
  const content = screen.getByText(taskText);
  const cardRoot = content.closest('[data-quest-card="true"]') as HTMLDivElement | null;
  expect(cardRoot).toBeTruthy();
  return cardRoot as HTMLDivElement;
};

describe("QuestDragCard draggable ownership", () => {
  it("is not draggable without an explicit drag handler or draggable prop", () => {
    render(<QuestDragCard task={baseTask()} />);
    expect(getCardRoot("Card quest").draggable).toBe(false);
  });

  it("is draggable when a drag handler or draggable prop is provided", () => {
    const onDragStart = vi.fn();
    const { rerender } = render(<QuestDragCard task={baseTask()} onDragStart={onDragStart} />);
    expect(getCardRoot("Card quest").draggable).toBe(true);

    rerender(<QuestDragCard task={baseTask()} draggable />);
    expect(getCardRoot("Card quest").draggable).toBe(true);
  });
});
