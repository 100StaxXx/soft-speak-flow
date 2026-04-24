import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CompanionStructuredResponse } from "@/shared/companionStructuredOutput";

const mocks = vi.hoisted(() => ({
  assistant: {
    setDraftInput: vi.fn(),
    submitMessage: vi.fn().mockResolvedValue(undefined),
    submitTypedMessage: vi.fn(),
    toggleRecording: vi.fn(),
    requestMicrophonePermission: vi.fn(),
    setShowPermissionDialog: vi.fn(),
    confirmPendingAction: vi.fn(),
    cancelPendingAction: vi.fn(),
    confirmSuggestedQuest: vi.fn(),
    confirmAllPendingActions: vi.fn(),
    stopSpeaking: vi.fn(),
  },
  modeSettings: {
    setMode: vi.fn(),
    setAdaptationEnabled: vi.fn(),
  },
  planningMode: {
    setPlanningMode: vi.fn(),
  },
  state: {
    messages: [
      {
        id: "a1",
        role: "assistant" as const,
        content: "Tomorrow is pretty light.",
        createdAt: "2026-04-18T08:00:00.000Z",
        source: "agent" as const,
      },
      {
        id: "a2",
        role: "user" as const,
        content: "I want to hit the gym at 3",
        createdAt: "2026-04-18T08:01:00.000Z",
        source: "agent" as const,
      },
    ],
    draftInput: "I want to hit the gym at 3",
    pendingAction: {
      id: "action-1",
      status: "pending" as const,
      intent: "schedule_task" as const,
      actionType: "task_create" as const,
      summary: 'Add "Gym" for 2026-04-18 at 15:00.',
      confirmationMessage: 'Want me to add "Gym" for 2026-04-18 at 15:00?',
      normalizedPayload: {},
      affectedEntities: null,
      expiresAt: "2026-04-18T20:00:00.000Z",
      createdAt: "2026-04-18T08:02:00.000Z",
    },
    structuredResponse: {
      intent: {
        intentType: "conversation" as const,
        timeHorizon: "today" as const,
        isRecurring: false,
        shouldCreateQuest: false,
        shouldPromptCampaign: false,
      },
      rightNow: {
        message: "You have a clean 30-minute window before lunch.",
        currentWindow: "Next 30 minutes",
        recommendedAction: {
          suggestionId: "suggestion-1",
          proposalId: "proposal-right-now-1",
          title: "Review this week's gym split",
          type: "should" as const,
          estimatedDuration: "30 min",
          estimatedDurationMinutes: 30,
          source: "optimization" as const,
          reason: "It fits the open slot and keeps your workout plan concrete.",
        },
        fallbackAction: null,
      },
    } as CompanionStructuredResponse,
    savedSuggestionProposalIds: [] as string[],
    pendingSuggestionProposalId: "proposal-right-now-1" as string | null,
  },
}));

vi.mock("@/hooks/useCompanionAssistant", () => ({
  useCompanionAssistant: () => ({
    todayLabel: "Saturday, April 18",
    placeholder: "Talk to Cosmiq naturally.",
    messages: mocks.state.messages,
    structuredResponse: mocks.state.structuredResponse,
    planningMode: "balanced" as const,
    setPlanningMode: mocks.planningMode.setPlanningMode,
    pendingAction: mocks.state.pendingAction,
    savedSuggestionProposalIds: mocks.state.savedSuggestionProposalIds,
    pendingSuggestionProposalId: mocks.state.pendingSuggestionProposalId,
    pendingActionCount: 3,
    readyPendingActionCount: 3,
    draftInput: mocks.state.draftInput,
    setDraftInput: mocks.assistant.setDraftInput,
    interimText: "",
    isSubmitting: false,
    isResolvingAction: false,
    submitMessage: mocks.assistant.submitMessage,
    submitTypedMessage: mocks.assistant.submitTypedMessage,
    confirmPendingAction: mocks.assistant.confirmPendingAction,
    cancelPendingAction: mocks.assistant.cancelPendingAction,
    confirmSuggestedQuest: mocks.assistant.confirmSuggestedQuest,
    confirmAllPendingActions: mocks.assistant.confirmAllPendingActions,
    isRecording: false,
    isAutoStopping: false,
    isVoiceSupported: true,
    permissionStatus: "granted" as const,
    showPermissionDialog: false,
    setShowPermissionDialog: mocks.assistant.setShowPermissionDialog,
    isRequestingPermission: false,
    toggleRecording: mocks.assistant.toggleRecording,
    requestMicrophonePermission: mocks.assistant.requestMicrophonePermission,
    isSpeaking: false,
    speechProvider: "device" as const,
    stopSpeaking: mocks.assistant.stopSpeaking,
  }),
}));

