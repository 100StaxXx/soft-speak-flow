import type { ReactNode } from "react";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { format } from "date-fns";
import { describe, expect, it, vi } from "vitest";

import { DesktopWeekPlanner } from "./DesktopWeekPlanner";
import type { DailyTask } from "@/services/dailyTasksRemote";

vi.mock("@/features/tasks/components/ProgressRing", () => ({
  ProgressRing: ({ percent }: { percent: number }) => <div data-testid="progress-ring">{percent}</div>,
}));

vi.mock("@/hooks/useJourneysCompanionVisual", () => ({
  useJourneysCompanionVisual: () => ({
    companionLabel: "Nova",
    imageUrl: "/placeholder-companion.svg",
    focalX: null,
    focalY: null,
    element: "fire",
    usesPortraitShell: false,
  }),
}));

vi.mock("@/components/JourneyPathDrawer", () => ({
  JourneyPathDrawer: ({ children }: { children: ReactNode }) => (
    <div data-testid="mock-journey-path-drawer">{children}</div>
  ),
}));

const selectedDate = new Date(2026, 2, 31, 12, 0, 0, 0);

const baseTask = (overrides: Partial<DailyTask> = {}): DailyTask => ({
  id: "task-1",
  user_id: "user-1",
  task_text: "Week quest",
  difficulty: "medium",
  xp_reward: 20,
  task_date: "2026-03-31",
  completed: false,
  completed_at: null,
  is_main_quest: false,
  scheduled_time: "09:00",
  estimated_duration: 30,
  recurrence_pattern: null,
  recurrence_days: null,
  recurrence_month_days: null,
  recurrence_custom_period: null,
  recurrence_end_date: null,
  is_recurring: false,
  reminder_enabled: false,
  reminder_minutes_before: null,
  reminder_sent: false,
  parent_template_id: null,
  category: null,
  is_bonus: false,
  created_at: "2026-03-31T08:00:00.000Z",
  priority: null,
  is_top_three: false,
  actual_time_spent: null,
  ai_generated: false,
  context_id: null,
  source: "manual",
  habit_source_id: null,
  epic_id: null,
  epic_title: null,
  sort_order: null,
  contact_id: null,
  auto_log_interaction: false,
  contact: null,
  image_url: null,
  attachments: [],
  notes: null,
  location: null,
  subtasks: [],
  ...overrides,
});

