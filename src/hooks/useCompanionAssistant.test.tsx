import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  toastError: vi.fn(),
  parseNaturalLanguage: vi.fn(() => ({})),
  companionSubmit: vi.fn().mockResolvedValue(undefined),
  journeysSubmit: vi.fn().mockResolvedValue(undefined),
  plannerSubmit: vi.fn().mockResolvedValue(undefined),
  setHorizon: vi.fn(),
  confirmProposal: vi.fn(),
  rejectProposal: vi.fn(),
  confirmAll: vi.fn(),
  setAutoplayVoice: vi.fn(),
  setMuteSpokenReplies: vi.fn(),
  toggleRecording: vi.fn(),
  requestPermission: vi.fn().mockResolvedValue("granted"),
  stopCompanionSpeech: vi.fn(),
  state: {
    companionMessages: [
      {
        id: "chat-1",
        role: "assistant" as const,
        content: "I'm here.",
        createdAt: "2026-04-18T08:00:00.000Z",
        inputMode: "text" as const,
      },
    ],
    journeysMessages: [
      {
        id: "journeys-1",
        role: "assistant" as const,
        content: "What's the next move?",
        createdAt: "2026-04-18T08:00:00.000Z",
        inputMode: "text" as const,
      },
    ],
    plannerMessages: [] as Array<{
      id: string;
      role: "companion" | "user";
      content: string;
      createdAt: string;
      inputMode?: "text" | "voice";
    }>,
    plannerQuestions: [] as Array<{
      id: string;
      prompt: string;
      required: boolean;
      field: string;
    }>,
    pendingProposals: [] as Array<{
      id: string;
      status: "pending" | "confirmed" | "rejected";
      kind: "update_quest";
      title: string;
      summary: string;
      payload: Record<string, unknown>;
      readyToConfirm: boolean;
    }>,
    companionChatEnabled: true,
  },
}));

vi.mock("@/components/ui/sonner", () => ({
  toast: {
    error: mocks.toastError,
  },
}));

vi.mock("@/features/tasks/hooks/useNaturalLanguageParser", () => ({
  parseNaturalLanguage: mocks.parseNaturalLanguage,
}));

vi.mock("@/hooks/useCompanion", () => ({
  useCompanion: () => ({
    companion: { id: "companion-1" },
  }),
}));

vi.mock("@/hooks/useCompanionDialogue", () => ({
  useCompanionDialogue: () => ({
    greeting: "You made it back.",
    voiceStyle: "steady",
  }),
}));

vi.mock("@/hooks/useVoiceInput", () => ({
  useVoiceInput: () => ({
    isRecording: false,
    isAutoStopping: false,
    isSupported: true,
    permissionStatus: "granted" as const,
    toggleRecording: mocks.toggleRecording,
    requestPermission: mocks.requestPermission,
  }),
}));

vi.mock("@/services/companionSpeech", () => ({
  speakCompanionReply: vi.fn(),
  stopCompanionSpeech: mocks.stopCompanionSpeech,
}));

vi.mock("@/hooks/useCompanionChat", () => ({
  useCompanionChat: (options?: { enabled?: boolean }) => {
    mocks.state.companionChatEnabled = options?.enabled ?? true;
    return {
      greeting: "You made it back.",
      messages: mocks.state.companionMessages,
      isSubmitting: false,
      submitMessage: mocks.companionSubmit,
      autoplayVoice: false,
      setAutoplayVoice: mocks.setAutoplayVoice,
      muteSpokenReplies: false,
      setMuteSpokenReplies: mocks.setMuteSpokenReplies,
      isSpeaking: false,
      speechProvider: "none" as const,
      stopSpeaking: vi.fn(),
    };
  },
}));

vi.mock("@/hooks/useJourneysCompanionConversation", () => ({
  useJourneysCompanionConversation: () => ({
    greeting: "The road's open. What are we setting in motion?",
    messages: mocks.state.journeysMessages,
    isSubmitting: false,
    submitMessage: mocks.journeysSubmit,
    draftInput: "",
    setDraftInput: vi.fn(),
    interimText: "",
    pendingPlannerHandoffMessage: null,
    clearPlannerHandoff: vi.fn(),
    isRecording: false,
    isAutoStopping: false,
    isVoiceSupported: true,
    permissionStatus: "granted" as const,
    showPermissionDialog: false,
    setShowPermissionDialog: vi.fn(),
    isRequestingPermission: false,
    submitTypedMessage: vi.fn(),
    toggleRecording: mocks.toggleRecording,
    requestMicrophonePermission: vi.fn(),
  }),
}));

vi.mock("@/hooks/useCompanionPlanner", () => ({
  useCompanionPlanner: () => ({
    greeting: "The road's open. What are we setting in motion?",
    messages: mocks.state.plannerMessages,
    questions: mocks.state.plannerQuestions,
    proposals: mocks.state.pendingProposals,
    pendingProposals: mocks.state.pendingProposals,
    readyProposalCount: mocks.state.pendingProposals.filter((proposal) => proposal.readyToConfirm).length,
    plannerMemory: null,
    scheduleInsights: null,
    todayLabel: "Saturday, April 18",
    isLoadingContext: false,
    horizon: "day" as const,
    setHorizon: mocks.setHorizon,
    isSubmitting: false,
    isClassifying: false,
    submitMessage: mocks.plannerSubmit,
    confirmProposal: mocks.confirmProposal,
    rejectProposal: mocks.rejectProposal,
    confirmAll: mocks.confirmAll,
  }),
}));