vi.mock("@/hooks/useCompanionModeSettings", () => ({
  useCompanionModeSettings: () => ({
    mode: "alpha" as const,
    adaptationEnabled: true,
    isLoading: false,
    isSaving: false,
    setMode: mocks.modeSettings.setMode,
    setAdaptationEnabled: mocks.modeSettings.setAdaptationEnabled,
  }),
}));

import { CompanionPlannerPanel } from "./CompanionPlannerPanel";

describe("CompanionPlannerPanel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the unified transcript and pending confirmation card", () => {
    render(<CompanionPlannerPanel />);

    expect(screen.getByText("Tomorrow is pretty light.")).toBeInTheDocument();
    expect(screen.getByTestId("structured-right-now")).toBeInTheDocument();
    expect(screen.getByText("Review this week's gym split"))
      .toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Saving" }))
      .toBeInTheDocument();
    expect(screen.getByText('Add "Gym" for 2026-04-18 at 15:00.'))
      .toBeInTheDocument();
    expect(screen.getByText('Want me to add "Gym" for 2026-04-18 at 15:00?'))
      .toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Confirm All (3)" }))
      .toBeInTheDocument();
  });

  it("wires confirm and cancel actions to the unified assistant hook", () => {
    render(<CompanionPlannerPanel />);

    fireEvent.click(screen.getByRole("button", { name: "Confirm All (3)" }));
    fireEvent.click(screen.getByRole("button", { name: "Confirm" }));
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

    expect(mocks.assistant.confirmAllPendingActions).toHaveBeenCalledTimes(1);
    expect(mocks.assistant.confirmPendingAction).toHaveBeenCalledTimes(1);
    expect(mocks.assistant.cancelPendingAction).toHaveBeenCalledTimes(1);
  });

  it("submits the typed message from the single composer", () => {
    render(<CompanionPlannerPanel />);

    fireEvent.click(screen.getByTestId("companion-assistant-send-button"));

    expect(mocks.assistant.submitTypedMessage).toHaveBeenCalledTimes(1);
  });

  it("lets the user switch the day mode for planner bias", () => {
    render(<CompanionPlannerPanel />);

    fireEvent.click(screen.getByTestId("companion-planning-mode-recovery"));

    expect(mocks.planningMode.setPlanningMode).toHaveBeenCalledWith("recovery");
  });

  it("renders campaign pressure signals when advance-campaign guidance is active", () => {
    const previousStructuredResponse = mocks.state.structuredResponse;
    mocks.state.structuredResponse = {
      intent: {
        intentType: "campaign",
        timeHorizon: "short_term",
        isRecurring: false,
        shouldCreateQuest: false,
        shouldPromptCampaign: false,
      },
      campaignMomentum: {
        message: "Course launch needs a cleaner next move.",
        campaignId: "epic-1",
        campaignTitle: "Course launch",
        status: "stalled",
        interventionLevel: "reset",
        statusReason: "The next campaign task is still too large and undefined, so it is hard to start cleanly.",
        healthSnapshot: {
          overdueQuestCount: 2,
          protectedTodayCount: 0,
          daysWithoutMomentum: 8,
          activeCampaignCount: 4,
        },
        pressureSignals: [
          "\"Build full course sales page\" is still too large to start cleanly.",
          "No linked campaign work is scheduled yet.",
        ],
        nextStep: null,
        supportActions: [],
      },
    };

    render(<CompanionPlannerPanel />);

    expect(screen.getByTestId("structured-campaign-momentum"))
      .toBeInTheDocument();
    expect(screen.getByTestId("structured-campaign-intervention"))
      .toHaveTextContent("reset");
    expect(screen.getByTestId("structured-campaign-health"))
      .toHaveTextContent("2 overdue");
    expect(screen.getByTestId("structured-campaign-health"))
      .toHaveTextContent("8 days quiet");
    expect(screen.getByText("Pressure Signals")).toBeInTheDocument();
    expect(screen.getByText(
      "\"Build full course sales page\" is still too large to start cleanly.",
    )).toBeInTheDocument();
    expect(screen.getByText("No linked campaign work is scheduled yet."))
      .toBeInTheDocument();

    mocks.state.structuredResponse = previousStructuredResponse;
  });

  it("renders priority overview cards for read-only planner guidance", () => {
    const previousStructuredResponse = mocks.state.structuredResponse;
    mocks.state.structuredResponse = {
      intent: {
        intentType: "quest",
        timeHorizon: "today",
        isRecurring: false,
        shouldCreateQuest: false,
        shouldPromptCampaign: false,
      },
      priorityOverview: {
        title: "What Matters",
        message: "Here are the moves worth protecting first.",
        campaignPressure:
          "Campaign pressure: Course launch is at risk. Protect Outline webinar promise first.",
        focusCampaignTitle: "Course launch",
        focusCampaignStatus: "at_risk",
        focusCampaignInterventionLevel: "protect",
        focusCampaignHealth: {
          overdueQuestCount: 1,
          protectedTodayCount: 0,
          daysWithoutMomentum: 6,
          activeCampaignCount: 3,
        },
        topPriorities: [
          {
            suggestionId: "priority-1",
            proposalId: null,
            title: "Outline webinar promise",
            type: "must",
            estimatedDuration: "45 min",
            estimatedDurationMinutes: 45,
            source: "campaign",
            reason: "Deadline in 3 days. This is the clearest move to protect next.",
          },
        ],
      },
    };

    render(<CompanionPlannerPanel />);

    const priorityOverview = screen.getByTestId("structured-priority-overview");

    expect(priorityOverview).toBeInTheDocument();
    expect(priorityOverview).toHaveTextContent("What Matters");
    expect(priorityOverview).toHaveTextContent("Focus Campaign");
    expect(priorityOverview).toHaveTextContent("Campaign Pressure");
    expect(screen.getByTestId("structured-priority-campaign-health"))
      .toHaveTextContent("6 days quiet");
    expect(priorityOverview).toHaveTextContent("Outline webinar promise");

    mocks.state.structuredResponse = previousStructuredResponse;
  });

  it("renders weekly campaign focus when weekly planning guidance is active", () => {
    const previousStructuredResponse = mocks.state.structuredResponse;
    mocks.state.structuredResponse = {
      intent: {
        intentType: "quest",
        timeHorizon: "short_term",
        isRecurring: false,
        shouldCreateQuest: false,
        shouldPromptCampaign: false,
      },
      weeklyPlan: {
        message: "Launch prep is the campaign to protect this week.",
        weeklyTheme: "Protect the launch path before the deadline compresses.",
        focusCampaignTitle: "Launch prep",
        focusCampaignStatus: "at_risk",
        focusCampaignInterventionLevel: "protect",
        focusCampaignReason: "Deadline in 6 days.",
        focusCampaignHealth: {
          overdueQuestCount: 1,
          protectedTodayCount: 0,
          daysWithoutMomentum: 6,
          activeCampaignCount: 3,
        },
        topPriorities: [],
        busyDays: ["Mon"],
        openDays: ["Wed"],
      },
    };

    render(<CompanionPlannerPanel />);

    const weeklyPlan = screen.getByTestId("structured-weekly-plan");

    expect(weeklyPlan).toBeInTheDocument();
    expect(weeklyPlan).toHaveTextContent("Campaign Focus");
    expect(weeklyPlan).toHaveTextContent("Launch prep");
    expect(weeklyPlan).toHaveTextContent("at risk");
    expect(weeklyPlan).toHaveTextContent("protect");
    expect(screen.getByTestId("structured-weekly-campaign-health"))
      .toHaveTextContent("1 overdue");
    expect(screen.getByTestId("structured-weekly-campaign-health"))
      .toHaveTextContent("6 days quiet");

    mocks.state.structuredResponse = previousStructuredResponse;
  });

  it("launches quick planner starters through the unified assistant intent path", () => {
    const previousPendingAction = mocks.state.pendingAction;
    mocks.state.pendingAction = null;

    render(<CompanionPlannerPanel />);

    fireEvent.click(screen.getByTestId("companion-quick-action-plan-week"));
    fireEvent.click(screen.getByTestId("companion-quick-action-plan-day"));
    fireEvent.click(screen.getByTestId("companion-quick-action-prepare-tomorrow"));
    fireEvent.click(screen.getByTestId("companion-quick-action-advance-campaign"));
    fireEvent.click(screen.getByTestId("companion-quick-action-make-room"));
    fireEvent.click(screen.getByTestId("companion-quick-action-low-energy"));
    fireEvent.click(screen.getByTestId("companion-quick-action-what-matters"));
    fireEvent.click(screen.getByTestId("companion-quick-action-upcoming"));

    expect(mocks.assistant.submitMessage).toHaveBeenNthCalledWith(
      1,
      "Plan my week",
      "text",
      { starterIntent: "plan_week", planningMode: null },
    );
    expect(mocks.assistant.submitMessage).toHaveBeenNthCalledWith(
      2,
      "Plan my day",
      "text",
      { starterIntent: "plan_day", planningMode: null },
    );
    expect(mocks.assistant.submitMessage).toHaveBeenNthCalledWith(
      3,
      "Prepare me for tomorrow",
      "text",
      { starterIntent: "briefing_followup", planningMode: null },
    );
    expect(mocks.assistant.submitMessage).toHaveBeenNthCalledWith(
      4,
      "Advance my campaign",
      "text",
      { starterIntent: "advance_campaign_start", planningMode: null },
    );
    expect(mocks.assistant.submitMessage).toHaveBeenNthCalledWith(
      5,
      "Help me make room for what matters.",
      "text",
      { starterIntent: "make_room", planningMode: null },
    );
    expect(mocks.assistant.submitMessage).toHaveBeenNthCalledWith(
      6,
      "I'm low energy today",
      "text",
      { starterIntent: "low_energy_adjust", planningMode: "recovery" },
    );
    expect(mocks.assistant.submitMessage).toHaveBeenNthCalledWith(
      7,
      "What matters most today?",
      "text",
      { starterIntent: "what_matters", planningMode: null },
    );
    expect(mocks.assistant.submitMessage).toHaveBeenNthCalledWith(
      8,
      "What do I have coming up?",
      "text",
      { starterIntent: "upcoming_start", planningMode: null },
    );
    expect(mocks.planningMode.setPlanningMode).toHaveBeenCalledWith("recovery");

    mocks.state.pendingAction = previousPendingAction;
  });

  it("renders a next best action inside the coming-up surface", () => {
    const previousStructuredResponse = mocks.state.structuredResponse;
    mocks.state.structuredResponse = {
      intent: {
        intentType: "conversation" as const,
        timeHorizon: "today" as const,
        isRecurring: false,
        shouldCreateQuest: false,
        shouldPromptCampaign: false,
      },
      comingUp: {
        message: "Today has one meeting and a little room before it.",
        nextEvent: {
          id: "event-1",
          title: "Therapy",
          label: "Therapy at 2:00 pm",
          startsAt: "2026-04-18T21:00:00.000Z",
          endsAt: "2026-04-18T22:00:00.000Z",
          isAllDay: false,
          source: "calendar" as const,
        },
        nextBestAction: {
          suggestionId: "suggestion-coming-up-1",
          proposalId: null,
          title: "Prep therapy notes",
          type: "must" as const,
          estimatedDuration: "20 min",
          estimatedDurationMinutes: 20,
          source: "optimization" as const,
          reason: "It fits cleanly before Therapy without crowding the day.",
        },
        remainingToday: [],
        tomorrowSummary: "light" as const,
        missedItems: [],
      },
    };

    render(<CompanionPlannerPanel />);

    expect(screen.getByTestId("structured-coming-up")).toBeInTheDocument();
    expect(screen.getByText("Before That")).toBeInTheDocument();
    expect(screen.getByText("Prep therapy notes")).toBeInTheDocument();

    mocks.state.structuredResponse = previousStructuredResponse;
  });

  it("renders the tomorrow bridge surface when the planner returns one", () => {
    const previousStructuredResponse = mocks.state.structuredResponse;
    mocks.state.structuredResponse = {
      intent: {
        intentType: "conversation" as const,
        timeHorizon: "short_term" as const,
        isRecurring: false,
        shouldCreateQuest: false,
        shouldPromptCampaign: false,
      },
      reflectionBridge: {
        message: "You wanted a lighter re-entry tomorrow, so start with your clearest launch move and keep the morning clean.",
        carryForward: "Take a short walk before jumping back into messages.",
        tomorrowSummary: "light" as const,
        firstAction: {
          suggestionId: "suggestion-tomorrow-1",
          proposalId: null,
          title: "Finalize launch checklist",
          type: "must" as const,
          estimatedDuration: "45 min",
          estimatedDurationMinutes: 45,
          source: "campaign" as const,
          reason: "It is the cleanest first move already waiting on tomorrow's board.",
        },
        tomorrowSchedule: [
          {
            id: "task-tomorrow-1",
            title: "Finalize launch checklist",
            label: "Finalize launch checklist at 9:00 am",
            startsAt: "2026-04-19T09:00:00",
            endsAt: "2026-04-19T09:45:00",
            isAllDay: false,
            source: "task" as const,
          },
        ],
      },
    };

    render(<CompanionPlannerPanel />);

    expect(screen.getByTestId("structured-reflection-bridge")).toBeInTheDocument();
    expect(screen.getByText("Carry Forward")).toBeInTheDocument();
    expect(screen.getByText("First Move")).toBeInTheDocument();
    expect(screen.getAllByText("Finalize launch checklist")).toHaveLength(2);

    mocks.state.structuredResponse = previousStructuredResponse;
  });

  it("keeps proposal-backed weekly, tomorrow, and priority cards actionable with the right save states", () => {
    const previousStructuredResponse = mocks.state.structuredResponse;
    const previousPendingAction = mocks.state.pendingAction;
    const previousSavedSuggestionProposalIds =
      mocks.state.savedSuggestionProposalIds;
    const previousPendingSuggestionProposalId =
      mocks.state.pendingSuggestionProposalId;

    mocks.state.pendingAction = null;
    mocks.state.savedSuggestionProposalIds = ["proposal-priority-reset-1"];
    mocks.state.pendingSuggestionProposalId = "proposal-tomorrow-reset-1";
    mocks.state.structuredResponse = {
      intent: {
        intentType: "quest" as const,
        timeHorizon: "short_term" as const,
        isRecurring: false,
        shouldCreateQuest: false,
        shouldPromptCampaign: false,
      },
      weeklyPlan: {
        message: "Launch prep needs a reset move this week.",
        weeklyTheme: "Reset the launch path before adding more work.",
        focusCampaignTitle: "Launch prep",
        focusCampaignStatus: "stalled" as const,
        focusCampaignInterventionLevel: "reset" as const,
        focusCampaignReason:
          "This campaign has slipped repeatedly without a protected recovery move.",
        focusCampaignHealth: {
          overdueQuestCount: 2,
          protectedTodayCount: 0,
          daysWithoutMomentum: 9,
          activeCampaignCount: 4,
        },
        topPriorities: [
          {
            suggestionId: "weekly-reset-1",
            proposalId: "proposal-weekly-reset-1",
            title: "Adjust Launch prep",
            type: "must" as const,
            estimatedDuration: "20 min",
            estimatedDurationMinutes: 20,
            source: "campaign" as const,
            reason: "This campaign has slipped repeatedly and needs a reset plan this week.",
          },
        ],
        busyDays: [],
        openDays: ["Wed"],
      },
      priorityOverview: {
        title: "What Matters",
        message: "The honest next move is to reset the campaign first.",
        campaignPressure:
          "Campaign pressure: Launch prep is stalled. The honest next move is to adjust the campaign plan before adding more work.",
        topPriorities: [
          {
            suggestionId: "priority-reset-1",
            proposalId: "proposal-priority-reset-1",
            title: "Adjust Launch prep",
            type: "must" as const,
            estimatedDuration: "20 min",
            estimatedDurationMinutes: 20,
            source: "campaign" as const,
            reason: "This campaign has slipped repeatedly and needs a reset plan right now.",
          },
        ],
      },
      reflectionBridge: {
        message: "Tomorrow should start with a reset move before you add more pressure.",
        carryForward: null,
        tomorrowSummary: "light" as const,
        firstAction: {
          suggestionId: "tomorrow-reset-1",
          proposalId: "proposal-tomorrow-reset-1",
          title: "Adjust Launch prep",
          type: "must" as const,
          estimatedDuration: "20 min",
          estimatedDurationMinutes: 20,
          source: "campaign" as const,
          reason: "This campaign has slipped repeatedly without a protected recovery move. The honest first move tomorrow is resetting Launch prep before you pile on more work.",
        },
        tomorrowSchedule: [],
      },
    };

    render(<CompanionPlannerPanel />);

    const weeklySaveButton = screen.getByTestId(
      "structured-suggestion-confirm-weekly-reset-1",
    );
    const prioritySavedButton = screen.getByTestId(
      "structured-suggestion-confirm-priority-reset-1",
    );
    const reflectionPendingButton = screen.getByTestId(
      "structured-suggestion-confirm-tomorrow-reset-1",
    );

    expect(weeklySaveButton).toHaveTextContent("Save");
    expect(prioritySavedButton).toHaveTextContent("Saved");
    expect(reflectionPendingButton).toHaveTextContent("Saving");
    expect(prioritySavedButton).toBeDisabled();
    expect(reflectionPendingButton).toBeDisabled();

    fireEvent.click(weeklySaveButton);

    expect(mocks.assistant.confirmSuggestedQuest).toHaveBeenCalledWith(
      "proposal-weekly-reset-1",
    );

    mocks.state.structuredResponse = previousStructuredResponse;
    mocks.state.pendingAction = previousPendingAction;
    mocks.state.savedSuggestionProposalIds = previousSavedSuggestionProposalIds;
    mocks.state.pendingSuggestionProposalId =
      previousPendingSuggestionProposalId;
  });
});
