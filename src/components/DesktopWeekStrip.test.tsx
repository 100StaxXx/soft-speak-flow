import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { DesktopWeekStrip } from "./DesktopWeekStrip";

describe("DesktopWeekStrip", () => {
  const selectedDate = new Date("2026-03-25T12:00:00.000Z");

  it("omits the add quest CTA when no callback is provided", () => {
    render(
      <DesktopWeekStrip
        selectedDate={selectedDate}
        tasks={[]}
        onDateSelect={vi.fn()}
        onOpenMonthView={vi.fn()}
      />,
    );

    expect(screen.queryByRole("button", { name: /add quest/i })).not.toBeInTheDocument();
  });

  it("renders the add quest CTA and invokes the callback", () => {
    const onAddQuest = vi.fn();

    render(
      <DesktopWeekStrip
        selectedDate={selectedDate}
        tasks={[]}
        onDateSelect={vi.fn()}
        onOpenMonthView={vi.fn()}
        onAddQuest={onAddQuest}
      />,
    );

    const addButton = screen.getByRole("button", { name: /add quest/i });
    expect(screen.getByText("⌘N")).toBeInTheDocument();

    fireEvent.click(addButton);
    expect(onAddQuest).toHaveBeenCalledTimes(1);
  });

  it("renders the desktop planner toggle and switches modes", () => {
    const onPlannerModeChange = vi.fn();

    render(
      <DesktopWeekStrip
        selectedDate={selectedDate}
        tasks={[]}
        onDateSelect={vi.fn()}
        onOpenMonthView={vi.fn()}
        plannerMode="week"
        onPlannerModeChange={onPlannerModeChange}
      />,
    );

    expect(screen.getByRole("group", { name: /desktop planner mode/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Week" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Day" })).toHaveAttribute("aria-pressed", "false");

    fireEvent.click(screen.getByRole("button", { name: "Day" }));
    expect(onPlannerModeChange).toHaveBeenCalledWith("day");
  });
});