import { useCompanionAssistant } from "./useCompanionAssistant";

describe("useCompanionAssistant", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.parseNaturalLanguage.mockReturnValue({});
    mocks.companionSubmit.mockResolvedValue(undefined);
    mocks.journeysSubmit.mockResolvedValue(undefined);
    mocks.plannerSubmit.mockResolvedValue(undefined);
    mocks.state.companionMessages = [
      {
        id: "chat-1",
        role: "assistant",
        content: "I'm here.",
        createdAt: "2026-04-18T08:00:00.000Z",
        inputMode: "text",
      },
    ];
    mocks.state.journeysMessages = [
      {
        id: "journeys-1",
        role: "assistant",
        content: "What's the next move?",
        createdAt: "2026-04-18T08:00:00.000Z",
        inputMode: "text",
      },
    ];
    mocks.state.plannerMessages = [];
    mocks.state.plannerQuestions = [];
    mocks.state.pendingProposals = [];
    mocks.state.companionChatEnabled = true;
  });

  it("merges chat and planner messages into one sorted transcript with sources", () => {
    mocks.state.plannerMessages = [
      {
        id: "plan-1",
        role: "companion",
        content: "Your afternoon is open.",
        createdAt: "2026-04-18T09:00:00.000Z",
        inputMode: "text",
      },
    ];

    const { result } = renderHook(() => useCompanionAssistant({ surface: "companion" }));

    expect(result.current.messages).toEqual([
      expect.objectContaining({
        id: "chat-1",
        role: "assistant",
        source: "chat",
      }),
      expect.objectContaining({
        id: "plan-1",
        role: "assistant",
        source: "plan",
      }),
    ]);
  });

  it("routes planning requests to the planner on the companion surface", async () => {
    const { result } = renderHook(() => useCompanionAssistant({ surface: "companion" }));

    await act(async () => {
      await result.current.submitMessage("Move my workout quest to 6 pm", "text");
    });

    expect(mocks.plannerSubmit).toHaveBeenCalledWith("Move my workout quest to 6 pm", "text");
    expect(mocks.companionSubmit).not.toHaveBeenCalled();
  });

  it("routes all journeys conversation through the planner-backed assistant", async () => {
    const { result } = renderHook(() => useCompanionAssistant({ surface: "journeys" }));

    await act(async () => {
      await result.current.submitMessage("I just need a pep talk.", "voice");
    });

    expect(mocks.plannerSubmit).toHaveBeenCalledWith("I just need a pep talk.", "voice");
    expect(mocks.journeysSubmit).not.toHaveBeenCalled();
  });

  it("lets planner starter submissions bypass the freeform routing heuristic", async () => {
    const { result } = renderHook(() => useCompanionAssistant({ surface: "journeys" }));

    await act(async () => {
      await result.current.submitPlannerMessage("Help me break a big goal into steps.", "text");
    });

    expect(mocks.plannerSubmit).toHaveBeenCalledWith("Help me break a big goal into steps.", "text");
    expect(mocks.journeysSubmit).not.toHaveBeenCalled();
    expect(mocks.companionSubmit).not.toHaveBeenCalled();
  });

  it("keeps the existing companion greeting while exposing the planner greeting on journeys", () => {
    const companion = renderHook(() => useCompanionAssistant({ surface: "companion" }));
    const journeys = renderHook(() => useCompanionAssistant({ surface: "journeys" }));

    expect(companion.result.current.greeting).toBe("You made it back.");
    expect(journeys.result.current.greeting).toBe(
      "The road's open. What are we setting in motion?",
    );
  });

  it("uses the journeys-specific placeholder copy across planner states", () => {
    const journeys = renderHook(() => useCompanionAssistant({ surface: "journeys" }));
    expect(journeys.result.current.placeholder).toBe("Tell me the move.");

    mocks.state.plannerQuestions = [
      {
        id: "time-of-day",
        prompt: "When should this happen?",
        required: true,
        field: "details",
      },
    ];

    const withOpenThread = renderHook(() => useCompanionAssistant({ surface: "journeys" }));
    expect(withOpenThread.result.current.placeholder).toBe("Tell me the move.");
  });

  it("keeps routing follow-up answers to the planner while a planner thread is open", async () => {
    mocks.state.plannerQuestions = [
      {
        id: "which-quest",
        prompt: "Which quest did you mean?",
        required: true,
        field: "details",
      },
    ];

    const { result } = renderHook(() => useCompanionAssistant({ surface: "companion" }));

    await act(async () => {
      await result.current.submitMessage("The workout one.", "text");
    });

    expect(mocks.plannerSubmit).toHaveBeenCalledWith("The workout one.", "text");
    expect(mocks.companionSubmit).not.toHaveBeenCalled();
  });

  it("blocks premium-gated freeform companion chat while still allowing planning", async () => {
    const { result } = renderHook(() => useCompanionAssistant({
      surface: "companion",
      conversationEnabled: false,
    }));

    await act(async () => {
      await result.current.submitMessage("Talk to me for a minute.", "text");
    });

    expect(mocks.toastError).toHaveBeenCalledWith(
      "Companion Talk is a Premium feature. Planning and scheduling still work here.",
    );
    expect(mocks.companionSubmit).not.toHaveBeenCalled();
    expect(mocks.plannerSubmit).not.toHaveBeenCalled();

    await act(async () => {
      await result.current.submitMessage("What do I have scheduled today?", "text");
    });

    expect(mocks.plannerSubmit).toHaveBeenCalledWith("What do I have scheduled today?", "text");
  });
});
