import { fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import type { CalendarQuest } from "@/features/quests/display";

vi.mock("@/components/ui/dialog", () => ({
  Dialog: ({ open, children }: { open: boolean; children: ReactNode }) => (open ? <div>{children}</div> : null),
  DialogContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DialogTitle: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

vi.mock("./CalendarMonthView", () => ({
  CalendarMonthView: ({
    onDateSelect,
    onQuestClick,
    quests,
  }: {
    onDateSelect: (date: Date) => void;
    onQuestClick: (quest: CalendarQuest) => void;
    quests: CalendarQuest[];
  }) => (
    <div>
      <button type="button" onClick={() => onDateSelect(new Date(2026, 2, 15, 12))}>
        March 15
      </button>
      <button type="button" onClick={() => onQuestClick(quests[0])}>
        Open quest
      </button>
    </div>
  ),
}));

vi.mock("./calendar/YearViewModal", () => ({
  YearView: () => null,
}));

import { HourlyViewModal } from "./HourlyViewModal";

const buildQuest = (overrides: Partial<CalendarQuest> = {}): CalendarQuest => ({
  id: "quest-1",
  title: "Modal quest",
  taskDate: "2026-03-18",
  scheduledTime: "09:00",
  estimatedDuration: 30,
  completed: false,
  xpReward: 20,
  isMainQuest: false,
  habitSourceId: null,
  notes: null,
  priority: null,
  difficulty: "medium",
  category: null,
  isRecurring: false,
  recurrencePattern: null,
  imageUrl: null,
  attachments: [],
  subtasks: [],
  location: null,
  ...overrides,
});

describe("HourlyViewModal", () => {
  it("selects the date before closing the modal", () => {
    const onDateSelect = vi.fn();
    const onOpenChange = vi.fn();

    render(
      <HourlyViewModal
        open
        onOpenChange={onOpenChange}
        selectedDate={new Date(2026, 2, 10, 12)}
        onDateSelect={onDateSelect}
        quests={[]}
        milestones={[]}
        onTaskDrop={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "March 15" }));

    expect(onDateSelect).toHaveBeenCalledTimes(1);
    const selected = onDateSelect.mock.calls[0]?.[0];
    expect(selected).toBeInstanceOf(Date);
    expect(selected?.getFullYear()).toBe(2026);
    expect(selected?.getMonth()).toBe(2);
    expect(selected?.getDate()).toBe(15);
    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(onDateSelect.mock.invocationCallOrder[0]).toBeLessThan(onOpenChange.mock.invocationCallOrder[0]);
  });

  it("selects a canonical quest date before closing the modal", () => {
    const onDateSelect = vi.fn();
    const onOpenChange = vi.fn();
    const quest = buildQuest();

    render(
      <HourlyViewModal
        open
        onOpenChange={onOpenChange}
        selectedDate={new Date(2026, 2, 10, 12)}
        onDateSelect={onDateSelect}
        quests={[quest]}
        milestones={[]}
        onTaskDrop={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Open quest" }));

    expect(onDateSelect).toHaveBeenCalledTimes(1);
    const selected = onDateSelect.mock.calls[0]?.[0];
    expect(selected).toBeInstanceOf(Date);
    expect(selected?.getFullYear()).toBe(2026);
    expect(selected?.getMonth()).toBe(2);
    expect(selected?.getDate()).toBe(18);
    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(onDateSelect.mock.invocationCallOrder[0]).toBeLessThan(onOpenChange.mock.invocationCallOrder[0]);
  });
});
