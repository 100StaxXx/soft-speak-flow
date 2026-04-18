import { fireEvent, render, screen, waitFor } from "@testing-library/react";
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
  planner: {
    setTonePack: vi.fn(),
    setHorizon: vi.fn(),
    setDraftInput: vi.fn(),
    submitTypedMessage: vi.fn(),
    toggleRecording: vi.fn(),
    requestMicrophonePermission: vi.fn(),
    confirmProposal: vi.fn(),
    rejectProposal: vi.fn(),
    confirmAll: vi.fn(),
    setShowPermissionDialog: vi.fn(),
  },
  chat: {
    setDraftInput: vi.fn(),
    submitTypedMessage: vi.fn(),
    toggleRecording: vi.fn(),
    requestMicrophonePermission: vi.fn(),
    setShowPermissionDialog: vi.fn(),
    setAutoplayVoice: vi.fn(),
    setMuteSpokenReplies: vi.fn(),
    clearPlannerHandoff: vi.fn(),
    stopSpeaking: vi.fn(),
  },
  chatState: {
    handoffToPlanner: false,
    speechProvider: "device" as "device" | "cloud" | "none",
  },
}));

vi.mock("@/hooks/useAccessStatus", () => ({
  useAccessStatus: () => mocks.accessState,
}));

vi.mock("@/hooks/useCompanionChat", () => ({
  useCompanionChat: () => ({
    greeting: "I’m right here with you.",
    messages: [
      {
        id: "c1",
        role: "assistant",
        content: "I’m right here with you.",
        createdAt: "2026-04-18T08:00:00.000Z",
      },
      {
        id: "c2",
        role: "user",
        content: "Can we talk through a hard day?",
        createdAt: "2026-04-18T08:01:00.000Z",
        inputMode: "text",
      },
    ],
    draftInput: "Can we talk through a hard day?",
    setDraftInput: mocks.chat.setDraftInput,
    interimText: "",
    isSubmitting: false,
    isLoadingHistory: false,
    autoplayVoice: true,
    setAutoplayVoice: mocks.chat.setAutoplayVoice,
    muteSpokenReplies: false,
    setMuteSpokenReplies: mocks.chat.setMuteSpokenReplies,
    isSpeaking: false,
    speechProvider: mocks.chatState.speechProvider,
    handoffToPlanner: mocks.chatState.handoffToPlanner,
    clearPlannerHandoff: mocks.chat.clearPlannerHandoff,
    isRecording: false,
    isAutoStopping: false,
    isVoiceSupported: true,
    permissionStatus: "granted",
    showPermissionDialog: false,
    setShowPermissionDialog: mocks.chat.setShowPermissionDialog,
    isRequestingPermission: false,
    submitTypedMessage: mocks.chat.submitTypedMessage,
    submitMessage: vi.fn(),
    toggleRecording: mocks.chat.toggleRecording,
    requestMicrophonePermission: mocks.chat.requestMicrophonePermission,
    stopSpeaking: mocks.chat.stopSpeaking,
  }),
}));

