import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { DailyAdventurePanel } from "@/components/companion/DailyAdventurePanel";

const mocks = vi.hoisted(() => ({
  tasks: [] as Array<Record<string, unknown>>,
  thread: null as Record<string, unknown> | null,
  previousThread: null as Record<string, unknown> | null,
  saveThread: vi.fn(),
  markCompleted: vi.fn(),
  updateAdventure: vi.fn(),
  resolveAdventure: vi.fn(),
  addTask: vi.fn(),
  moveTaskToDateAsync: vi.fn(),
  awardCompanionAttribute: vi.fn(),
}));

vi.mock("@/hooks/useDailyTasks", () => ({
  useDailyTasks: () => ({
    tasks: mocks.tasks,
    isLoading: false,
    addTask: mocks.addTask,
    moveTaskToDateAsync: mocks.moveTaskToDateAsync,
  }),
}));

vi.mock("@/hooks/useExternalCalendarEvents", () => ({
  useExternalCalendarEvents: () => ({ events: [], connectedProviderCount: 0 }),
}));

vi.mock("@/hooks/useCompanionAttributes", () => ({
  useCompanionAttributes: () => ({ awardCompanionAttribute: mocks.awardCompanionAttribute }),
}));

vi.mock("@/hooks/useDailyMissionThread", () => ({
  useDailyMissionThread: () => ({
    thread: mocks.thread,
    previousThread: mocks.previousThread,
    isLoading: false,
    error: null,
    retry: vi.fn(),
    saveThread: mocks.saveThread,
    isSaving: false,
    markCompleted: mocks.markCompleted,
    updateAdventure: mocks.updateAdventure,
    isUpdatingAdventure: false,
    resolveAdventure: mocks.resolveAdventure,
    isResolvingAdventure: false,
  }),
}));

vi.mock("@/utils/timezone", () => ({
  getEffectiveMissionDate: () => "2026-08-10",
}));

const agendaTask = {
  id: "11111111-1111-4111-8111-111111111111",
  task_text: "Send the launch notes",
  task_date: "2026-08-10",
  completed: false,
  estimated_duration: 20,
  priority: "high",
  difficulty: "easy",
  scheduled_time: null,
  is_main_quest: false,
  category: null,
  epic_id: null,
};

describe("DailyAdventurePanel", () => {
  beforeEach(() => {
    mocks.tasks = [agendaTask];
    mocks.thread = null;
    mocks.previousThread = null;
    vi.clearAllMocks();
    mocks.saveThread.mockResolvedValue({});
    mocks.markCompleted.mockResolvedValue({});
    mocks.updateAdventure.mockResolvedValue({});
    mocks.resolveAdventure.mockResolvedValue({});
    mocks.addTask.mockResolvedValue({ id: "created-task" });
    mocks.moveTaskToDateAsync.mockResolvedValue({});
    mocks.awardCompanionAttribute.mockResolvedValue({ wasDuplicate: false });
  });

  it("turns a morning story decision into a real agenda quest and companion reaction", async () => {
    const onReaction = vi.fn();
    render(<DailyAdventurePanel companionName="Nova" currentStage={8} onReaction={onReaction} />);

    expect(screen.getAllByRole("button")).toHaveLength(3);
    fireEvent.click(screen.getByRole("button", {
      name: /seal the open rift|recover the lost signal|clear the orbital debris/i,
    }));

    await waitFor(() => expect(mocks.saveThread).toHaveBeenCalledTimes(1));
    expect(mocks.saveThread.mock.calls[0][0]).toMatchObject({
      recommendation: {
        intention: "finish",
        primaryTaskId: agendaTask.id,
        primaryTaskTitle: agendaTask.task_text,
      },
      adventureState: {
        version: 1,
        morningChoice: { key: expect.any(String) },
      },
    });
    expect(onReaction).toHaveBeenCalledWith(expect.objectContaining({
      promptKey: "daily-adventure:2026-08-10:opening",
      eventType: "play",
    }));
  });

  it("creates a small fallback quest when the agenda is empty", async () => {
    mocks.tasks = [];
    render(<DailyAdventurePanel companionName="Nova" currentStage={8} onReaction={vi.fn()} />);

    fireEvent.click(screen.getAllByRole("button")[0]);

    await waitFor(() => expect(mocks.addTask).toHaveBeenCalledTimes(1));
    expect(mocks.saveThread.mock.calls[0][0].recommendation.primaryTaskId).toBe("created-task");
  });

  it("advances the story automatically when its linked quest is completed", async () => {
    mocks.tasks = [{ ...agendaTask, completed: true }];
    mocks.thread = {
      id: "thread-1",
      status: "active",
      mission_date: "2026-08-10",
      created_at: "2026-08-10T08:00:00.000Z",
      intention_key: "finish",
      intention_label: "Finish something",
      primary_task_id: agendaTask.id,
      primary_task_title: agendaTask.task_text,
      primary_task_duration_minutes: 20,
      optional_task_ids: [],
      optional_task_titles: [],
      suggested_window_label: null,
      adventure_state: {},
      completed_at: null,
    };

    render(<DailyAdventurePanel companionName="Nova" currentStage={8} onReaction={vi.fn()} />);

    await waitFor(() => expect(mocks.markCompleted).toHaveBeenCalledTimes(1));
    expect(screen.getByText(/Daily Adventure · Mission Complete/i)).toBeInTheDocument();
  });
});
