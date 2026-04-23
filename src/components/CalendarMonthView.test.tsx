import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { CalendarQuest } from "@/features/quests/display";

import { CalendarMonthView } from "./CalendarMonthView";

vi.mock("@/utils/soundEffects", () => ({
  playSound: vi.fn(),
}));

const selectedDate = new Date(2026, 2, 10, 12);

const getDayCell = (dayNumber: string) => {
  const dayLabel = screen.getByText(dayNumber);
  const cell = dayLabel.parentElement?.parentElement;
  if (!(cell instanceof HTMLElement)) {
    throw new Error(`Unable to find calendar cell for day ${dayNumber}`);
  }
  return cell;
};

const buildQuest = (overrides: Partial<CalendarQuest> = {}): CalendarQuest => ({
  id: "quest-1",
  title: "Month quest",
  taskDate: "2026-03-15",
  scheduledTime: "09:00",
  estimatedDuration: 30,
  completed: false,
  isMainQuest: false,
  difficulty: "medium",
  xpReward: 20,
  category: null,
  habitSourceId: null,
  notes: null,
  priority: null,
  isRecurring: false,
  recurrencePattern: null,
  imageUrl: null,
  attachments: [],
  subtasks: [],
  location: null,
  ...overrides,
});

describe("CalendarMonthView", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
  });

  it("navigates on mouse click without triggering long press", () => {
    const onDateSelect = vi.fn();
    const onDateLongPress = vi.fn();

    render(
      <CalendarMonthView
        selectedDate={selectedDate}
        onDateSelect={onDateSelect}
        quests={[]}
        milestones={[]}
        onQuestClick={vi.fn()}
        onDateLongPress={onDateLongPress}
      />,
    );

    const dayCell = getDayCell("15");

    fireEvent.mouseDown(dayCell);
    act(() => {
      vi.advanceTimersByTime(600);
    });
    fireEvent.mouseUp(dayCell);
    fireEvent.click(dayCell);

    expect(onDateSelect).toHaveBeenCalledTimes(1);
    const selected = onDateSelect.mock.calls[0]?.[0];
    expect(selected).toBeInstanceOf(Date);
    expect(selected?.getFullYear()).toBe(2026);
    expect(selected?.getMonth()).toBe(2);
    expect(selected?.getDate()).toBe(15);
    expect(onDateLongPress).not.toHaveBeenCalled();
  });

  it("still supports touch long press for quick create", () => {
    const onDateSelect = vi.fn();
    const onDateLongPress = vi.fn();

    render(
      <CalendarMonthView
        selectedDate={selectedDate}
        onDateSelect={onDateSelect}
        quests={[]}
        milestones={[]}
        onQuestClick={vi.fn()}
        onDateLongPress={onDateLongPress}
      />,
    );

    const dayCell = getDayCell("15");

    fireEvent.touchStart(dayCell);
    act(() => {
      vi.advanceTimersByTime(500);
    });

    expect(onDateLongPress).toHaveBeenCalledTimes(1);
    const selected = onDateLongPress.mock.calls[0]?.[0];
    expect(selected).toBeInstanceOf(Date);
    expect(selected?.getFullYear()).toBe(2026);
    expect(selected?.getMonth()).toBe(2);
    expect(selected?.getDate()).toBe(15);
    expect(onDateSelect).not.toHaveBeenCalled();
  });

  it("cancels touch long press when the touch ends early", () => {
    const onDateLongPress = vi.fn();

    render(
      <CalendarMonthView
        selectedDate={selectedDate}
        onDateSelect={vi.fn()}
        quests={[]}
        milestones={[]}
        onQuestClick={vi.fn()}
        onDateLongPress={onDateLongPress}
      />,
    );

    const dayCell = getDayCell("15");

    fireEvent.touchStart(dayCell);
    act(() => {
      vi.advanceTimersByTime(300);
    });
    fireEvent.touchEnd(dayCell);
    act(() => {
      vi.advanceTimersByTime(300);
    });

    expect(onDateLongPress).not.toHaveBeenCalled();
  });

  it("renders canonical quest titles in the day cell and returns canonical quest payloads", () => {
    const onQuestClick = vi.fn();
    const quest = buildQuest({ title: "Canonical month quest" });

    render(
      <CalendarMonthView
        selectedDate={selectedDate}
        onDateSelect={vi.fn()}
        quests={[quest]}
        milestones={[]}
        onQuestClick={onQuestClick}
      />,
    );

    fireEvent.click(screen.getByText("Canonical month quest"));

    expect(onQuestClick).toHaveBeenCalledWith(quest);
  });
});
