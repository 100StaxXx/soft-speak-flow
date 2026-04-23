import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { CalendarQuest } from "@/features/quests/display";

import { WeekStrip } from "./WeekStrip";

const selectedDate = new Date("2026-03-10T12:00:00.000Z");

const buildQuest = (overrides: Partial<CalendarQuest> = {}): CalendarQuest => ({
  id: "quest-1",
  title: "Week strip quest",
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

const getDayButton = (dayLabel: string) => {
  const dayNumber = screen.getByText(dayLabel);
  const button = dayNumber.closest("button");
  expect(button).toBeInstanceOf(HTMLButtonElement);
  return button as HTMLButtonElement;
};

describe("WeekStrip", () => {
  it("derives completion dots from canonical quests and keeps day selection wired", () => {
    const onDateSelect = vi.fn();

    render(
      <WeekStrip
        selectedDate={selectedDate}
        onDateSelect={onDateSelect}
        quests={[
          buildQuest({ id: "quest-1", taskDate: "2026-03-10", completed: false }),
          buildQuest({ id: "quest-2", taskDate: "2026-03-10", completed: true, scheduledTime: null }),
          buildQuest({ id: "quest-3", taskDate: "2026-03-11", completed: false }),
        ]}
      />,
    );

    const selectedDay = getDayButton("10");
    expect(selectedDay.querySelectorAll("div.rounded-full")).toHaveLength(2);

    fireEvent.click(getDayButton("11"));

    expect(onDateSelect).toHaveBeenCalledWith(expect.any(Date));
    const clickedDate = onDateSelect.mock.calls[0]?.[0] as Date;
    expect(clickedDate.toISOString()).toContain("2026-03-11");
  });
});
