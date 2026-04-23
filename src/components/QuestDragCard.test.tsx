import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { QuestDragCardQuest } from "./QuestDragCard";
import { QuestDragCard } from "./QuestDragCard";

vi.mock("@/utils/soundEffects", () => ({
  playSound: vi.fn(),
}));

const baseQuest = (overrides: Partial<QuestDragCardQuest> = {}): QuestDragCardQuest => ({
  id: "task-1",
  title: "Card quest",
  scheduledTime: "09:00",
  estimatedDuration: 30,
  difficulty: "medium",
  category: null,
  isMainQuest: false,
  xpReward: 0,
  completed: false,
  ...overrides,
});

const getCardRoot = (questTitle: string) => {
  const content = screen.getByText(questTitle);
  const cardRoot = content.closest('[data-quest-card="true"]') as HTMLDivElement | null;
  expect(cardRoot).toBeTruthy();
  return cardRoot as HTMLDivElement;
};

describe("QuestDragCard draggable ownership", () => {
  it("is not draggable without an explicit drag handler or draggable prop", () => {
    render(<QuestDragCard quest={baseQuest()} />);
    expect(getCardRoot("Card quest").draggable).toBe(false);
  });

  it("is draggable when a drag handler or draggable prop is provided", () => {
    const onDragStart = vi.fn();
    const { rerender } = render(<QuestDragCard quest={baseQuest()} onDragStart={onDragStart} />);
    expect(getCardRoot("Card quest").draggable).toBe(true);

    rerender(<QuestDragCard quest={baseQuest()} draggable />);
    expect(getCardRoot("Card quest").draggable).toBe(true);
  });
});
