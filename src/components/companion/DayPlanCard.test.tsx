import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { CompanionDayPlan } from "@/types/companionPlanner";

import { DayPlanCard } from "./DayPlanCard";

const buildDayPlan = (
  overrides: Partial<CompanionDayPlan> = {},
): CompanionDayPlan => ({
  id: null,
  date: "2026-04-28",
  status: "draft",
  updatedAt: "2026-04-28T09:00:00.000Z",
  blocks: [
    {
      id: "block-1",
      proposalId: "prop-1",
      questId: null,
      title: "Outline launch email",
      startTime: "10:00",
      durationMinutes: 45,
      energyType: "deep",
      source: "optimization",
      reasoning: "Open mid-morning slot fits a focused writing block.",
    },
    {
      id: "block-2",
      proposalId: "prop-2",
      questId: null,
      title: "Reply to support queue",
      startTime: "13:30",
      durationMinutes: 20,
      energyType: "admin",
      source: "optimization",
      reasoning: "A quick admin pass keeps momentum going.",
    },
  ],
  ...overrides,
});

describe("DayPlanCard", () => {
  it("renders blocks with title, time, and reasoning", () => {
    render(
      <DayPlanCard
        dayPlan={buildDayPlan()}
        committed={false}
        committing={false}
        onCommit={() => {}}
      />,
    );

    expect(screen.getByText("Outline launch email")).toBeInTheDocument();
    expect(
      screen.getByText("Open mid-morning slot fits a focused writing block."),
    ).toBeInTheDocument();
    expect(screen.getByText("Reply to support queue")).toBeInTheDocument();
    expect(screen.getByText("10:00 AM")).toBeInTheDocument();
    expect(screen.getByText("1:30 PM")).toBeInTheDocument();
  });

  it("shows the lock-in CTA in draft state and triggers commit on click", () => {
    const onCommit = vi.fn();
    render(
      <DayPlanCard
        dayPlan={buildDayPlan()}
        committed={false}
        committing={false}
        onCommit={onCommit}
      />,
    );

    const button = screen.getByTestId("companion-day-plan-commit");
    expect(button).toHaveTextContent(/Lock in plan/i);
    fireEvent.click(button);
    expect(onCommit).toHaveBeenCalledTimes(1);
  });

  it("disables the commit button while committing", () => {
    render(
      <DayPlanCard
        dayPlan={buildDayPlan()}
        committed={false}
        committing
        onCommit={() => {}}
      />,
    );

    const button = screen.getByTestId("companion-day-plan-commit");
    expect(button).toBeDisabled();
    expect(button).toHaveTextContent(/Locking in/i);
  });

  it("hides the commit button and shows locked-in chip when committed", () => {
    render(
      <DayPlanCard
        dayPlan={buildDayPlan({ status: "committed" })}
        committed
        committing={false}
        onCommit={() => {}}
      />,
    );

    expect(screen.queryByTestId("companion-day-plan-commit")).toBeNull();
    expect(screen.getByText(/Plan locked in/i)).toBeInTheDocument();
  });

  it("renders 'Flexible' for blocks without a startTime", () => {
    render(
      <DayPlanCard
        dayPlan={buildDayPlan({
          blocks: [
            {
              id: "block-flex",
              proposalId: null,
              questId: null,
              title: "Plan tomorrow",
              startTime: null,
              durationMinutes: 15,
              energyType: null,
              source: "optimization",
              reasoning: "",
            },
          ],
        })}
        committed={false}
        committing={false}
        onCommit={() => {}}
      />,
    );

    expect(screen.getByText("Flexible")).toBeInTheDocument();
  });

  it("flags overdue blocks with a 'Past time' badge and the overdue hint banner", () => {
    render(
      <DayPlanCard
        dayPlan={buildDayPlan({
          status: "committed",
          blocks: [
            {
              id: "block-1",
              proposalId: null,
              questId: "task-1",
              title: "Outline launch email",
              startTime: "10:00",
              durationMinutes: 45,
              energyType: "deep",
              source: "optimization",
              reasoning: "Open mid-morning slot.",
            },
            {
              id: "block-2",
              proposalId: null,
              questId: "task-2",
              title: "Future block",
              startTime: "16:00",
              durationMinutes: 30,
              energyType: "admin",
              source: "optimization",
              reasoning: "",
            },
          ],
        })}
        committed
        committing={false}
        onCommit={() => {}}
        nowMinutes={14 * 60}
      />,
    );

    expect(
      screen.getByTestId("companion-day-plan-overdue-hint"),
    ).toBeInTheDocument();
    expect(
      screen.getAllByTestId("companion-day-plan-overdue-badge"),
    ).toHaveLength(1);
  });

  it("does not flag overdue blocks for draft (uncommitted) plans", () => {
    render(
      <DayPlanCard
        dayPlan={buildDayPlan({
          blocks: [
            {
              id: "block-1",
              proposalId: null,
              questId: "task-1",
              title: "Outline launch email",
              startTime: "10:00",
              durationMinutes: 45,
              energyType: "deep",
              source: "optimization",
              reasoning: "Open mid-morning slot.",
            },
          ],
        })}
        committed={false}
        committing={false}
        onCommit={() => {}}
        nowMinutes={14 * 60}
      />,
    );

    expect(
      screen.queryByTestId("companion-day-plan-overdue-hint"),
    ).toBeNull();
    expect(
      screen.queryByTestId("companion-day-plan-overdue-badge"),
    ).toBeNull();
  });

  it("respects completedQuestIds and does not mark completed blocks as overdue", () => {
    render(
      <DayPlanCard
        dayPlan={buildDayPlan({
          status: "committed",
          blocks: [
            {
              id: "block-1",
              proposalId: null,
              questId: "task-1",
              title: "Outline launch email",
              startTime: "10:00",
              durationMinutes: 45,
              energyType: "deep",
              source: "optimization",
              reasoning: "",
            },
          ],
        })}
        committed
        committing={false}
        onCommit={() => {}}
        nowMinutes={14 * 60}
        completedQuestIds={new Set(["task-1"])}
      />,
    );

    expect(
      screen.queryByTestId("companion-day-plan-overdue-badge"),
    ).toBeNull();
  });
});
