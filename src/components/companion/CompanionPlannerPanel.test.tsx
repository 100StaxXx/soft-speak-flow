import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  accessState: {
    hasAccess: true,
    isSubscribed: true,
    isInTrial: false,
    trialExpired: false,
    trialDaysRemaining: 0,
    accessSource: "subscription" as const,
    gateReason: "none" as const,
    trialEndsAt: null,
    loading: false,
  },
  assistant: {
    setHorizon: vi.fn(),
    setDraftInput: vi.fn(),
    submitTypedMessage: vi.fn(),
    toggleRecording: vi.fn(),
    requestMicrophonePermission: vi.fn(),
    setShowPermissionDialog: vi.fn(),
    confirmProposal: vi.fn(),
    rejectProposal: vi.fn(),
    confirmAll: vi.fn(),
  },
}));

vi.mock("@/hooks/useAccessStatus", () => ({
  useAccessStatus: () => mocks.accessState,
}));

vi.mock("@/hooks/useCompanionAssistant", () => ({
  useCompanionAssistant: () => ({
    greeting: "I’m right here with you.",
    messages: [
      {
        id: "a1",
        role: "assistant" as const,
        content: "Here is your schedule for 2026-04-18.",
        createdAt: "2026-04-18T08:00:00.000Z",
        source: "plan" as const,
      },
      {
        id: "a2",
        role: "user" as const,
        content: "Move my workout quest to 6 pm",
        createdAt: "2026-04-18T08:01:00.000Z",
        source: "plan" as const,
      },
    ],
    questions: [
      {
        id: "details",
        prompt: "Which quest did you mean?",
        reason: "I do not want to move the wrong thing.",
        required: true,
        field: "details" as const,
        options: ["Workout", "Workout follow-up"],
      },
    ],
    proposals: [
      {
        id: "proposal-1",
        kind: "update_quest" as const,
        title: "Move Workout",
        summary: "Move Workout to 2026-04-19 at 18:00.",
        reasoning: "This is a direct quest adjustment.",
        payload: {
          taskId: "task-1",
          updates: {
            notes: "Leg day with a cooldown walk at the end.",
          },
          subtaskPlan: {
            mode: "append" as const,
            titles: ["Warm up", "Cooldown walk"],
          },
        },
        status: "pending" as const,
        readyToConfirm: true,
        missingFields: [],
      },
      {
        id: "proposal-2",
        kind: "adjust_campaign_plan" as const,
        title: "Adjust Campaign Aurora",
        summary: "Generate a revised plan for Campaign Aurora.",
        reasoning: "This is a campaign restructure request.",
        payload: {},
        status: "pending" as const,
        readyToConfirm: true,
        missingFields: [],
      },
    ],
    pendingProposals: [
      {
        id: "proposal-1",
        kind: "update_quest" as const,
        title: "Move Workout",
        summary: "Move Workout to 2026-04-19 at 18:00.",
        payload: {
          taskId: "task-1",
          updates: {
            notes: "Leg day with a cooldown walk at the end.",
          },
          subtaskPlan: {
            mode: "append" as const,
            titles: ["Warm up", "Cooldown walk"],
          },
        },
        status: "pending" as const,
        readyToConfirm: true,
      },
      {
        id: "proposal-2",
        kind: "adjust_campaign_plan" as const,
        title: "Adjust Campaign Aurora",
        summary: "Generate a revised plan for Campaign Aurora.",
        payload: {},
        status: "pending" as const,
        readyToConfirm: true,
      },
    ],
    readyProposalCount: 2,
    plannerMemory: {
      preferredTimeOfDay: "morning",
      preferredTimeReason: "I have the most energy before email.",
    },
    scheduleInsights: {
      horizon: "day" as const,
      selectedDate: "2026-04-18",
      dayLoads: [
        {
          date: "2026-04-18",
          totalMinutes: 180,
          taskCount: 3,
          status: "balanced" as const,
        },
      ],
      overloadedDates: [],
      emptyDates: [],
      conflicts: [],
      suggestedSlots: [
        {
          date: "2026-04-18",
          time: "09:00",
          endTime: "10:00",
          score: 88,
          reason: "Fits your usual morning rhythm.",
        },
      ],
      moveSuggestions: [],
      summary: "Today has room at 09:00.",
    },
    todayLabel: "Saturday, April 18",
    isLoadingContext: false,
    horizon: "day" as const,
    setHorizon: mocks.assistant.setHorizon,
    draftInput: "What do I have scheduled today?",
    setDraftInput: mocks.assistant.setDraftInput,
    interimText: "",
    placeholder: "Talk, ask about your schedule, or tell me what to adjust...",
    isSubmitting: false,
    isClassifying: false,
    isRecording: false,
    isAutoStopping: false,
    isVoiceSupported: true,
    permissionStatus: "granted" as const,
    showPermissionDialog: false,
    setShowPermissionDialog: mocks.assistant.setShowPermissionDialog,
    isRequestingPermission: false,
    submitTypedMessage: mocks.assistant.submitTypedMessage,
    submitMessage: vi.fn(),
    toggleRecording: mocks.assistant.toggleRecording,
    requestMicrophonePermission: mocks.assistant.requestMicrophonePermission,
    confirmProposal: mocks.assistant.confirmProposal,
    rejectProposal: mocks.assistant.rejectProposal,
    confirmAll: mocks.assistant.confirmAll,
    isSpeaking: false,
    speechProvider: "device" as const,
    stopSpeaking: vi.fn(),
  }),
}));

