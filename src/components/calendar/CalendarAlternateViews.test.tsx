import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { CalendarAlternateViews, type CalendarDisplayTask } from "./CalendarAlternateViews";
import type { ExternalCalendarEvent } from "@/types/externalCalendar";
vi.mock("./ExternalEventDetails", () => ({ ExternalEventDetails: ({ event }: { event: ExternalCalendarEvent }) => <div data-testid="external-details">{event.title}</div> }));
const task = (id: string, time: string | null, date = "2026-09-30"): CalendarDisplayTask => ({ id, task_text: id, task_date: date, scheduled_time: time, estimated_duration: 60, completed: false, xp_reward: 10, difficulty: "easy", is_main_quest: false });
const props = (tasks: CalendarDisplayTask[] = []) => ({ selectedDate: new Date("2026-09-30T12:00:00"), tasks, externalEvents: [], onDateSelect: vi.fn(), onOpenDay: vi.fn(), onTaskClick: vi.fn(), onAdd: vi.fn() });
describe("Calendar alternate views", () => {
  it("renders three full days across a month boundary and keeps all 144 half-hour slots accessible", () => {
    const handlers = props([task("October appointment", "23:30", "2026-10-02")]);
    render(<CalendarAlternateViews view="three-day" {...handlers} />);
    expect(screen.getByRole("button", { name: "Wed 30" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Fri 2" })).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: /^Add quest/ })).toHaveLength(144);
    fireEvent.click(screen.getByRole("button", { name: "Add quest Oct 2 at 11:30 PM" }));
    expect(handlers.onAdd).toHaveBeenCalledWith(new Date("2026-10-02T12:00:00"), "23:30");
    expect(screen.getByTestId("three-day-scroll")).toHaveClass("overflow-y-auto", "min-h-0");
    expect(screen.getByTestId("three-day-event-October appointment").style.height).toBe("36px");
  });
  it("lays overlapping appointments in separate columns and opens the correct task", () => {
    const handlers = props([task("first", "09:00"), task("second", "09:30")]);
    render(<CalendarAlternateViews view="three-day" {...handlers} />);
    expect(screen.getByTestId("three-day-event-first").style.width).toBe("50%");
    expect(screen.getByTestId("three-day-event-second").style.left).toBe("50%");
    fireEvent.click(screen.getByRole("button", { name: "Open second" }));
    expect(handlers.onTaskClick).toHaveBeenCalledWith(handlers.tasks[1]);
  });
  it("preserves untimed tasks without inventing a time", () => {
    render(<CalendarAlternateViews view="three-day" {...props([task("Anytime", null)])} />);
    expect(screen.getByRole("button", { name: "Open Anytime" })).toBeInTheDocument();
    expect(screen.queryByTestId("three-day-event-Anytime")).not.toBeInTheDocument();
  });
  it("shows a seven-day agenda across a month boundary with no large empty state", () => {
    render(<CalendarAlternateViews view="agenda" {...props([task("Next month", "10:00", "2026-10-06")])} />);
    expect(screen.getByRole("button", { name: "Open Next month" })).toBeInTheDocument();
    expect(screen.queryByText("No tasks for this day")).not.toBeInTheDocument();
  });
  it("opens external event details without treating the event as an editable quest", () => {
    const event: ExternalCalendarEvent = { id: "remote", provider: "google", title: "Team meeting", taskDate: "2026-09-30", scheduledTime: "09:00", estimatedDuration: 60, isAllDay: false, startDate: "2026-09-30T09:00:00", endDate: "2026-09-30T10:00:00", calendarId: "work", calendarName: "Work", location: null, htmlLink: null };
    const handlers = props([{ ...task("remote", "09:00"), externalEvent: event }]);
    render(<CalendarAlternateViews view="agenda" {...handlers} />);
    fireEvent.click(screen.getByRole("button", { name: "Open remote" }));
    expect(screen.getByTestId("external-details")).toHaveTextContent("Team meeting");
    expect(handlers.onTaskClick).not.toHaveBeenCalled();
  });
  it("opens the selected day from the inline Month view", () => {
    const handlers = props();
    render(<CalendarAlternateViews view="month" {...handlers} />);
    fireEvent.click(screen.getByRole("button", { name: "Tuesday, September 15, 2026" }));
    expect(handlers.onOpenDay).toHaveBeenCalledWith(new Date("2026-09-15T00:00:00"));
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
  });
});
