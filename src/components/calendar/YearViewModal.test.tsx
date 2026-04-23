import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { CalendarMilestone } from "@/features/epics/types";
import type { CalendarQuest } from "@/features/quests/display";

import { YearView } from "./YearViewModal";

const buildQuest = (overrides: Partial<CalendarQuest> = {}): CalendarQuest => ({
  id: "quest-1",
  title: "Year quest",
  taskDate: "2026-03-15",
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

const buildMilestone = (overrides: Partial<CalendarMilestone> = {}): CalendarMilestone => ({
  id: "milestone-1",
  title: "Launch",
  target_date: "2026-03-20",
  milestone_percent: 50,
  completed_at: null,
  epic_id: "campaign-1",
  ...overrides,
});

describe("YearView", () => {
  it("groups canonical quests by month and keeps month selection working", () => {
    const onMonthSelect = vi.fn();

    render(
      <YearView
        selectedDate={new Date(2026, 2, 10, 12)}
        onMonthSelect={onMonthSelect}
        onBack={vi.fn()}
        onClose={vi.fn()}
        onYearChange={vi.fn()}
        quests={[
          buildQuest({ id: "quest-a", taskDate: "2026-03-15", completed: false }),
          buildQuest({ id: "quest-b", taskDate: "2026-03-16", completed: true }),
          buildQuest({ id: "quest-c", taskDate: "2026-04-02", completed: false }),
        ]}
        milestones={[buildMilestone()]}
      />,
    );

    const marchButton = screen.getByRole("button", { name: "Mar" });
    expect(marchButton.querySelectorAll(".rounded-full")).toHaveLength(3);

    fireEvent.click(marchButton);

    expect(onMonthSelect).toHaveBeenCalledTimes(1);
    const selected = onMonthSelect.mock.calls[0]?.[0];
    expect(selected).toBeInstanceOf(Date);
    expect(selected?.getFullYear()).toBe(2026);
    expect(selected?.getMonth()).toBe(2);
  });
});