vi.mock("@/hooks/useCompanionPlanner", () => ({
  useCompanionPlanner: () => ({
    greeting: "Let's shape today together.",
    tonePack: "soft",
    setTonePack: mocks.planner.setTonePack,
    horizon: "day",
    setHorizon: mocks.planner.setHorizon,
    messages: [
      {
        id: "m1",
        role: "companion",
        content: "Let's shape today together.",
        createdAt: "2026-04-18T08:00:00.000Z",
      },
      {
        id: "m2",
        role: "user",
        content: "Write for my newsletter every weekday",
        createdAt: "2026-04-18T08:01:00.000Z",
        inputMode: "text",
      },
    ],
    questions: [
      {
        id: "time_of_day",
        prompt: "What time of day should this live in your schedule?",
        reason: "I want to place it where you're likely to follow through.",
        required: true,
        field: "time_of_day",
        options: ["Morning", "Afternoon", "Evening", "Night"],
      },
    ],
    proposals: [
      {
        id: "proposal-1",
        kind: "create_quest",
        title: "Create Write for my newsletter",
        summary: "Create a recurring quest for writing your newsletter.",
        reasoning: "Repeated work defaults to a recurring quest.",
        payload: {},
        status: "pending",
        readyToConfirm: false,
        missingFields: ["time of day", "why that time works"],
      },
    ],
    pendingProposals: [],
    readyProposalCount: 0,
    draftInput: "Help me plan my month",
    setDraftInput: mocks.planner.setDraftInput,
    interimText: "",
    isSubmitting: false,
    isClassifying: false,
    isRecording: false,
    isAutoStopping: false,
    isVoiceSupported: true,
    permissionStatus: "granted",
    showPermissionDialog: false,
    setShowPermissionDialog: mocks.planner.setShowPermissionDialog,
    isRequestingPermission: false,
    submitTypedMessage: mocks.planner.submitTypedMessage,
    submitMessage: vi.fn(),
    toggleRecording: mocks.planner.toggleRecording,
    requestMicrophonePermission: mocks.planner.requestMicrophonePermission,
    confirmProposal: mocks.planner.confirmProposal,
    rejectProposal: mocks.planner.rejectProposal,
    confirmAll: mocks.planner.confirmAll,
    sessionState: {
      draft: {},
      openQuestionIds: [],
      preferredTimeOfDay: null,
      preferredTimeReason: null,
      reminderPreference: null,
      lastClassification: "habit",
    },
    plannerMemory: {
      preferredTimeOfDay: "morning",
      preferredTimeReason: "I have the most energy before email.",
    },
    scheduleInsights: {
      horizon: "day",
      selectedDate: "2026-04-18",
      dayLoads: [
        {
          date: "2026-04-18",
          totalMinutes: 180,
          taskCount: 3,
          status: "balanced",
        },
      ],
      overloadedDates: [],
      emptyDates: [],
      conflicts: [
        {
          date: "2026-04-18",
          taskAId: "m1",
          taskATitle: "Morning review",
          taskBId: "m2",
          taskBTitle: "Newsletter draft",
          overlapMinutes: 15,
        },
      ],
      suggestedSlots: [
        {
          date: "2026-04-18",
          time: "09:00",
          endTime: "10:00",
          score: 88,
          reason: "Fits your usual morning rhythm.",
        },
      ],
      moveSuggestions: [
        {
          fromDate: "2026-04-18",
          toDate: "2026-04-19",
          taskId: "proposal-1",
          taskTitle: "Write for my newsletter",
          suggestedTime: "09:00",
          reason: "Tomorrow is lighter.",
        },
      ],
      summary: "Today has room at 09:00, but there is one overlap to resolve.",
    },
    todayLabel: "Saturday, April 18",
    isLoadingContext: false,
  }),
}));

import { CompanionPlannerPanel } from "./CompanionPlannerPanel";

describe("CompanionPlannerPanel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.accessState.isSubscribed = true;
    mocks.chatState.handoffToPlanner = false;
    mocks.chatState.speechProvider = "device";
  });

  it("defaults premium users into Talk mode with voice controls and transcript", async () => {
    render(<CompanionPlannerPanel />);

    expect(screen.getByTestId("companion-planner-panel")).toBeInTheDocument();
    expect(screen.getByTestId("companion-mode-tabs")).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByTestId("companion-talk-text-input")).toBeInTheDocument();
      expect(screen.getByTestId("companion-talk-transcript")).toBeInTheDocument();
      expect(screen.getByTestId("companion-talk-autoplay-toggle")).toBeInTheDocument();
      expect(screen.getByTestId("companion-talk-mute-toggle")).toBeInTheDocument();
      expect(screen.getByText(/on-device voice/i)).toBeInTheDocument();
    });
  });

  it("routes Talk and Plan actions through their respective hooks", async () => {
    const firstRender = render(<CompanionPlannerPanel />);

    await waitFor(() => {
      expect(screen.getByTestId("companion-talk-send-button")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId("companion-talk-mic-button"));
    fireEvent.click(screen.getByTestId("companion-talk-send-button"));

    expect(mocks.chat.toggleRecording).toHaveBeenCalledTimes(1);
    expect(mocks.chat.submitTypedMessage).toHaveBeenCalledTimes(1);

    firstRender.unmount();
    mocks.accessState.isSubscribed = false;

    render(<CompanionPlannerPanel />);

    fireEvent.click(screen.getByTestId("planner-mic-button"));
    fireEvent.click(screen.getByTestId("planner-send-button"));
    fireEvent.click(screen.getByRole("button", { name: "Reject" }));

    expect(mocks.planner.toggleRecording).toHaveBeenCalledTimes(1);
    expect(mocks.planner.submitTypedMessage).toHaveBeenCalledTimes(1);
    expect(mocks.planner.rejectProposal).toHaveBeenCalledWith("proposal-1");
  });

  it("keeps Plan available for non-premium users while showing the Talk upsell state", () => {
    mocks.accessState.isSubscribed = false;

    render(<CompanionPlannerPanel />);

    expect(screen.getByTestId("companion-talk-locked")).toBeInTheDocument();
    expect(screen.getByTestId("planner-text-input")).toBeInTheDocument();
    expect(screen.queryByTestId("companion-talk-text-input")).not.toBeInTheDocument();
  });

  it("switches to Plan when Talk returns a planner handoff", async () => {
    mocks.chatState.handoffToPlanner = true;
    mocks.chatState.speechProvider = "none";

    render(<CompanionPlannerPanel />);

    await waitFor(() => {
      expect(screen.getByTestId("planner-handoff-banner")).toBeInTheDocument();
      expect(screen.getByTestId("planner-text-input")).toBeInTheDocument();
    });
  });
});
