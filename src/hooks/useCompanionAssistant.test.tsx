import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  toastError: vi.fn(),
  parseNaturalLanguage: vi.fn(() => ({})),
  companionSubmit: vi.fn().mockResolvedValue(undefined),
  journeysSubmit: vi.fn().mockResolvedValue(undefined),
  plannerSubmit: vi.fn().mockResolvedValue(undefined),
  primeQuestCapture: vi.fn(),
  openCampaignBuilder: vi.fn(),
  clearPlannerHandoff: vi.fn(),
  injectAssistantOpening: vi.fn(),
  resetJourneysThread: vi.fn(),
  hydrateJourneysThread: vi.fn(),
  resetPlannerThread: vi.fn(),
  hydratePlannerThread: vi.fn(),
  setHorizon: vi.fn(),
  confirmProposal: vi.fn(),
  rejectProposal: vi.fn(),
  confirmAll: vi.fn(),
  setAutoplayVoice: vi.fn(),
  setMuteSpokenReplies: vi.fn(),
  toggleRecording: vi.fn(),
  requestPermission: vi.fn().mockResolvedValue("granted"),
  speakCompanionReply: vi.fn().mockResolvedValue("device"),
  stopCompanionSpeech: vi.fn(),
  stopSpeaking: vi.fn(),
  startNewChat: vi.fn().mockResolvedValue(undefined),
  startTemplateThread: vi.fn().mockReturnValue("fresh-template-session"),
  archiveCurrentThread: vi.fn().mockResolvedValue(undefined),
  resumeThread: vi.fn().mockResolvedValue(undefined),
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
        speechText: "What's the next move?",
        createdAt: "2026-04-18T08:00:00.000Z",
        inputMode: "text" as const,
      },
    ] as Array<{
      id: string;
      role: "assistant" | "user";
      content: string;
      speechText?: string;
      createdAt: string;
      inputMode?: "text" | "voice";
    }>,
    journeysSessionId: "journeys-session-1",
    plannerSessionId: "planner-session-1",
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
    plannerSessionState: {
      draft: {},
      openQuestionIds: [],
      preferredTimeOfDay: null,
      preferredTimeReason: null,
      reminderPreference: null,
      pendingStarterIntent: null as null | "plan_day" | "quest_capture" | "upcoming_start" | "goal_breakdown_start",
      lastClassification: null as null | "quest" | "epic" | "habit" | "brain-dump",
    },
    pendingProposals: [] as Array<{
      id: string;
      status: "pending" | "confirmed" | "modified" | "rejected";
      kind: "update_quest";
      title: string;
      summary: string;
      payload: Record<string, unknown>;
      readyToConfirm: boolean;
    }>,
    pendingPlannerHandoffMessage: null as string | null,
    companionChatEnabled: true,
    autoplayVoice: false,
    muteSpokenReplies: false,
    companionIsSpeaking: false,
    companionSpeechProvider: "none" as "none" | "device" | "cloud",
    hasPersistedActiveThread: true,
    canStartNewChat: true,
    newChatDisabledReason: null as string | null,
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

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({
    user: { id: "user-1" },
  }),
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
  speakCompanionReply: mocks.speakCompanionReply,
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
      autoplayVoice: mocks.state.autoplayVoice,
      setAutoplayVoice: mocks.setAutoplayVoice,
      muteSpokenReplies: mocks.state.muteSpokenReplies,
      setMuteSpokenReplies: mocks.setMuteSpokenReplies,
      isSpeaking: mocks.state.companionIsSpeaking,
      speechProvider: mocks.state.companionSpeechProvider,
      stopSpeaking: mocks.stopSpeaking,
    };
  },
}));

