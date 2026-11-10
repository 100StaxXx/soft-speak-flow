import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useQuestScheduleGuard } from "./useQuestScheduleGuard";
import { loadQuestScheduleAvailability, type ScheduleAvailabilityOptions } from "@/services/questScheduleAvailability";
import type { QuestScheduleDraft } from "@/utils/questScheduleConflicts";
vi.mock("@/services/questScheduleAvailability", () => ({ loadQuestScheduleAvailability: vi.fn() }));
const options: ScheduleAvailabilityOptions = { userId: "user", connections: [], timezone: "UTC", cachedTasks: [], cachedEvents: [], excludedEventKeys: new Set() };
const draft: QuestScheduleDraft = { id: "new", task_text: "Read", task_date: "2026-10-05", scheduled_time: "09:30", estimated_duration: 30 };
const snapshot = { tasks: [{ ...draft, id: "other", task_text: "Workout", scheduled_time: "09:00", estimated_duration: 60 }], events: [], incomplete: false };
function Harness({ onSave, input = draft, userId = "user" }: { onSave: (value: QuestScheduleDraft) => void; input?: QuestScheduleDraft; userId?: string }) {
  const { checkSchedule, conflictDialog } = useQuestScheduleGuard({ ...options, userId, scopeKey: "/journeys" });
  return <><button onClick={async () => { const result = await checkSchedule(input); if (result) onSave(result); }}>Save quest</button>{conflictDialog}</>;
}
beforeEach(() => { vi.mocked(loadQuestScheduleAvailability).mockReset().mockResolvedValue(snapshot); });
describe("quest schedule confirmation", () => {
  it("does not save until Keep this time is chosen", async () => {
    const save = vi.fn(); render(<Harness onSave={save} />); fireEvent.click(screen.getByText("Save quest"));
    await screen.findByText("A little overlap"); expect(save).not.toHaveBeenCalled();
    fireEvent.click(screen.getByText("Keep this time")); await waitFor(() => expect(save).toHaveBeenCalledWith(draft));
  });
  it("saves the offered next time only on explicit selection", async () => {
    const save = vi.fn(); render(<Harness onSave={save} />); fireEvent.click(screen.getByText("Save quest"));
    fireEvent.click(await screen.findByRole("button", { name: /Next available time/ }));
    await waitFor(() => expect(save).toHaveBeenCalledExactlyOnceWith({ ...draft, scheduled_time: "10:00" }));
  });
  it("goes back without saving", async () => {
    const save = vi.fn(); render(<Harness onSave={save} />); fireEvent.click(screen.getByText("Save quest"));
    fireEvent.click(await screen.findByText("Go back")); expect(save).not.toHaveBeenCalled();
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
  });
  it("allows a conflict-free time without a confirmation", async () => {
    vi.mocked(loadQuestScheduleAvailability).mockResolvedValue({ tasks: [], events: [], incomplete: false });
    const save = vi.fn(); render(<Harness onSave={save} />); fireEvent.click(screen.getByText("Save quest"));
    await waitFor(() => expect(save).toHaveBeenCalledExactlyOnceWith(draft));
  });
  it("does not claim a safe next time when a provider could not be checked", async () => {
    vi.mocked(loadQuestScheduleAvailability).mockResolvedValue({ ...snapshot, incomplete: true });
    const save = vi.fn(); render(<Harness onSave={save} />); fireEvent.click(screen.getByText("Save quest"));
    await screen.findByText(/Some schedule information/);
    expect(screen.queryByRole("button", { name: /Next available/ })).not.toBeInTheDocument();
    expect(save).not.toHaveBeenCalled();
  });
  it("ignores a late lookup after cancellation", async () => {
    let finish!: (value: typeof snapshot) => void;
    vi.mocked(loadQuestScheduleAvailability).mockReturnValue(new Promise(resolve => { finish = resolve; }));
    const save = vi.fn(); render(<Harness onSave={save} />); fireEvent.click(screen.getByText("Save quest"));
    fireEvent.click(screen.getByText("Cancel"));
    await act(async () => finish(snapshot));
    expect(save).not.toHaveBeenCalled(); expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
  });
  it("cancels a pending lookup when the account changes", async () => {
    let finish!: (value: typeof snapshot) => void;
    vi.mocked(loadQuestScheduleAvailability).mockReturnValue(new Promise(resolve => { finish = resolve; }));
    const save = vi.fn(); const view = render(<Harness onSave={save} />); fireEvent.click(screen.getByText("Save quest"));
    view.rerender(<Harness onSave={save} userId="different" />);
    await act(async () => finish(snapshot)); expect(save).not.toHaveBeenCalled();
  });
  it("does not look up untimed or inbox quests", async () => {
    const save = vi.fn(); render(<Harness onSave={save} input={{ ...draft, task_date: null, scheduled_time: null }} />);
    fireEvent.click(screen.getByText("Save quest")); await waitFor(() => expect(save).toHaveBeenCalled());
    expect(loadQuestScheduleAvailability).not.toHaveBeenCalled();
  });
});
