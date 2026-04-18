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
    expect(screen.getByTestId("desktop-week-hour-6")).toBeInTheDocument();
    expect(screen.getByRole("group", { name: /desktop planner mode/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Today" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Plan with companion/i })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Day" }));
    expect(onPlannerModeChange).toHaveBeenCalledWith("day");
  }, 15000);

  it("routes the compact companion launcher through the planner entry callback", () => {
    const onOpenCompanionPlanner = vi.fn();

    render(
      <DesktopWeekPlanner
        selectedDate={selectedDate}
        tasks={[]}
        plannerMode="week"
        onDateSelect={vi.fn()}
        onPlannerModeChange={vi.fn()}
        onToggle={vi.fn()}
        onAddQuest={vi.fn()}
        onOpenCompanionPlanner={onOpenCompanionPlanner}
        onOpenMonthView={vi.fn()}
      />,
    );

    const launcher = screen.getByRole("button", { name: /Plan with companion/i });
    fireEvent.click(launcher);

    expect(onOpenCompanionPlanner).toHaveBeenCalledTimes(1);
    expect(launcher).toHaveAttribute("data-tour", "add-quest-launcher");
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
    expect(within(screen.getByTestId("desktop-week-anytime-2026-03-31")).getByText("Loose planning")).toBeInTheDocument();
    expect(screen.getByText("Wednesday review")).toBeInTheDocument();
    expect(within(timedCard).queryByText("8:00 AM")).not.toBeInTheDocument();
    expect(within(timedCard).queryByText("+20 XP")).not.toBeInTheDocument();
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
