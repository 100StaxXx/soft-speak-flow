import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  companionChat: {
    sessionId: "companion-chat-session",
    greeting: "Companion chat greeting",
    messages: [],
    isSubmitting: false,
    isSpeaking: false,
    speechProvider: "none" as const,
    stopSpeaking: vi.fn(),
    submitMessage: vi.fn(),
    resetThread: vi.fn(),
    hydrateThread: vi.fn(),
  },
  journeysConversation: {
    sessionId: "journeys-conversation-session",
    greeting: "Journeys greeting",
    messages: [],
    isSubmitting: false,
    pendingPlannerHandoffMessage: null,
    threadPersistenceReady: true,
    threadPersistenceUnavailableReason: null,
    submitMessage: vi.fn(),
    resetThread: vi.fn(),
    hydrateThread: vi.fn(),
  },
  planner: {
    sessionId: "planner-session",
    todayLabel: "Friday, April 24",
    messages: [],
    structuredResponse: null,
    planningMode: "balanced" as const,
    setPlanningMode: vi.fn(),
    questions: [],
    proposals: [],
    pendingProposals: [],
    readyProposalCount: 0,
    sessionState: { pendingStarterIntent: null },
    currentDate: "2026-04-24",
    plannerContext: null,
    isSubmitting: false,
    isClassifying: false,
    submitMessage: vi.fn(),
    primeQuestCapture: vi.fn(),
    confirmProposal: vi.fn(),
    rejectProposal: vi.fn(),
    confirmAll: vi.fn(),
    resetThread: vi.fn(),
    hydrateThread: vi.fn(),
  },
  journeysThreads: {
    activeThread: null,
    historyThreads: [],
    isLoadingThreads: false,
    hasPersistedActiveThread: false,
    canOpenThreadPicker: false,
    threadHistoryEmptyStateMessage:
      "Past chats will show up here after at least one real exchange.",
    resumeThread: vi.fn(),
    archiveCurrentThread: vi.fn(),
    canArchiveThread: false,
    archiveDisabledReason: null,
    startNewChat: vi.fn(),
    canStartNewChat: true,
    newChatDisabledReason: null,
    startTemplateThread: vi.fn(() => "template-session"),
  },
  useJourneysCompanionThreads: vi.fn(),
}));

vi.mock("@/components/ui/sonner", () => ({
  toast: {
    error: vi.fn(),
  },
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
    greeting: "Companion greeting",
  }),
}));

vi.mock("@/hooks/useCompanionChat", () => ({
  useCompanionChat: () => mocks.companionChat,
}));

vi.mock("@/hooks/useJourneysCompanionConversation", () => ({
  useJourneysCompanionConversation: () => mocks.journeysConversation,
}));

vi.mock("@/hooks/useCompanionPlanner", () => ({
  useCompanionPlanner: () => mocks.planner,
}));

vi.mock("@/hooks/useJourneysCompanionThreads", () => ({
  useJourneysCompanionThreads: (...args: unknown[]) => {
    mocks.useJourneysCompanionThreads(...args);
    return mocks.journeysThreads;
  },
}));

vi.mock("@/features/tasks/hooks/useNaturalLanguageParser", () => ({
  parseNaturalLanguage: (message: string) => ({ text: message }),
}));

vi.mock("@/shared/schedulingIntent", () => ({
  analyzeSchedulingIntent: () => ({ kind: "conversation" }),
  shouldRouteMessageToPlanner: () => false,
}));

vi.mock("@/shared/bigGoalIntent", () => ({
  isGoalBreakdownStarterMessage: () => false,
  looksLikeBigGoal: () => false,
}));

vi.mock("@/utils/currentDateTime", () => ({
  formatCurrentDateTimeWithOffset: () => "2026-04-24T12:00:00-07:00",
}));

import { useLegacyCompanionAssistantAdapter } from "./useLegacyCompanionAssistantAdapter";

describe("useLegacyCompanionAssistantAdapter", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.companionChat.hydrateThread.mockReset();
    mocks.journeysConversation.hydrateThread.mockReset();
    mocks.planner.hydrateThread.mockReset();
    mocks.useJourneysCompanionThreads.mockReset();
  });

  it("passes journeys conversation and planner session ids into the thread manager", () => {
    renderHook(() =>
      useLegacyCompanionAssistantAdapter({
        enabled: true,
        surface: "journeys",
      })
    );

    expect(mocks.useJourneysCompanionThreads).toHaveBeenCalledWith(
      expect.objectContaining({
        conversation: expect.objectContaining({
          sessionId: "journeys-conversation-session",
        }),
        planner: expect.objectContaining({
          sessionId: "planner-session",
        }),
      }),
    );
  });

  it("hydrates unified agent state into chat and planner fallback threads separately", () => {
    const { result } = renderHook(() =>
      useLegacyCompanionAssistantAdapter({
        enabled: true,
        surface: "journeys",
      })
    );

    act(() => {
      result.current.hydrateFromUnifiedState({
        sessionId: "agent-session-1",
        messages: [
          {
            id: "agent-chat-1",
            role: "assistant",
            content: "Let's talk this through.",
            createdAt: "2026-04-24T08:00:00.000Z",
            source: "agent",
          },
          {
            id: "agent-user-1",
            role: "user",
            content: "I need a calmer plan.",
            createdAt: "2026-04-24T08:00:05.000Z",
            source: "agent",
            inputMode: "text",
          },
          {
            id: "agent-plan-1",
            role: "assistant",
            content: "I drafted a lighter day for you.",
            createdAt: "2026-04-24T08:00:10.000Z",
            source: "agent",
            structuredResponse: {
              intent: {
                intentType: "quest",
                timeHorizon: "today",
                isRecurring: false,
                shouldCreateQuest: true,
                shouldPromptCampaign: false,
              },
              planDay: {
                message: "I drafted a lighter day for you.",
                dayAssessment: "light",
                suggestedQuests: [],
              },
            },
          },
        ],
        savedSuggestionProposalIds: ["proposal-1"],
      });
    });

    expect(mocks.journeysConversation.hydrateThread).toHaveBeenCalledWith({
      sessionId: "agent-session-1",
      messages: [
        expect.objectContaining({
          id: "agent-chat-1",
          content: "Let's talk this through.",
        }),
        expect.objectContaining({
          id: "agent-user-1",
          content: "I need a calmer plan.",
          inputMode: "text",
        }),
      ],
    });

    expect(mocks.planner.hydrateThread).toHaveBeenCalledWith({
      sessionId: "agent-session-1",
      messages: [
        expect.objectContaining({
          id: "agent-plan-1",
          content: "I drafted a lighter day for you.",
          structuredResponse: expect.objectContaining({
            planDay: expect.objectContaining({
              message: "I drafted a lighter day for you.",
            }),
          }),
        }),
      ],
    });
  });
});