import { CompanionPlannerPanel } from "./CompanionPlannerPanel";

describe("CompanionPlannerPanel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.accessState.isSubscribed = true;
  });

  it("renders a unified assistant transcript with schedule insight and proposals", () => {
    render(<CompanionPlannerPanel />);

    expect(screen.getByTestId("companion-planner-panel")).toBeInTheDocument();
    expect(screen.getByTestId("companion-assistant-transcript")).toBeInTheDocument();
    expect(screen.getByTestId("assistant-schedule-insights")).toBeInTheDocument();
    expect(screen.getByText("Today has room at 09:00.")).toBeInTheDocument();
    expect(screen.getByText("Move Workout")).toBeInTheDocument();
    expect(screen.getByText("Adjust Campaign Aurora")).toBeInTheDocument();
    expect(screen.getByTestId("assistant-proposal-notes-proposal-1")).toHaveTextContent("Stored note");
    expect(screen.getByTestId("assistant-proposal-notes-proposal-1")).toHaveTextContent("Leg day with a cooldown walk at the end.");
    expect(screen.getByTestId("assistant-proposal-subtasks-proposal-1")).toHaveTextContent("Append steps");
    expect(screen.getByTestId("assistant-proposal-subtasks-proposal-1")).toHaveTextContent("Warm up");
    expect(screen.getByTestId("assistant-proposal-subtasks-proposal-1")).toHaveTextContent("Cooldown walk");
    expect(screen.getByRole("button", { name: "Confirm all" })).toBeInTheDocument();
  });

  it("routes composer, mic, horizon, and proposal actions through the assistant hook", () => {
    render(<CompanionPlannerPanel />);

    fireEvent.change(screen.getByTestId("companion-assistant-text-input"), {
      target: { value: "Move the rest of my quests to tomorrow" },
    });
    fireEvent.click(screen.getByTestId("companion-assistant-send-button"));
    fireEvent.click(screen.getByTestId("companion-assistant-mic-button"));
    fireEvent.click(screen.getByRole("radio", { name: "Week" }));
    fireEvent.click(screen.getAllByRole("button", { name: "Confirm" })[0]);
    fireEvent.click(screen.getAllByRole("button", { name: "Reject" })[0]);
    fireEvent.click(screen.getByRole("button", { name: "Confirm all" }));

    expect(mocks.assistant.setDraftInput).toHaveBeenCalledWith("Move the rest of my quests to tomorrow");
    expect(mocks.assistant.submitTypedMessage).toHaveBeenCalledTimes(1);
    expect(mocks.assistant.toggleRecording).toHaveBeenCalledTimes(1);
    expect(mocks.assistant.setHorizon).toHaveBeenCalledWith("week");
    expect(mocks.assistant.confirmProposal).toHaveBeenCalledWith("proposal-1");
    expect(mocks.assistant.rejectProposal).toHaveBeenCalledWith("proposal-1");
    expect(mocks.assistant.confirmAll).toHaveBeenCalledTimes(1);
  });

  it("shows the premium notice while keeping the assistant available", () => {
    mocks.accessState.isSubscribed = false;

    render(<CompanionPlannerPanel />);

    expect(screen.getByText(/conversation mode is premium/i)).toBeInTheDocument();
    expect(screen.getByTestId("companion-assistant-text-input")).toBeInTheDocument();
  });
});