vi.mock("@/hooks/useJourneysCompanionConversation", () => ({
  useJourneysCompanionConversation: () => ({
    greeting: "The road's open. What are we setting in motion?",
    sessionId: mocks.state.journeysSessionId,
    messages: mocks.state.journeysMessages,
    isSubmitting: false,
    submitMessage: mocks.journeysSubmit,
    draftInput: "",
    setDraftInput: vi.fn(),
    interimText: "",
    pendingPlannerHandoffMessage: mocks.state.pendingPlannerHandoffMessage,
    threadPersistenceReady: true,
    threadPersistenceUnavailableReason: null,
    clearPlannerHandoff: mocks.clearPlannerHandoff,
    injectAssistantOpening: mocks.injectAssistantOpening,
    resetThread: mocks.resetJourneysThread,
    hydrateThread: mocks.hydrateJourneysThread,
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
    sessionId: mocks.state.plannerSessionId,
    messages: mocks.state.plannerMessages,
    hasRealMessages: mocks.state.plannerMessages.length > 0,
    questions: mocks.state.plannerQuestions,
    proposals: mocks.state.pendingProposals,
    pendingProposals: mocks.state.pendingProposals,
    readyProposalCount: mocks.state.pendingProposals.filter((proposal) => proposal.readyToConfirm).length,
    plannerMemory: null,
    scheduleInsights: null,
    currentDate: "2026-04-18",
    plannerContext: {
      tasks: [],
      inboxTasks: [],
      activeEpics: [],
      rituals: [],
      calendarEvents: [],
      scheduleInsights: null,
      plannerMemory: null,
      aiSignals: undefined,
    },
    todayLabel: "Saturday, April 18",
    isLoadingContext: false,
    horizon: "day" as const,
    setHorizon: mocks.setHorizon,
    isSubmitting: false,
    isClassifying: false,
    submitMessage: mocks.plannerSubmit,
    primeQuestCapture: mocks.primeQuestCapture,
    resetThread: mocks.resetPlannerThread,
    hydrateThread: mocks.hydratePlannerThread,
    confirmProposal: mocks.confirmProposal,
    rejectProposal: mocks.rejectProposal,
    confirmAll: mocks.confirmAll,
    sessionState: mocks.state.plannerSessionState,
  }),
}));