describe("DesktopWeekPlanner", () => {
  it("renders all seven days plus compact desktop header controls", () => {
    const onPlannerModeChange = vi.fn();

    render(
      <DesktopWeekPlanner
        selectedDate={selectedDate}
        tasks={[]}
        plannerMode="week"
        onDateSelect={vi.fn()}
        onPlannerModeChange={onPlannerModeChange}
        onToggle={vi.fn()}
        onAddQuest={vi.fn()}
        onOpenMonthView={vi.fn()}
      />,
    );

    expect(screen.getByTestId("desktop-week-day-2026-03-29")).toBeInTheDocument();
    expect(screen.getByTestId("desktop-week-day-2026-04-04")).toBeInTheDocument();
    expect(screen.getByTestId("desktop-week-planner-grid")).toHaveClass("min-w-0");
    expect(screen.getByTestId("desktop-week-header-grid")).toHaveStyle({
      gridTemplateColumns: "72px repeat(7, minmax(0, 1fr))",
    });
    expect(screen.getByTestId("desktop-week-hour-6")).toBeInTheDocument();
    expect(screen.getByRole("group", { name: /desktop planner mode/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Today" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Add quest" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Start voice capture" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Day" }));
    expect(onPlannerModeChange).toHaveBeenCalledWith("day");
  }, 15000);

  it("routes the desktop quick capture controls through the add and voice callbacks", () => {
    const onAddQuest = vi.fn();
    const onVoiceAddQuest = vi.fn();

    render(
      <DesktopWeekPlanner
        selectedDate={selectedDate}
        tasks={[]}
        plannerMode="week"
        onDateSelect={vi.fn()}
        onPlannerModeChange={vi.fn()}
        onToggle={vi.fn()}
        onAddQuest={onAddQuest}
        onVoiceAddQuest={onVoiceAddQuest}
        onOpenMonthView={vi.fn()}
      />,
    );

    const addButton = screen.getByRole("button", { name: "Add quest" });
    const voiceButton = screen.getByRole("button", { name: "Start voice capture" });

    fireEvent.click(addButton);
    fireEvent.click(voiceButton);

    expect(onAddQuest).toHaveBeenCalledTimes(1);
    expect(onVoiceAddQuest).toHaveBeenCalledTimes(1);
    expect(addButton).toHaveAttribute("data-tour", "add-quest-fab");
  });

  it("places timed tasks into hour rows and keeps cards title-only until clicked", () => {
    render(
      <DesktopWeekPlanner
        selectedDate={selectedDate}
        tasks={[
          baseTask({
            id: "timed-task",
            task_text: "Morning check-in",
            task_date: "2026-03-31",
            scheduled_time: "08:00",
          }),
          baseTask({
            id: "anytime-task",
            task_text: "Loose planning",
            task_date: "2026-03-31",
            scheduled_time: null,
          }),
          baseTask({
            id: "other-day-task",
            task_text: "Wednesday review",
            task_date: "2026-04-01",
            scheduled_time: "10:00",
          }),
        ]}
        onDateSelect={vi.fn()}
        onToggle={vi.fn()}
        onAddQuest={vi.fn()}
      />,
    );

    const timedCard = screen.getByTestId("desktop-week-task-timed-task");
    expect(timedCard).toBeInTheDocument();
    expect(timedCard).toHaveAttribute("data-quest-card-shell", "true");
    expect(timedCard).toHaveClass("journeys-quest-card-shell");
    expect(timedCard).not.toHaveClass("journeys-quest-card-shell--readable");
    expect(within(screen.getByTestId("desktop-week-anytime-2026-03-31")).getByText("Loose planning")).toBeInTheDocument();
    expect(screen.getByText("Wednesday review")).toBeInTheDocument();
    expect(within(timedCard).queryByText("8:00 AM")).not.toBeInTheDocument();
    expect(within(timedCard).queryByText("+20 XP")).not.toBeInTheDocument();
  });

  it("adds the readable shell class when readable quest cards are enabled", () => {
    render(
      <DesktopWeekPlanner
        selectedDate={selectedDate}
        tasks={[
          baseTask({
            id: "readable-task",
            task_text: "Readable week quest",
            task_date: "2026-03-31",
            scheduled_time: "08:00",
          }),
        ]}
        readableQuestCardsEnabled
        onDateSelect={vi.fn()}
        onToggle={vi.fn()}
        onAddQuest={vi.fn()}
      />,
    );

    const readableCard = screen.getByTestId("desktop-week-task-readable-task");
    expect(readableCard).toHaveClass(
      "journeys-quest-card-shell",
      "journeys-quest-card-shell--readable",
    );
    expect(readableCard).not.toHaveClass("border-white/10");
    expect(readableCard).not.toHaveClass("bg-white/[0.04]");
  });

  it("marks campaign rituals in the week scheduler task cards", () => {
    render(
      <DesktopWeekPlanner
        selectedDate={selectedDate}
        tasks={[
          baseTask({
            id: "campaign-ritual",
            task_text: "Portfolio work",
            scheduled_time: "19:00",
            estimated_duration: 60,
            habit_source_id: "habit-portfolio",
            epic_id: "epic-portfolio",
            epic_title: "Build Portfolio Website",
          }),
        ]}
        onDateSelect={vi.fn()}
        onToggle={vi.fn()}
        onAddQuest={vi.fn()}
      />,
    );

    const ritualCard = screen.getByTestId("desktop-week-task-campaign-ritual");
    expect(ritualCard).toHaveClass(
      "campaign-ritual-card",
      "border-primary/35",
      "bg-primary/[0.08]",
    );
    expect(within(ritualCard).getByText("Portfolio work")).toBeInTheDocument();
    expect(within(ritualCard).getByText("Campaign Ritual - Build Portfolio Website")).toBeInTheDocument();
  });

  it("keeps readable campaign rituals on the readable shell treatment when active", async () => {
    render(
      <DesktopWeekPlanner
        selectedDate={selectedDate}
        tasks={[
          baseTask({
            id: "readable-campaign-ritual",
            task_text: "Portfolio launch ritual",
            scheduled_time: "19:00",
            estimated_duration: 60,
            habit_source_id: "habit-portfolio",
            epic_id: "epic-portfolio",
            epic_title: "Build Portfolio Website",
          }),
        ]}
        readableQuestCardsEnabled
        onDateSelect={vi.fn()}
        onToggle={vi.fn()}
        onAddQuest={vi.fn()}
      />,
    );

    const ritualCard = screen.getByTestId("desktop-week-task-readable-campaign-ritual");
    expect(ritualCard).toHaveClass(
      "campaign-ritual-card",
      "journeys-quest-card-shell--readable",
    );
    expect(ritualCard).not.toHaveClass("border-primary/35");
    expect(ritualCard).not.toHaveClass("bg-primary/[0.08]");
    expect(ritualCard).not.toHaveClass("border-white/10");
    expect(ritualCard).not.toHaveClass("bg-white/[0.04]");

    fireEvent.click(screen.getByTestId("desktop-week-task-button-readable-campaign-ritual"));

    await waitFor(() => {
      expect(screen.getByTestId("desktop-quest-popover-readable-campaign-ritual")).toBeInTheDocument();
    });

    expect(ritualCard).toHaveClass("journeys-quest-card-shell--active");
    expect(ritualCard).not.toHaveClass("border-primary/40");
    expect(ritualCard).not.toHaveClass("bg-primary/[0.08]");
  });

  it("uses the mac fallback duration for timed task height when duration is missing", () => {
    render(
      <DesktopWeekPlanner
        selectedDate={selectedDate}
        tasks={[
          baseTask({
            id: "missing-duration-task",
            task_text: "Fallback duration quest",
            estimated_duration: null,
          }),
        ]}
        timedTaskDurationFallbackMinutes={30}
        onDateSelect={vi.fn()}
        onToggle={vi.fn()}
        onAddQuest={vi.fn()}
      />,
    );

    const taskWrapper = screen.getByTestId("desktop-week-task-missing-duration-task").parentElement;
    expect(taskWrapper).toBeTruthy();
    expect(taskWrapper).toHaveStyle({ height: "42px" });
  });

  it("keeps explicit durations proportional in the timed week grid", () => {
    render(
      <DesktopWeekPlanner
        selectedDate={selectedDate}
        tasks={[
          baseTask({
            id: "short-task",
            task_text: "Short quest",
            estimated_duration: 30,
          }),
          baseTask({
            id: "long-task",
            task_text: "Long quest",
            scheduled_time: "11:00",
            estimated_duration: 90,
          }),
        ]}
        timedTaskDurationFallbackMinutes={30}
        onDateSelect={vi.fn()}
        onToggle={vi.fn()}
        onAddQuest={vi.fn()}
      />,
    );

    const shortTaskWrapper = screen.getByTestId("desktop-week-task-short-task").parentElement;
    const longTaskWrapper = screen.getByTestId("desktop-week-task-long-task").parentElement;
    expect(shortTaskWrapper).toBeTruthy();
    expect(longTaskWrapper).toBeTruthy();
    expect(shortTaskWrapper).toHaveStyle({ height: "42px" });
    expect(Number.parseFloat(longTaskWrapper?.style.height || "0")).toBeCloseTo(126, 5);
  });

  it("hides the anytime row when requested for a mac session", () => {
    render(
      <DesktopWeekPlanner
        selectedDate={selectedDate}
        hideAnytimeRow
        tasks={[
          baseTask({
            id: "timed-task",
            task_text: "Morning check-in",
            task_date: "2026-03-31",
            scheduled_time: "08:00",
          }),
          baseTask({
            id: "anytime-task",
            task_text: "Loose planning",
            task_date: "2026-03-31",
            scheduled_time: null,
          }),
        ]}
        onDateSelect={vi.fn()}
        onToggle={vi.fn()}
        onAddQuest={vi.fn()}
      />,
    );

    expect(screen.getByTestId("desktop-week-task-timed-task")).toBeInTheDocument();
    expect(screen.queryByText("Anytime")).not.toBeInTheDocument();
    expect(screen.queryByTestId("desktop-week-anytime-2026-03-31")).not.toBeInTheDocument();
    expect(screen.queryByText("Loose planning")).not.toBeInTheDocument();
  });

  it("renders weekly campaign summaries as accessible drawer trigger buttons", () => {
    const onOpenCampaigns = vi.fn();

    render(
      <DesktopWeekPlanner
        selectedDate={selectedDate}
        tasks={[
          baseTask({
            id: "ritual-complete",
            task_text: "Morning lift",
            completed: true,
            habit_source_id: "habit-lift",
            epic_id: "epic-summer",
          }),
          baseTask({
            id: "ritual-open",
            task_text: "Protein prep",
            completed: false,
            habit_source_id: "habit-protein",
            epic_id: "epic-summer",
            scheduled_time: null,
          }),
        ]}
        activeEpics={[
          {
            id: "epic-summer",
            title: "Summer Gains",
            description: "Build consistent strength.",
            progress_percentage: 25,
            target_days: 60,
            start_date: "2026-03-01",
            end_date: "2026-04-30",
            epic_habits: [],
          },
        ]}
        onDateSelect={vi.fn()}
        onToggle={vi.fn()}
        onAddQuest={vi.fn()}
        onOpenCampaigns={onOpenCampaigns}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Open campaigns page" }));
    expect(onOpenCampaigns).toHaveBeenCalledTimes(1);

    const campaignButton = screen.getByRole("button", { name: "Open Summer Gains campaign" });

    expect(campaignButton).toBeInTheDocument();
    expect(campaignButton).toHaveAttribute("type", "button");
    expect(screen.getByTestId("mock-journey-path-drawer")).toContainElement(campaignButton);
    expect(within(campaignButton).getByText("Summer Gains")).toBeInTheDocument();
    expect(within(campaignButton).getByText("1/2 rituals completed this week")).toBeInTheDocument();
    expect(within(campaignButton).getByText("25%")).toBeInTheDocument();

    fireEvent.click(campaignButton);
  });

  it("keeps checkbox, popover details, double-click edit, and day selection wired correctly", async () => {
    const onDateSelect = vi.fn();
    const onToggle = vi.fn();
    const onUndoToggle = vi.fn();
    const onEditQuest = vi.fn();
    const onDeleteQuest = vi.fn();
    const onMoveQuestToNextDay = vi.fn();
    const onSendToCalendar = vi.fn();

    const completedTask = baseTask({
      id: "completed-task",
      task_text: "Completed quest",
      completed: true,
    });
    const editableTask = baseTask({
      id: "editable-task",
      task_text: "Editable quest",
      scheduled_time: "07:30",
      notes: "Discuss roadmap",
    });

    render(
      <DesktopWeekPlanner
        selectedDate={selectedDate}
        tasks={[completedTask, editableTask]}
        onDateSelect={onDateSelect}
        onToggle={onToggle}
        onAddQuest={vi.fn()}
        onUndoToggle={onUndoToggle}
        onEditQuest={onEditQuest}
        onDeleteQuest={onDeleteQuest}
        onMoveQuestToNextDay={onMoveQuestToNextDay}
        onSendToCalendar={onSendToCalendar}
        hasCalendarLink={(taskId) => taskId === "editable-task"}
      />,
    );

    fireEvent.click(screen.getByLabelText("Mark task as incomplete"));
    expect(onUndoToggle).toHaveBeenCalledWith("completed-task", 20);

    fireEvent.click(screen.getByLabelText("Mark task as complete"));
    expect(onToggle).toHaveBeenCalledWith("editable-task", true, 20);

    expect(screen.queryByText("Edit")).not.toBeInTheDocument();
    fireEvent.click(screen.getByTestId("desktop-week-task-button-editable-task"));

    await waitFor(() => {
      expect(screen.getByTestId("desktop-quest-popover-editable-task")).toBeInTheDocument();
    });

    expect(screen.getByTestId("desktop-week-task-editable-task")).toHaveClass(
      "journeys-quest-card-shell",
      "journeys-quest-card-shell--active",
    );

    expect(screen.getByText("Discuss roadmap")).toBeInTheDocument();
    fireEvent.click(screen.getByText("Edit"));
    expect(onEditQuest).toHaveBeenCalledWith(expect.objectContaining({ id: "editable-task" }));

    fireEvent.click(screen.getByTestId("desktop-week-task-button-editable-task"));
    await waitFor(() => {
      expect(screen.getByTestId("desktop-quest-popover-editable-task")).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText("Re-send to calendar"));
    expect(onSendToCalendar).toHaveBeenCalledWith("editable-task");

    fireEvent.click(screen.getByTestId("desktop-week-task-button-editable-task"));
    await waitFor(() => {
      expect(screen.getByTestId("desktop-quest-popover-editable-task")).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText("Move to tomorrow"));
    expect(onMoveQuestToNextDay).toHaveBeenCalledWith(expect.objectContaining({ id: "editable-task" }));

    fireEvent.click(screen.getByTestId("desktop-week-task-button-editable-task"));
    await waitFor(() => {
      expect(screen.getByTestId("desktop-quest-popover-editable-task")).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText("Delete"));
    expect(onDeleteQuest).toHaveBeenCalledWith(expect.objectContaining({ id: "editable-task" }));

    fireEvent.doubleClick(screen.getByTestId("desktop-week-task-button-editable-task"));
    expect(onEditQuest).toHaveBeenCalledWith(expect.objectContaining({ id: "editable-task" }));

    const wednesdayColumn = screen.getByTestId("desktop-week-day-2026-04-01");
    fireEvent.click(within(wednesdayColumn).getByRole("button"));

    expect(onDateSelect).toHaveBeenCalledWith(expect.any(Date));
    const selectedDateArg = onDateSelect.mock.calls.at(-1)?.[0] as Date;
    expect(format(selectedDateArg, "yyyy-MM-dd")).toBe("2026-04-01");
  });
});
