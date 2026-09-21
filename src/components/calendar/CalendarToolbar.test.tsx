import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { CalendarToolbar, type CalendarView } from "./CalendarToolbar";

const setup = (view: CalendarView = "day", syncError: string | null = null) => {
  const props = { view, selectedDate: new Date("2026-09-19T12:00:00"), onViewChange: vi.fn(), onDateSelect: vi.fn(), onToday: vi.fn(), onAdd: vi.fn(), onManageCalendars: vi.fn(), onRefresh: vi.fn(), onInfo: vi.fn(), syncError };
  render(<CalendarToolbar {...props} />);
  return props;
};
describe("CalendarToolbar", () => {
  it("shows a compact month and exactly seven selectable dates", () => {
    const props = setup();
    expect(screen.getByRole("heading", { name: "September" })).toBeInTheDocument();
    expect(within(screen.getByTestId("journeys-mobile-date-strip")).getAllByRole("button")).toHaveLength(7);
    const selected = screen.getByRole("button", { name: "Saturday, September 19, 2026" });
    expect(selected).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(screen.getByRole("button", { name: "Monday, September 14, 2026" }));
    expect(props.onDateSelect).toHaveBeenCalledWith(new Date("2026-09-14T00:00:00"));
  });
  it("offers all four views with the selected view checked", () => {
    const props = setup();
    fireEvent.keyDown(screen.getByRole("button", { name: "Calendar view" }), { key: "ArrowDown" });
    expect(screen.getAllByRole("menuitemradio")).toHaveLength(4);
    expect(screen.getByRole("menuitemradio", { name: "Day" })).toHaveAttribute("aria-checked", "true");
    fireEvent.click(screen.getByRole("menuitemradio", { name: "3-Day" }));
    expect(props.onViewChange).toHaveBeenCalledWith("three-day");
  });
  it("keeps add and today available without a date card", () => {
    const props = setup();
    fireEvent.click(screen.getByRole("button", { name: "Add quest" }));
    fireEvent.click(screen.getByRole("button", { name: "Today" }));
    expect(props.onAdd).toHaveBeenCalledOnce();
    expect(props.onToday).toHaveBeenCalledOnce();
    expect(screen.queryByText("Connect")).not.toBeInTheDocument();
  });
  it("moves by three days in 3-Day view", () => {
    const props = setup("three-day");
    fireEvent.click(screen.getByRole("button", { name: "Next 3 days" }));
    expect(props.onDateSelect).toHaveBeenCalledWith(new Date("2026-09-22T12:00:00"));
  });
  it("moves by month and hides the redundant week strip in Month view", () => {
    const props = setup("month");
    fireEvent.click(screen.getByRole("button", { name: "Next month" }));
    expect(props.onDateSelect).toHaveBeenCalledWith(new Date("2026-10-19T12:00:00"));
    expect(screen.queryByTestId("journeys-mobile-date-strip")).not.toBeInTheDocument();
  });
  it("keeps connections in Calendar settings and surfaces actionable sync failures", () => {
    const props = setup("day", "Offline");
    fireEvent.click(screen.getByRole("status"));
    expect(props.onRefresh).toHaveBeenCalledOnce();
    fireEvent.keyDown(screen.getByRole("button", { name: "Calendar options" }), { key: "ArrowDown" });
    fireEvent.click(screen.getByRole("menuitem", { name: "Calendar settings" }));
    expect(props.onManageCalendars).toHaveBeenCalledOnce();
  });
});