vi.mock("@/hooks/useJourneysCompanionThreads", () => ({
  useJourneysCompanionThreads: () => ({
    activeSessionId: "journeys-session-1",
    activeThread: {
      sessionId: "journeys-session-1",
      companionId: "companion-1",
      surface: "journeys" as const,
      title: "Current thread",
      previewText: "What's the next move?",
      createdAt: "2026-04-18T08:00:00.000Z",
      lastMessageAt: "2026-04-18T08:00:00.000Z",
      archivedAt: null,
      messageCount: 2,
    },
    historyThreads: [
      {
        sessionId: "archived-session-1",
        companionId: "companion-1",
        surface: "journeys" as const,
        title: "Older thread",
        previewText: "Let's pick it back up.",
        createdAt: "2026-04-17T08:00:00.000Z",
        lastMessageAt: "2026-04-17T08:05:00.000Z",
        archivedAt: "2026-04-17T09:00:00.000Z",
        messageCount: 4,
      },
    ],
    canOpenThreadPicker: true,
    threadPickerDisabledReason: null,
    threadHistoryEmptyStateMessage: "Past chats will show up here after at least one real exchange.",
    hasPersistedActiveThread: mocks.state.hasPersistedActiveThread,
    canStartNewChat: mocks.state.canStartNewChat,
    newChatDisabledReason: mocks.state.newChatDisabledReason,
    startNewChat: mocks.startNewChat,
    startTemplateThread: mocks.startTemplateThread,
    canArchiveThread: true,
    archiveDisabledReason: null,
    archiveCurrentThread: mocks.archiveCurrentThread,
    resumeThread: mocks.resumeThread,
    isLoadingThreads: false,
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
    mocks.speakCompanionReply.mockResolvedValue("device");
    mocks.openCampaignBuilder.mockReset();
    mocks.injectAssistantOpening.mockReset();
    mocks.startTemplateThread.mockReset();
    mocks.startTemplateThread.mockReturnValue("fresh-template-session");
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
        speechText: "What's the next move?",
        createdAt: "2026-04-18T08:00:00.000Z",
        inputMode: "text",
      },
    ];
    mocks.state.journeysSessionId = "journeys-session-1";
    mocks.state.plannerSessionId = "planner-session-1";
    mocks.state.plannerMessages = [];
    mocks.state.plannerQuestions = [];
    mocks.state.plannerSessionState = {
      draft: {},
      openQuestionIds: [],
      preferredTimeOfDay: null,
      preferredTimeReason: null,
      reminderPreference: null,
      pendingStarterIntent: null,
      lastClassification: null,
    };
    mocks.state.pendingProposals = [];
    mocks.state.pendingPlannerHandoffMessage = null;
    mocks.state.companionChatEnabled = true;
    mocks.state.autoplayVoice = false;
    mocks.state.muteSpokenReplies = false;
    mocks.state.companionIsSpeaking = false;
    mocks.state.companionSpeechProvider = "none";
    mocks.state.hasPersistedActiveThread = true;
    mocks.state.canStartNewChat = true;
    mocks.state.newChatDisabledReason = null;
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

  it("routes casual journeys conversation through the chat lane first", async () => {
    const { result } = renderHook(() => useCompanionAssistant({ surface: "journeys" }));

    await act(async () => {
      await result.current.submitMessage("I just need a pep talk.", "voice");
    });

    expect(mocks.journeysSubmit).toHaveBeenCalledWith(
      "I just need a pep talk.",
      "voice",
      expect.objectContaining({
        currentDate: "2026-04-18",
        currentDateTime: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}[+-]\d{2}:\d{2}$/),
        journeysContext: expect.objectContaining({
          tasks: [],
          inboxTasks: [],
        }),
      }),
    );
    expect(mocks.plannerSubmit).not.toHaveBeenCalled();
  });

  it("keeps direct schedule reads on journeys in the chat lane", async () => {
    const { result } = renderHook(() => useCompanionAssistant({ surface: "journeys" }));

    await act(async () => {
      await result.current.submitMessage("Show me today's route.", "text");
    });

    expect(mocks.journeysSubmit).toHaveBeenCalledWith(
      "Show me today's route.",
      "text",
      expect.objectContaining({
        currentDate: "2026-04-18",
        currentDateTime: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}[+-]\d{2}:\d{2}$/),
      }),
    );
    expect(mocks.plannerSubmit).not.toHaveBeenCalled();
  });

  it("keeps named-day schedule reads on journeys in the chat lane", async () => {
    const { result } = renderHook(() => useCompanionAssistant({ surface: "journeys" }));

    await act(async () => {
      await result.current.submitMessage("How does my upcoming Saturday look?", "text");
    });

    expect(mocks.journeysSubmit).toHaveBeenCalledWith(
      "How does my upcoming Saturday look?",
      "text",
      expect.objectContaining({
        currentDate: "2026-04-18",
        currentDateTime: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}[+-]\d{2}:\d{2}$/),
      }),
    );
    expect(mocks.plannerSubmit).not.toHaveBeenCalled();
  });

  it("keeps broad day-planning prompts on journeys in the chat lane", async () => {
    const { result } = renderHook(() => useCompanionAssistant({ surface: "journeys" }));

    await act(async () => {
      await result.current.submitMessage("Help me plan today.", "text");
    });

    expect(mocks.journeysSubmit).toHaveBeenCalledWith(
      "Help me plan today.",
      "text",
      expect.objectContaining({
        currentDate: "2026-04-18",
        currentDateTime: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}[+-]\d{2}:\d{2}$/),
      }),
    );
    expect(mocks.plannerSubmit).not.toHaveBeenCalled();
  });

  it("routes bare scheduled quest phrases on journeys straight to the planner", async () => {
    mocks.parseNaturalLanguage.mockReturnValue({
      text: "gym",
      scheduledDate: "2026-04-19",
      scheduledTime: "17:00",
    });

    const { result } = renderHook(() => useCompanionAssistant({ surface: "journeys" }));

    await act(async () => {
      await result.current.submitMessage("gym at 5pm tomorrow", "text");
    });

    expect(mocks.plannerSubmit).toHaveBeenCalledWith("gym at 5pm tomorrow", "text");
    expect(mocks.journeysSubmit).not.toHaveBeenCalled();
  });

  it("routes question-form scheduling requests on journeys to the planner", async () => {
    mocks.parseNaturalLanguage.mockReturnValue({
      text: "gym",
      scheduledDate: "2026-04-19",
      scheduledTime: "17:00",
      recurrencePattern: null,
      reminderMinutesBefore: null,
    });

    const { result } = renderHook(() => useCompanionAssistant({ surface: "journeys" }));

    await act(async () => {
      await result.current.submitMessage("can you put gym at 5pm tomorrow?", "text");
    });

    expect(mocks.plannerSubmit).toHaveBeenCalledWith("can you put gym at 5pm tomorrow?", "text");
    expect(mocks.journeysSubmit).not.toHaveBeenCalled();
  });

  it("routes question-form rescheduling requests on journeys to the planner", async () => {
    mocks.parseNaturalLanguage.mockReturnValue({
      text: "workout",
      scheduledDate: null,
      scheduledTime: null,
      recurrencePattern: null,
      reminderMinutesBefore: null,
    });

    const { result } = renderHook(() => useCompanionAssistant({ surface: "journeys" }));

    await act(async () => {
      await result.current.submitMessage("can you move workout to 6?", "text");
    });

    expect(mocks.plannerSubmit).toHaveBeenCalledWith("can you move workout to 6?", "text");
    expect(mocks.journeysSubmit).not.toHaveBeenCalled();
  });

  it("routes reminder requests on journeys to the planner", async () => {
    mocks.parseNaturalLanguage.mockReturnValue({
      text: "workout",
      scheduledDate: null,
      scheduledTime: null,
      recurrencePattern: null,
      reminderMinutesBefore: 30,
    });

    const { result } = renderHook(() => useCompanionAssistant({ surface: "journeys" }));

    await act(async () => {
      await result.current.submitMessage("remind me 30 minutes before workout", "text");
    });

    expect(mocks.plannerSubmit).toHaveBeenCalledWith("remind me 30 minutes before workout", "text");
    expect(mocks.journeysSubmit).not.toHaveBeenCalled();
  });

  it("keeps how-does-tomorrow-look prompts in the journeys chat lane", async () => {
    const { result } = renderHook(() => useCompanionAssistant({ surface: "journeys" }));

    await act(async () => {
      await result.current.submitMessage("How does tomorrow look?", "text");
    });

    expect(mocks.journeysSubmit).toHaveBeenCalledWith(
      "How does tomorrow look?",
      "text",
      expect.objectContaining({
        currentDate: "2026-04-18",
      }),
    );
    expect(mocks.plannerSubmit).not.toHaveBeenCalled();
  });

  it("opens the campaign builder for journeys big-goal requests", async () => {
    mocks.parseNaturalLanguage.mockReturnValue({
      text: "getting my real estate license by August",
      scheduledDate: null,
      scheduledTime: null,
      estimatedDuration: null,
      recurrencePattern: null,
      reminderMinutesBefore: null,
    });

    const { result } = renderHook(() => useCompanionAssistant({
      surface: "journeys",
      onOpenCampaignBuilder: mocks.openCampaignBuilder,
    }));

    await act(async () => {
      await result.current.submitMessage("I need help getting my real estate license by August", "text");
    });

    expect(mocks.openCampaignBuilder).toHaveBeenCalledWith(
      "I need help getting my real estate license by August",
    );
    expect(mocks.journeysSubmit).not.toHaveBeenCalled();
    expect(mocks.plannerSubmit).not.toHaveBeenCalled();
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
    expect(journeys.result.current.placeholder).toBe("Chat");

    mocks.state.plannerQuestions = [
      {
        id: "time-of-day",
        prompt: "When should this happen?",
        required: true,
        field: "details",
      },
    ];

    const withOpenThread = renderHook(() => useCompanionAssistant({ surface: "journeys" }));
    expect(withOpenThread.result.current.placeholder).toBe("Reply here...");
  });

  it("exposes shared voice settings and setters on the journeys surface", () => {
    mocks.state.autoplayVoice = true;
    mocks.state.muteSpokenReplies = false;

    const { result } = renderHook(() => useCompanionAssistant({ surface: "journeys" }));

    expect(result.current.autoplayVoice).toBe(true);
    expect(result.current.muteSpokenReplies).toBe(false);
    expect(result.current.setAutoplayVoice).toBe(mocks.setAutoplayVoice);
    expect(result.current.setMuteSpokenReplies).toBe(mocks.setMuteSpokenReplies);
  });

  it("autoplays fresh journeys chat replies with speechText when voice is enabled", async () => {
    mocks.state.autoplayVoice = true;
    const { rerender } = renderHook(() => useCompanionAssistant({ surface: "journeys" }));

    mocks.speakCompanionReply.mockClear();
    mocks.state.journeysMessages = [
      ...mocks.state.journeysMessages,
      {
        id: "journeys-2",
        role: "assistant",
        content: "Displayed reply",
        speechText: "Spoken reply",
        createdAt: "2026-04-18T08:02:00.000Z",
        inputMode: "text",
      },
    ];

    await act(async () => {
      rerender();
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(mocks.speakCompanionReply).toHaveBeenCalledWith({
        text: "Spoken reply",
        companionId: "companion-1",
        voiceStyle: "steady",
        sessionId: "journeys-session-1",
      });
    });
  });

  it("autoplays fresh journeys planner replies with planner content when voice is enabled", async () => {
    mocks.state.autoplayVoice = true;
    const { rerender } = renderHook(() => useCompanionAssistant({ surface: "journeys" }));

    mocks.speakCompanionReply.mockClear();
    mocks.state.plannerMessages = [
      {
        id: "plan-1",
        role: "companion",
        content: "Lock in that 4 pm focus block.",
        createdAt: "2026-04-18T08:03:00.000Z",
        inputMode: "text",
      },
    ];

    await act(async () => {
      rerender();
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(mocks.speakCompanionReply).toHaveBeenCalledWith({
        text: "Lock in that 4 pm focus block.",
        companionId: "companion-1",
        voiceStyle: "steady",
        sessionId: "planner-session-1",
      });
    });
  });

  it("does not autoplay journeys replies when autoplay is off or spoken replies are muted", async () => {
    mocks.state.autoplayVoice = false;
    const { rerender } = renderHook(() => useCompanionAssistant({ surface: "journeys" }));

    mocks.speakCompanionReply.mockClear();
    mocks.state.journeysMessages = [
      ...mocks.state.journeysMessages,
      {
        id: "journeys-2",
        role: "assistant",
        content: "Displayed reply",
        speechText: "Spoken reply",
        createdAt: "2026-04-18T08:02:00.000Z",
        inputMode: "text",
      },
    ];

    await act(async () => {
      rerender();
      await Promise.resolve();
    });

    expect(mocks.speakCompanionReply).not.toHaveBeenCalled();

    mocks.state.autoplayVoice = true;
    mocks.state.muteSpokenReplies = true;
    mocks.state.journeysMessages = [
      ...mocks.state.journeysMessages,
      {
        id: "journeys-3",
        role: "assistant",
        content: "Still quiet",
        speechText: "Still quiet",
        createdAt: "2026-04-18T08:03:00.000Z",
        inputMode: "text",
      },
    ];

    await act(async () => {
      rerender();
      await Promise.resolve();
    });

    expect(mocks.speakCompanionReply).not.toHaveBeenCalled();
  });

  it("stops active journeys speech when the shared voice settings are turned off", async () => {
    mocks.state.autoplayVoice = true;
    const { rerender } = renderHook(() => useCompanionAssistant({ surface: "journeys" }));

    mocks.stopCompanionSpeech.mockClear();
    mocks.state.autoplayVoice = false;

    await act(async () => {
      rerender();
      await Promise.resolve();
    });

    expect(mocks.stopCompanionSpeech).toHaveBeenCalled();
  });

  it("does not replay historical assistant turns when a journeys thread is hydrated", async () => {
    const { rerender } = renderHook(() => useCompanionAssistant({ surface: "journeys" }));

    mocks.speakCompanionReply.mockClear();
    mocks.state.journeysSessionId = "journeys-session-2";
    mocks.state.plannerSessionId = "planner-session-2";
    mocks.state.journeysMessages = [
      {
        id: "journeys-history-1",
        role: "assistant",
        content: "Yesterday had a softer pace.",
        speechText: "Yesterday had a softer pace.",
        createdAt: "2026-04-17T08:00:00.000Z",
        inputMode: "text",
      },
    ];
    mocks.state.plannerMessages = [
      {
        id: "plan-history-1",
        role: "companion",
        content: "I also drafted a focus block there.",
        createdAt: "2026-04-17T08:05:00.000Z",
        inputMode: "text",
      },
    ];

    await act(async () => {
      rerender();
      await Promise.resolve();
    });

    expect(mocks.speakCompanionReply).not.toHaveBeenCalled();
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

  it("lets journeys break back into chat even when an old planner thread is open", async () => {
    mocks.state.plannerQuestions = [
      {
        id: "time-of-day",
        prompt: "When should this happen?",
        required: true,
        field: "details",
      },
    ];

    const { result } = renderHook(() => useCompanionAssistant({ surface: "journeys" }));

    await act(async () => {
      await result.current.submitMessage("How does today look?", "text");
    });

    expect(mocks.journeysSubmit).toHaveBeenCalledWith(
      "How does today look?",
      "text",
      expect.objectContaining({
        currentDate: "2026-04-18",
        currentDateTime: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}[+-]\d{2}:\d{2}$/),
      }),
    );
    expect(mocks.plannerSubmit).not.toHaveBeenCalled();
  });

  it("keeps quest-capture follow-up replies on the planner lane while the starter intent is pending", async () => {
    mocks.state.plannerSessionState = {
      draft: {
        draftKind: "create_quest",
      },
      openQuestionIds: [],
      preferredTimeOfDay: null,
      preferredTimeReason: null,
      reminderPreference: null,
      pendingStarterIntent: "quest_capture",
      lastClassification: "quest",
    };

    const { result } = renderHook(() => useCompanionAssistant({ surface: "journeys" }));

    await act(async () => {
      await result.current.submitMessage("Write my newsletter", "text");
    });

    expect(mocks.plannerSubmit).toHaveBeenCalledWith("Write my newsletter", "text");
    expect(mocks.journeysSubmit).not.toHaveBeenCalled();
    expect(mocks.openCampaignBuilder).not.toHaveBeenCalled();
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

  it("forwards journeys planning handoffs into the planner without echoing the user twice", async () => {
    mocks.state.pendingPlannerHandoffMessage = "Help me plan tomorrow";

    renderHook(() => useCompanionAssistant({ surface: "journeys" }));

    await act(async () => {
      await Promise.resolve();
    });

    expect(mocks.plannerSubmit).toHaveBeenCalledWith(
      "Help me plan tomorrow",
      "text",
      { skipUserEcho: true },
    );
    expect(mocks.clearPlannerHandoff).toHaveBeenCalledTimes(1);
  });

  it("submits queued journeys launch intents through the planner with starter context", async () => {
    const onLaunchIntentConsumed = vi.fn();

    renderHook(() => useCompanionAssistant({
      surface: "journeys",
      launchIntent: {
        id: "launch-1",
        message: "Free me up after 5",
        starterIntent: "adjust_today",
        briefingContext: {
          content: "Today is crowded after work.",
          actionPrompt: "Free me up after 5",
          focus: "Protect the evening",
        },
      },
      onLaunchIntentConsumed,
    }));

    await act(async () => {
      await Promise.resolve();
    });

    expect(mocks.startTemplateThread).toHaveBeenCalledTimes(1);
    expect(mocks.plannerSubmit).toHaveBeenCalledWith(
      "Free me up after 5",
      "text",
      {
        skipUserEcho: false,
        starterIntent: "adjust_today",
        briefingContext: {
          content: "Today is crowded after work.",
          actionPrompt: "Free me up after 5",
          focus: "Protect the evening",
        },
      },
    );
    expect(mocks.startTemplateThread.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.plannerSubmit.mock.invocationCallOrder[0] ?? Number.POSITIVE_INFINITY,
    );
    expect(onLaunchIntentConsumed).toHaveBeenCalledWith("launch-1");
  });

  it("submits upcoming launcher intents as normal user starters", async () => {
    const onLaunchIntentConsumed = vi.fn();

    renderHook(() => useCompanionAssistant({
      surface: "journeys",
      launchIntent: {
        id: "launch-upcoming",
        message: "What do I have coming up?",
        starterIntent: "upcoming_start",
        briefingContext: null,
      },
      onLaunchIntentConsumed,
    }));

    await act(async () => {
      await Promise.resolve();
    });

    expect(mocks.startTemplateThread).toHaveBeenCalledTimes(1);
    expect(mocks.plannerSubmit).toHaveBeenCalledWith(
      "What do I have coming up?",
      "text",
      {
        skipUserEcho: false,
        starterIntent: "upcoming_start",
        briefingContext: null,
      },
    );
    expect(mocks.startTemplateThread.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.plannerSubmit.mock.invocationCallOrder[0] ?? Number.POSITIVE_INFINITY,
    );
    expect(onLaunchIntentConsumed).toHaveBeenCalledWith("launch-upcoming");
  });

  it("submits plan-day launcher intents as normal user starters", async () => {
    const onLaunchIntentConsumed = vi.fn();
    const planDayMessage =
      "Help me plan my day. Ask me follow-up questions about my goals, tasks, timing, and energy so we can build the best schedule.";

    renderHook(() => useCompanionAssistant({
      surface: "journeys",
      launchIntent: {
        id: "launch-plan-day",
        message: planDayMessage,
        starterIntent: "plan_day",
        briefingContext: null,
      },
      onLaunchIntentConsumed,
    }));

    await act(async () => {
      await Promise.resolve();
    });

    expect(mocks.startTemplateThread).toHaveBeenCalledTimes(1);
    expect(mocks.plannerSubmit).toHaveBeenCalledWith(
      planDayMessage,
      "text",
      {
        skipUserEcho: false,
        starterIntent: "plan_day",
        briefingContext: null,
      },
    );
    expect(mocks.startTemplateThread.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.plannerSubmit.mock.invocationCallOrder[0] ?? Number.POSITIVE_INFINITY,
    );
    expect(onLaunchIntentConsumed).toHaveBeenCalledWith("launch-plan-day");
  });

  it("seeds assistant-led quest launcher intents locally without a fake user echo", async () => {
    const onLaunchIntentConsumed = vi.fn();

    renderHook(() => useCompanionAssistant({
      surface: "journeys",
      launchIntent: {
        id: "launch-2",
        message: "Quest?",
        starterIntent: "quest_capture",
        briefingContext: null,
      },
      onLaunchIntentConsumed,
      onOpenCampaignBuilder: mocks.openCampaignBuilder,
    }));

    await act(async () => {
      await Promise.resolve();
    });

    expect(mocks.startTemplateThread).toHaveBeenCalledTimes(1);
    expect(mocks.primeQuestCapture).toHaveBeenCalledWith("Quest?");
    expect(mocks.plannerSubmit).not.toHaveBeenCalled();
    expect(mocks.openCampaignBuilder).not.toHaveBeenCalled();
    expect(onLaunchIntentConsumed).toHaveBeenCalledWith("launch-2");
  });

  it("routes conversation launch intents into the journeys conversation lane", async () => {
    const onLaunchIntentConsumed = vi.fn();

    renderHook(() => useCompanionAssistant({
      surface: "journeys",
      launchIntent: {
        id: "launch-3",
        message: "What's good legend?",
        starterIntent: "free_talk_start",
        target: "conversation",
        briefingContext: null,
      },
      onLaunchIntentConsumed,
    }));

    await act(async () => {
      await Promise.resolve();
    });

    expect(mocks.startTemplateThread).toHaveBeenCalledTimes(1);
    expect(mocks.injectAssistantOpening).toHaveBeenCalledWith("What's good legend?");
    expect(mocks.startTemplateThread.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.injectAssistantOpening.mock.invocationCallOrder[0] ?? Number.POSITIVE_INFINITY,
    );
    expect(mocks.plannerSubmit).not.toHaveBeenCalled();
    expect(onLaunchIntentConsumed).toHaveBeenCalledWith("launch-3");
  });

  it("ignores blank thread-history launch intents so the modal can handle them locally", async () => {
    const onLaunchIntentConsumed = vi.fn();

    renderHook(() => useCompanionAssistant({
      surface: "journeys",
      launchIntent: {
        id: "launch-history",
        message: "",
        starterIntent: "thread_history",
        target: "planner",
        briefingContext: null,
      },
      onLaunchIntentConsumed,
    }));

    await act(async () => {
      await Promise.resolve();
    });

    expect(mocks.startTemplateThread).not.toHaveBeenCalled();
    expect(mocks.plannerSubmit).not.toHaveBeenCalled();
    expect(mocks.injectAssistantOpening).not.toHaveBeenCalled();
    expect(mocks.primeQuestCapture).not.toHaveBeenCalled();
    expect(onLaunchIntentConsumed).not.toHaveBeenCalled();
  });

  it("surfaces journeys thread controls alongside the merged transcript", () => {
    const { result } = renderHook(() => useCompanionAssistant({ surface: "journeys" }));

    expect(result.current.activeThread?.title).toBe("Current thread");
    expect(result.current.historyThreads).toHaveLength(1);
    expect(result.current.hasPersistedActiveThread).toBe(true);
    expect(result.current.canStartNewChat).toBe(true);
    expect(result.current.newChatDisabledReason).toBeNull();
    expect(result.current.startNewChat).toBe(mocks.startNewChat);
    expect(result.current.canArchiveThread).toBe(true);
  });
});
