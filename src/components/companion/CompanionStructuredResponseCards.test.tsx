import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type {
  CompanionStructuredResponse,
  CompanionSuggestedQuest,
} from "@/shared/companionStructuredOutput";

import { CompanionStructuredResponseCards } from "./CompanionStructuredResponseCards";

const baseIntent: CompanionStructuredResponse["intent"] = {
  intentType: "conversation",
  timeHorizon: "today",
  isRecurring: false,
  shouldCreateQuest: false,
  shouldPromptCampaign: false,
};

const createQuest = (
  overrides: Partial<CompanionSuggestedQuest> & {
    suggestionId: string;
    title: string;
  },
): CompanionSuggestedQuest => ({
  suggestionId: overrides.suggestionId,
  proposalId: overrides.proposalId ?? null,
  title: overrides.title,
  type: overrides.type ?? "should",
  estimatedDuration: overrides.estimatedDuration ?? "30 min",
  estimatedDurationMinutes: overrides.estimatedDurationMinutes ?? 30,
  source: overrides.source ?? "optimization",
  reason: overrides.reason ?? "It is the clearest next move right now.",
});

describe("CompanionStructuredResponseCards", () => {
  it("renders plan-day proposal actions and confirms them from the shared quest row", () => {
    const onConfirmSuggestion = vi.fn();
    const structuredResponse: CompanionStructuredResponse = {
      intent: baseIntent,
      planDay: {
        message: "Keep the day focused around one campaign reset and one support move.",
        dayAssessment: "balanced",
        suggestedQuests: [
          createQuest({
            suggestionId: "plan-day-1",
            proposalId: "proposal-plan-day-1",
            title: "Adjust Course launch",
            type: "must",
            source: "campaign",
            reason: "Resetting the launch path is the clearest way to protect the day.",
          }),
        ],
      },
    };

    render(
      <CompanionStructuredResponseCards
        structuredResponse={structuredResponse}
        variant="companion"
        onConfirmSuggestion={onConfirmSuggestion}
      />,
    );

    fireEvent.click(
      screen.getByTestId("structured-suggestion-confirm-plan-day-1"),
    );

    expect(onConfirmSuggestion).toHaveBeenCalledWith("proposal-plan-day-1");
  });

  it("renders plan-day campaign focus without needing a new card path", () => {
    const structuredResponse: CompanionStructuredResponse = {
      intent: baseIntent,
      planDay: {
        message:
          "Today looks open in standalone quests, but your campaign work is already carrying the focus.",
        dayAssessment: "busy",
        suggestedQuests: [],
        campaignFocus: {
          campaignTitle: "Gain 10 pounds of muscle",
          campaignStatus: "stalled",
          campaignInterventionLevel: "protect",
          campaignReason:
            "Weekly Meal Prep and Progress Tracking are already tucked into this campaign today.",
          campaignHealth: {
            overdueQuestCount: 0,
            protectedTodayCount: 2,
            recentCompletedQuestCount: 0,
            daysWithoutMomentum: null,
            activeCampaignCount: 1,
          },
          focusItems: ["Weekly Meal Prep", "Progress Tracking"],
        },
      },
    };

    render(
      <CompanionStructuredResponseCards
        structuredResponse={structuredResponse}
        variant="journeys"
      />,
    );

    expect(screen.getByTestId("structured-plan-day-campaign-focus"))
      .toHaveTextContent("Gain 10 pounds of muscle");
    expect(screen.getByTestId("structured-plan-day-campaign-focus"))
      .toHaveTextContent("Weekly Meal Prep");
    expect(screen.getByTestId("structured-plan-day-campaign-health"))
      .toHaveTextContent("2 protected today");
    expect(screen.getByText(/Day status:/)).toHaveTextContent("busy");
  });

  it("shows pending coming-up proposals as saving", () => {
    const onConfirmSuggestion = vi.fn();
    const structuredResponse: CompanionStructuredResponse = {
      intent: baseIntent,
      comingUp: {
        message: "You have one useful move before your next event.",
        nextEvent: {
          id: "event-1",
          title: "Client call",
          label: "2:00 PM",
          startsAt: "2026-04-25T21:00:00.000Z",
          endsAt: "2026-04-25T21:30:00.000Z",
          isAllDay: false,
          source: "calendar",
        },
        nextBestAction: createQuest({
          suggestionId: "coming-up-1",
          proposalId: "proposal-coming-up-1",
          title: "Adjust Course launch",
          type: "must",
          source: "campaign",
          reason: "This fits before the call and reduces the most pressure.",
        }),
        remainingToday: [],
        tomorrowSummary: "light",
        missedItems: [],
      },
    };

    render(
      <CompanionStructuredResponseCards
        structuredResponse={structuredResponse}
        variant="companion"
        onConfirmSuggestion={onConfirmSuggestion}
        pendingProposalId="proposal-coming-up-1"
      />,
    );

    const button = screen.getByTestId(
      "structured-suggestion-confirm-coming-up-1",
    );

    expect(button).toHaveTextContent("Saving");
    expect(button).toBeDisabled();
  });

  it("renders tomorrow schedule items in coming-up cards", () => {
    const structuredResponse: CompanionStructuredResponse = {
      intent: baseIntent,
      comingUp: {
        message: "Today is clear, but tomorrow has a real anchor.",
        nextEvent: null,
        nextBestAction: null,
        remainingToday: [],
        tomorrowSummary: "light",
        tomorrowSchedule: [
          {
            id: "ritual:morning:2026-04-19",
            title: "Morning ritual",
            label: "Morning ritual (tomorrow at 8:00 am)",
            startsAt: "2026-04-19T08:00:00",
            endsAt: "2026-04-19T08:20:00.000Z",
            isAllDay: false,
            source: "ritual",
          },
        ],
        missedItems: [],
      },
    };

    render(
      <CompanionStructuredResponseCards
        structuredResponse={structuredResponse}
        variant="companion"
      />,
    );

    expect(screen.getByTestId("structured-coming-up"))
      .toHaveTextContent("Tomorrow looks light.");
    expect(screen.getByText("Morning ritual")).toBeInTheDocument();
    expect(screen.getByText("Morning ritual (tomorrow at 8:00 am)"))
      .toBeInTheDocument();
  });

  it("renders weekly proposal actions and confirms them from the shared quest row", () => {
    const onConfirmSuggestion = vi.fn();
    const structuredResponse: CompanionStructuredResponse = {
      intent: baseIntent,
      weeklyPlan: {
        message: "Protect the launch and keep the rest of the week light.",
        weeklyTheme: "Protect the launch",
        focusCampaignTitle: "Course launch",
        focusCampaignStatus: "at_risk",
        focusCampaignInterventionLevel: "protect",
        focusCampaignReason: "The clearest move still is not on the calendar.",
        focusCampaignHealth: {
          overdueQuestCount: 1,
          protectedTodayCount: 0,
          recentCompletedQuestCount: 0,
          daysWithoutMomentum: 6,
          activeCampaignCount: 3,
        },
        topPriorities: [
          createQuest({
            suggestionId: "weekly-1",
            proposalId: "proposal-weekly-1",
            title: "Block 45 minutes for launch copy",
            type: "must",
            source: "campaign",
            reason: "This keeps the riskiest campaign move protected first.",
          }),
        ],
        busyDays: ["Tuesday"],
        openDays: ["Friday"],
      },
    };

    render(
      <CompanionStructuredResponseCards
        structuredResponse={structuredResponse}
        variant="companion"
        onConfirmSuggestion={onConfirmSuggestion}
      />,
    );

    expect(screen.getByTestId("structured-weekly-plan")).toBeInTheDocument();
    expect(screen.getByTestId("structured-weekly-campaign-health"))
      .toHaveTextContent("6 days quiet");

    fireEvent.click(
      screen.getByTestId("structured-suggestion-confirm-weekly-1"),
    );

    expect(onConfirmSuggestion).toHaveBeenCalledWith("proposal-weekly-1");
  });

  it("shows saved priority-overview proposals as disabled", () => {
    const onConfirmSuggestion = vi.fn();
    const structuredResponse: CompanionStructuredResponse = {
      intent: baseIntent,
      priorityOverview: {
        title: "What Matters",
        message: "Protect the one move that actually changes the week.",
        campaignPressure:
          "Campaign pressure: Course launch is drifting. Protect the next promise-defining step.",
        focusCampaignTitle: "Course launch",
        focusCampaignStatus: "drifting",
        focusCampaignInterventionLevel: "nudge",
        focusCampaignHealth: {
          overdueQuestCount: 0,
          protectedTodayCount: 0,
          recentCompletedQuestCount: 1,
          daysWithoutMomentum: 5,
          activeCampaignCount: 3,
        },
        topPriorities: [
          createQuest({
            suggestionId: "priority-1",
            proposalId: "proposal-priority-1",
            title: "Tighten webinar promise",
            type: "must",
            source: "campaign",
          }),
        ],
      },
    };

    render(
      <CompanionStructuredResponseCards
        structuredResponse={structuredResponse}
        variant="companion"
        onConfirmSuggestion={onConfirmSuggestion}
        savedProposalIds={["proposal-priority-1"]}
      />,
    );

    const button = screen.getByTestId(
      "structured-suggestion-confirm-priority-1",
    );

    expect(screen.getByTestId("structured-priority-campaign-health"))
      .toHaveTextContent("1 recent win");
    expect(screen.getByTestId("structured-priority-campaign-health"))
      .toHaveTextContent("5 days quiet");
    expect(button).toHaveTextContent("Saved");
    expect(button).toBeDisabled();

    fireEvent.click(button);

    expect(onConfirmSuggestion).not.toHaveBeenCalled();
  });

  it("shows pending reflection-bridge proposals as saving", () => {
    const onConfirmSuggestion = vi.fn();
    const structuredResponse: CompanionStructuredResponse = {
      intent: baseIntent,
      reflectionBridge: {
        message: "Set up one clean first move so tomorrow starts lighter.",
        carryForward: "Keep launch friction low.",
        tomorrowSummary: "busy",
        firstAction: createQuest({
          suggestionId: "tomorrow-1",
          proposalId: "proposal-tomorrow-1",
          title: "Adjust Course launch",
          type: "must",
          source: "campaign",
          reason: "The campaign has slipped enough that a reset is the honest first move.",
        }),
        tomorrowSchedule: [
          {
            id: "event-1",
            title: "Client check-in",
            label: "10:00 AM",
            startsAt: "2026-04-25T17:00:00.000Z",
            endsAt: "2026-04-25T17:30:00.000Z",
            isAllDay: false,
            source: "calendar",
          },
        ],
      },
    };

    render(
      <CompanionStructuredResponseCards
        structuredResponse={structuredResponse}
        variant="companion"
        onConfirmSuggestion={onConfirmSuggestion}
        pendingProposalId="proposal-tomorrow-1"
      />,
    );

    const button = screen.getByTestId(
      "structured-suggestion-confirm-tomorrow-1",
    );

    expect(button).toHaveTextContent("Saving");
    expect(button).toBeDisabled();
  });

  it("renders campaign next-step proposals through the same shared action path", () => {
    const onConfirmSuggestion = vi.fn();
    const structuredResponse: CompanionStructuredResponse = {
      intent: baseIntent,
      campaignMomentum: {
        message: "Course launch needs a protected reset move.",
        campaignId: "campaign-1",
        campaignTitle: "Course launch",
        status: "stalled",
        interventionLevel: "reset",
        statusReason:
          "The campaign has slipped repeatedly and the current next step is still too large.",
        healthSnapshot: {
          overdueQuestCount: 2,
          protectedTodayCount: 0,
          recentCompletedQuestCount: 1,
          daysWithoutMomentum: 8,
          activeCampaignCount: 4,
        },
        pressureSignals: [
          "Repeated slip on the current launch move.",
          "No smaller linked next step is protected yet.",
        ],
        nextStep: createQuest({
          suggestionId: "campaign-1",
          proposalId: "proposal-campaign-1",
          title: "Adjust Course launch",
          type: "must",
          source: "campaign",
          reason: "Resetting the plan is more honest than adding another overdue task.",
        }),
        supportActions: [],
      },
    };

    render(
      <CompanionStructuredResponseCards
        structuredResponse={structuredResponse}
        variant="journeys"
        onConfirmSuggestion={onConfirmSuggestion}
      />,
    );

    expect(screen.getByTestId("structured-campaign-momentum"))
      .toBeInTheDocument();
    expect(screen.getByTestId("structured-campaign-health"))
      .toHaveTextContent("1 recent win");
    expect(screen.getByTestId("structured-campaign-health"))
      .toHaveTextContent("8 days quiet");
    expect(screen.getByTestId("structured-campaign-intervention"))
      .toHaveTextContent("reset");

    fireEvent.click(
      screen.getByTestId("structured-suggestion-confirm-campaign-1"),
    );

    expect(onConfirmSuggestion).toHaveBeenCalledWith("proposal-campaign-1");
  });
});
