import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { QuestSummary } from "./QuestSummary";

describe("Quest summary", () => {
  it("shows date, time range, notes, and an explicit edit action without editing on open", () => {
    const onEdit = vi.fn(); const onClose = vi.fn();
    render(<QuestSummary task={{ id: "q", task_text: "Focus", task_date: "2026-09-24", scheduled_time: "08:15:00", estimated_duration: 60, notes: "Bring notes", reminder_enabled: true, reminder_minutes_before: 15 }} onEdit={onEdit} onClose={onClose} />);
    expect(screen.getByRole("heading", { name: "Focus" })).toBeInTheDocument();
    expect(screen.getByText("Thursday, September 24, 2026")).toBeInTheDocument();
    expect(screen.getByText("8:15 AM – 9:15 AM (60 min)")).toBeInTheDocument();
    expect(screen.getByText("Bring notes")).toBeInTheDocument();
    expect(screen.getByText("15 minutes before")).toBeInTheDocument();
    expect(onEdit).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Edit quest" }));
    expect(onEdit).toHaveBeenCalledOnce();
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(onClose).toHaveBeenCalledOnce();
  });
  it("keeps untimed and all-day quests truthful", () => {
    const props = { onEdit: vi.fn(), onClose: vi.fn() };
    const { rerender } = render(<QuestSummary {...props} task={{ id: "q", task_text: "Inbox task" }} />);
    expect(screen.getByText("Not scheduled")).toBeInTheDocument();
    expect(screen.getByText("Inbox")).toBeInTheDocument();
    rerender(<QuestSummary {...props} task={{ id: "q", task_text: "Day task", task_date: "2026-09-24", scheduled_time: "00:00", estimated_duration: 1440 }} />);
    expect(screen.getByText("All day")).toBeInTheDocument();
    expect(screen.queryByText(/12:00 AM/)).not.toBeInTheDocument();
  });
});
