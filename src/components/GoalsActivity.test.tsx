import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { GoalsActivity } from "./GoalsActivity";
const mocks = vi.hoisted(() => ({ navigate: vi.fn(), toggle: vi.fn(), remove: vi.fn(), chapter: vi.fn() }));
vi.mock("react-router-dom", () => ({ useNavigate: () => mocks.navigate }));
vi.mock("@/hooks/useAuth", () => ({ useAuth: () => ({ user: { id: "goals-test" } }) }));
vi.mock("@/hooks/useProfile", () => ({ useProfile: () => ({ profile: { timezone: "America/Los_Angeles" } }) }));
vi.mock("@/utils/timezone", () => ({ getEffectiveMissionDate: () => "2026-09-19" }));
vi.mock("@/hooks/useTasksQuery", () => ({ useTasksQuery: () => ({ tasks: [], completedCount: 2, totalCount: 3 }) }));
vi.mock("@/hooks/useStreakMultiplier", () => ({ useStreakMultiplier: () => ({ currentStreak: 4 }) }));
vi.mock("@/hooks/useExternalCalendarEvents", () => ({ useExternalCalendarEvents: () => ({ events: [
  { id: "today", taskDate: "2026-09-19" }, { id: "tomorrow", taskDate: "2026-09-20" },
], connectedProviderCount: 2 }) }));
vi.mock("@/hooks/useInboxTasks", () => ({ useInboxTasks: () => ({
  inboxTasks: [{ id: "inbox-1", task_text: "Draft plan", completed: false }], isLoading: false,
  toggleInboxTask: mocks.toggle, deleteInboxTask: mocks.remove,
}) }));
vi.mock("@/components/DailyMissionThreadCard", () => ({ DailyMissionThreadCard: (props: any) => {
  mocks.chapter(props); return <button onClick={() => props.onAddQuest({ title: "Focus", durationMinutes: 25 })}>Add chapter quest</button>;
} }));
vi.mock("@/utils/haptics", () => ({ haptics: { light: vi.fn() } }));

describe("Goals activity", () => {
  beforeEach(() => { vi.clearAllMocks(); localStorage.clear(); });
  it("keeps progress and the inbox without a daily chapter", () => {
    render(<GoalsActivity />);
    expect(screen.getByText("2 of 3 quests complete today")).toBeInTheDocument();
    expect(screen.getByText("4 day streak")).toBeInTheDocument();
    expect(screen.getByText("Draft plan")).toBeInTheDocument();
    expect(mocks.chapter).not.toHaveBeenCalled();
    expect(screen.queryByText("Add chapter quest")).not.toBeInTheDocument();
  });
  it("keeps inbox completion working", () => {
    render(<GoalsActivity />); fireEvent.click(screen.getByRole("button", { name: "Mark quest complete" }));
    expect(mocks.toggle).toHaveBeenCalledWith({ taskId: "inbox-1", completed: true });
  });
  it("keeps the Inbox collapsed when the Goals tab remounts", () => {
    const first = render(<GoalsActivity />);
    fireEvent.click(screen.getByRole("button", { name: /Collapse inbox section/ }));
    first.unmount();
    render(<GoalsActivity />);
    expect(screen.getByRole("button", { name: /Expand inbox section/ })).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByText("Draft plan")).not.toBeInTheDocument();
  });
});
vi.mock('@/components/calendar/ConnectedTasks', () => ({ ConnectedTasks: () => null }));
