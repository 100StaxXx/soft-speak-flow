import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

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
        tasks={[]}
        milestones={[]}
        onTaskClick={vi.fn()}
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
        tasks={[]}
        milestones={[]}
        onTaskClick={vi.fn()}
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
        tasks={[]}
        milestones={[]}
        onTaskClick={vi.fn()}
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

  it("renders campaign rituals as distinct scheduled calendar items", () => {
    render(
      <CalendarMonthView
        selectedDate={selectedDate}
        onDateSelect={vi.fn()}
        tasks={[
          {
            id: "ritual-portfolio",
            task_text: "Portfolio work",
            task_date: "2026-03-10",
            scheduled_time: "19:00",
            estimated_duration: 45,
            completed: false,
            is_main_quest: false,
            difficulty: "medium",
            xp_reward: 20,
            habit_source_id: "habit-portfolio",
            epic_id: "epic-portfolio",
            epic_title: "Build Portfolio Website",
          },
        ]}
        milestones={[]}
        onTaskClick={vi.fn()}
        onDateLongPress={vi.fn()}
      />,
    );

    const dayCell = getDayCell("10");
    expect(within(dayCell).getByText("Portfolio work")).toBeInTheDocument();
    const ritualBadge = within(dayCell).getByText("Campaign Ritual - Build Portfolio Website");
    expect(ritualBadge).toBeInTheDocument();
    expect(ritualBadge.parentElement).toHaveClass(
      "campaign-ritual-card",
      "border-primary/35",
      "bg-primary/[0.08]",
    );
  });
});
