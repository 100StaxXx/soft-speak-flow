import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { DailyMissionThreadCard } from "@/components/DailyMissionThreadCard";

const saveThread = vi.fn();
const markCompleted = vi.fn();
const linkPrimaryTask = vi.fn();
const reflectOnMission = vi.fn();
const clearThread = vi.fn();
const awardCompanionAttribute = vi.fn();
const show = vi.fn();

let thread: Record<string, unknown> | null = null;
let previousThread: Record<string, unknown> | null = null;

vi.mock("@/hooks/useDailyMissionThread", () => ({
  useDailyMissionThread: () => ({
    thread,
    previousThread,
    isLoading: false,
    error: null,
    retry: vi.fn(),
    saveThread,
    isSaving: false,
    markCompleted,
    isCompleting: false,
    linkPrimaryTask,
    isLinking: false,
    reflectOnMission,
    isReflecting: false,
    clearThread,
    isClearing: false,
  }),
}));

vi.mock("@/hooks/useCompanion", () => ({
  useCompanion: () => ({ companion: { id: "companion-1" } }),
}));

vi.mock("@/hooks/useCompanionAttributes", () => ({
  useCompanionAttributes: () => ({ awardCompanionAttribute }),
}));

vi.mock("@/contexts/TalkPopupContext", () => ({
  useTalkPopupContextSafe: () => ({
    show,
    replaceCurrent: vi.fn(),
    dismiss: vi.fn(),
    isVisible: false,
  }),
}));

const task = {
  id: "11111111-1111-4111-8111-111111111111",
  user_id: "user-1",
  task_text: "Send the final launch notes",
  task_date: "2026-08-10",
  completed: false,
  completed_at: null,
  difficulty: "easy",
  xp_reward: 10,
  is_main_quest: false,
  scheduled_time: null,
  estimated_duration: 20,
  category: null,
  priority: "high",
  energy_type: null,
  habit_source_id: null,
  epic_id: null,
  epic_title: null,
  sort_order: 0,
  notes: null,
  is_recurring: false,
  recurrence_pattern: null,
  recurrence_days: null,
  recurrence_month_days: null,
  recurrence_custom_period: null,
  reminder_enabled: false,
  reminder_minutes_before: null,
  reminder_offsets_minutes: null,
  reminder_sent_at: null,
  start_reminder_sent_at: null,
  image_url: null,
  location: null,
  source: "manual",
  actual_time_spent: null,
  created_at: "2026-08-10T12:00:00.000Z",
  updated_at: "2026-08-10T12:00:00.000Z",
  recurrence_end_date: null,
  rolled_over_from_task_id: null,
  inbox_cleared_at: null,
  contact_id: null,
  created_by_user_id: null,
  original_creator_id: null,
  transferred_at: null,
  last_modified_by: null,
  estimated_duration_source: null,
  attachments: [],
  subtasks: [],
};

const renderCard = () => render(
  <DailyMissionThreadCard
    missionDate="2026-08-10"
    tasks={[task]}
    externalEvents={[]}
    connectedCalendarCount={0}
    onAddQuest={vi.fn()}
  />,
);

describe("DailyMissionThreadCard", () => {
  beforeEach(() => {
    thread = null;
    previousThread = null;
    vi.clearAllMocks();
    saveThread.mockResolvedValue({});
    markCompleted.mockResolvedValue({});
    linkPrimaryTask.mockResolvedValue({});
    reflectOnMission.mockResolvedValue({});
    clearThread.mockResolvedValue(undefined);
    awardCompanionAttribute.mockResolvedValue({ wasDuplicate: false });
    show.mockResolvedValue(undefined);
  });

  it("turns an intention into one specific agenda mission", async () => {
    renderCard();

    fireEvent.click(screen.getByRole("button", {
      name: /seal the open rift|recover the lost signal|clear the orbital debris/i,
    }));

    await waitFor(() => expect(saveThread).toHaveBeenCalledTimes(1));
    const input = saveThread.mock.calls[0][0];
    expect(input.recommendation.primaryTaskTitle).toBe("Send the final launch notes");
    expect(input.recommendation.intention).toBe("finish");
    expect(input.adventureState.morningChoice.label).toBeTruthy();
    expect(show).toHaveBeenCalledWith(expect.objectContaining({
      message: expect.stringContaining("Send the final launch notes"),
    }));
  });

  it("carries the previous chapter's reflection into today's opening", () => {
    previousThread = {
      id: "thread-previous",
      mission_date: "2026-08-09",
      status: "reflected",
      intention_label: "Finish something",
      reflection_label: "It cleared some space",
    };

    renderCard();

    expect(screen.getByText(
      /Yesterday you chose to finish something, and said “it cleared some space.”/i,
    )).toBeInTheDocument();
    expect(screen.getByText(/Nothing to make up for/i)).toBeInTheDocument();
  });

  it("renders the persisted mission and optional quests", () => {
    thread = {
      id: "thread-1",
      status: "active",
      intention_key: "progress",
      intention_label: "Make progress",
      primary_task_id: task.id,
      primary_task_title: task.task_text,
      primary_task_duration_minutes: 20,
      optional_task_titles: ["Review the checklist"],
      companion_ack: "Today’s move is clear.",
      calendar_summary: "This mission fits inside the open window.",
    };

    renderCard();

    expect(screen.getByRole("heading", { name: task.task_text })).toBeInTheDocument();
    expect(screen.getByText("Review the checklist")).toBeInTheDocument();
    expect(screen.getByText(/linked to your agenda/i)).toBeInTheDocument();
  });

  it("records the return answer after a completed mission", async () => {
    thread = {
      id: "thread-1",
      status: "completed",
      intention_key: "finish",
      intention_label: "Finish something",
      primary_task_id: task.id,
      primary_task_title: task.task_text,
      primary_task_duration_minutes: 20,
      optional_task_titles: [],
      companion_ack: "One loop closed.",
      calendar_summary: "The mission fit.",
    };

    renderCard();
    fireEvent.click(screen.getByRole("button", { name: "It cleared some space" }));

    await waitFor(() => expect(reflectOnMission).toHaveBeenCalledWith({
      key: "cleared_space",
      label: "It cleared some space",
    }));
    expect(show).toHaveBeenCalledWith({ message: "I’ll remember that closing the loop made room." });
  });
});
