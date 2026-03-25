import { fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/components/ui/dialog", () => ({
  Dialog: ({ open, children }: { open: boolean; children: ReactNode }) => (open ? <div>{children}</div> : null),
  DialogContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DialogTitle: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

vi.mock("./CalendarMonthView", () => ({
  CalendarMonthView: ({ onDateSelect }: { onDateSelect: (date: Date) => void }) => (
    <button type="button" onClick={() => onDateSelect(new Date(2026, 2, 15, 12))}>
      March 15
    </button>
  ),
}));

vi.mock("./calendar/YearViewModal", () => ({
  YearView: () => null,
}));

import { HourlyViewModal } from "./HourlyViewModal";

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
        tasks={[]}
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
});
