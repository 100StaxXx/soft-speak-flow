import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

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
    },
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
    savedSuggestionProposalIds: [],
    pendingSuggestionProposalId: "proposal-right-now-1",
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

  it("launches quick planner starters through the unified assistant intent path", () => {
    const previousPendingAction = mocks.state.pendingAction;
    mocks.state.pendingAction = null;

    render(<CompanionPlannerPanel />);

    fireEvent.click(screen.getByTestId("companion-quick-action-plan-day"));
    fireEvent.click(screen.getByTestId("companion-quick-action-advance-campaign"));
    fireEvent.click(screen.getByTestId("companion-quick-action-low-energy"));
    fireEvent.click(screen.getByTestId("companion-quick-action-what-matters"));
    fireEvent.click(screen.getByTestId("companion-quick-action-upcoming"));

    expect(mocks.assistant.submitMessage).toHaveBeenNthCalledWith(
      1,
      "Plan my day",
      "text",
      { starterIntent: "plan_day" },
    );
    expect(mocks.assistant.submitMessage).toHaveBeenNthCalledWith(
      2,
      "Advance my campaign",
      "text",
      { starterIntent: "advance_campaign_start" },
    );
    expect(mocks.assistant.submitMessage).toHaveBeenNthCalledWith(
      3,
      "I'm low energy today",
      "text",
      { starterIntent: "low_energy_adjust" },
    );
    expect(mocks.assistant.submitMessage).toHaveBeenNthCalledWith(
      4,
      "What matters most today?",
      "text",
      { starterIntent: "what_matters" },
    );
    expect(mocks.assistant.submitMessage).toHaveBeenNthCalledWith(
      5,
      "What do I have coming up?",
      "text",
      { starterIntent: "upcoming_start" },
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
});
