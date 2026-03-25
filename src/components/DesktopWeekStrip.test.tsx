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
});
