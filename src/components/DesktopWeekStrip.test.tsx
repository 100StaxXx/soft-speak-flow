import { fireEvent, render, screen, within } from "@testing-library/react";
import { format } from "date-fns";
import { describe, expect, it, vi } from "vitest";

import type { CalendarQuest } from "@/features/quests/display";

import { DesktopWeekStrip } from "./DesktopWeekStrip";

const selectedDate = new Date("2026-03-10T12:00:00.000Z");

const buildQuest = (overrides: Partial<CalendarQuest> = {}): CalendarQuest => ({
  id: "quest-1",
  title: "Desktop strip quest",
  completed: false,
  xpReward: 20,
  scheduledTime: "09:00",
  estimatedDuration: 30,
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
  taskDate: "2026-03-10",
  ...overrides,
});

const getDayButton = (dayNumber: string) => {
  const dayLabel = screen.getByText(dayNumber);
  const button = dayLabel.closest("button");
  expect(button).toBeInstanceOf(HTMLButtonElement);
  return button as HTMLButtonElement;
};

describe("DesktopWeekStrip", () => {
  it("summarizes canonical quests by week and by day", () => {
    render(
      <DesktopWeekStrip
        selectedDate={selectedDate}
        onDateSelect={vi.fn()}
        onOpenMonthView={vi.fn()}
        quests={[
          buildQuest({ id: "quest-1", taskDate: "2026-03-10", completed: true, scheduledTime: "09:00" }),
          buildQuest({ id: "quest-2", taskDate: "2026-03-10", completed: false, scheduledTime: null }),
          buildQuest({ id: "quest-3", taskDate: "2026-03-12", completed: false, scheduledTime: "14:00" }),
        ]}
      />,
    );

    expect(screen.getByText(/Mar 8 - Mar 14 · 1\/3 completed/i)).toBeInTheDocument();

    const selectedDay = getDayButton("10");
    expect(within(selectedDay).getByText("1/2 done")).toBeInTheDocument();
    expect(within(selectedDay).getByText("1 timed")).toBeInTheDocument();
  });

  it("keeps the desktop controls wired while reading canonical quest input", () => {
    const onDateSelect = vi.fn();
    const onOpenMonthView = vi.fn();
    const onAddQuest = vi.fn();
    const onPlannerModeChange = vi.fn();

    render(
      <DesktopWeekStrip
        selectedDate={selectedDate}
        onDateSelect={onDateSelect}
        onOpenMonthView={onOpenMonthView}
        onAddQuest={onAddQuest}
        plannerMode="week"
        onPlannerModeChange={onPlannerModeChange}
        quests={[buildQuest()]}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Day" }));
    fireEvent.click(screen.getByRole("button", { name: "Month" }));
    fireEvent.click(screen.getByRole("button", { name: "Add Quest" }));
    fireEvent.click(getDayButton("11"));

    expect(onPlannerModeChange).toHaveBeenCalledWith("day");
    expect(onOpenMonthView).toHaveBeenCalledTimes(1);
    expect(onAddQuest).toHaveBeenCalledTimes(1);
    expect(onDateSelect).toHaveBeenCalledWith(expect.any(Date));
    const clickedDate = onDateSelect.mock.calls.at(-1)?.[0] as Date;
    expect(format(clickedDate, "yyyy-MM-dd")).toBe("2026-03-11");
  });
});
