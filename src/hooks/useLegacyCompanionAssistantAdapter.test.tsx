import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  submitCompanionChat: vi.fn(),
  submitJourneysConversation: vi.fn(),
  submitPlanner: vi.fn(),
  acceptSuggestedQuest: vi.fn(),
  confirmProposal: vi.fn(),
  rejectProposal: vi.fn(),
  resumeThread: vi.fn(),
  archiveCurrentThread: vi.fn(),
  startNewChat: vi.fn(),
  plannerPendingProposals: [
    {
      id: "proposal-1",
      kind: "create_quest",
      summary: "Create a quest",
      payload: {},
      status: "pending",
      legacyConfirmationSupported: true,
    },
  ] as Array<{
    id: string;
    kind: string;
    summary: string;
    payload: Record<string, unknown>;
    status: string;
    legacyConfirmationSupported?: boolean;
  }>,
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

vi.mock("@/hooks/useCompanionChat", () => ({
  useCompanionChat: () => ({
    messages: [
      {
        id: "chat-1",
        role: "assistant",
        content: "Companion chat",
        createdAt: "2026-04-22T10:00:00.000Z",
      },
    ],
    isSubmitting: false,
    submitMessage: mocks.submitCompanionChat,
    isSpeaking: true,
    speechProvider: "device" as const,
    stopSpeaking: vi.fn(),
  }),
}));

vi.mock("@/hooks/useJourneysCompanionConversation", () => ({
  useJourneysCompanionConversation: (...args: unknown[]) => ({
    messages: [
      {
        id: "journeys-1",
        role: "assistant",
        content: "Journeys chat",
        createdAt: "2026-04-22T10:00:00.000Z",
      },
    ],
    isSubmitting: false,
    submitMessage: mocks.submitJourneysConversation,
    threadPersistenceReady: true,
    threadPersistenceUnavailableReason: null,
    resetThread: vi.fn(),
    hydrateThread: vi.fn(),
  }),
}));

vi.mock("@/hooks/useCompanionPlanner", () => ({
  useCompanionPlanner: (...args: unknown[]) => {
    const supportedPendingProposals = mocks.plannerPendingProposals.filter(
      (proposal) =>
        proposal.status === "pending" && proposal.legacyConfirmationSupported !== false,
    );
    const unsupportedPendingProposal = mocks.plannerPendingProposals.find(
      (proposal) =>
        proposal.status === "pending" && proposal.legacyConfirmationSupported === false,
    ) ?? null;

    return {
      messages: [
        {
          id: "plan-1",
          role: "companion",
          content: "Planner reply",
          createdAt: "2026-04-22T10:01:00.000Z",
        },
      ],
      questions: [],
      pendingProposals: mocks.plannerPendingProposals,
      legacyConfirmation: {
        activePendingProposal: supportedPendingProposals[0] ?? null,
        supportedPendingProposals,
        unsupportedPendingProposalNotice: unsupportedPendingProposal
          ? {
            id: unsupportedPendingProposal.id,
            summary: unsupportedPendingProposal.summary,
            detail:
              "This proposed change is visible here, but it can't be confirmed from this screen yet.",
          }
          : null,
        readySupportedProposalCount: supportedPendingProposals.length,
      },
      sessionState: {
        pendingStarterIntent: null,
      },
      structuredResponse: null,
      todayLabel: "Wednesday, April 22",
      isSubmitting: false,
      isClassifying: false,
      currentDate: "2026-04-22",
      plannerContext: null,
      acceptSuggestedQuest: mocks.acceptSuggestedQuest,
      legacyExecution: {
        compatibilityOnly: true as const,
        enabled: true,
        disabledReason: null,
        supportedProposalKinds: [
          "create_quest",
          "update_quest",
          "create_campaign",
          "update_campaign",
          "adjust_campaign_plan",
          "create_ritual",
          "update_ritual",
          "suggest_reminder",
        ],
        confirmProposal: mocks.confirmProposal,
        rejectProposal: mocks.rejectProposal,
        completeProposalEdit: vi.fn(),
        confirmAll: vi.fn(),
      },
      submitMessage: mocks.submitPlanner,
      resetThread: vi.fn(),
      hydrateThread: vi.fn(),
      primeQuestCapture: vi.fn(),
    };
  },
}));

vi.mock("@/hooks/useJourneysCompanionThreads", () => ({
  useJourneysCompanionThreads: (...args: unknown[]) => ({
    activeThread: {
      sessionId: "thread-1",
      companionId: "companion-1",
      surface: "journeys",
      title: "Thread",
      previewText: "Preview",
      createdAt: "2026-04-22T10:00:00.000Z",
      lastMessageAt: "2026-04-22T10:01:00.000Z",
      archivedAt: null,
      messageCount: 2,
    },
    historyThreads: [],
    isLoadingThreads: false,
    hasPersistedActiveThread: true,
    canOpenThreadPicker: true,
    threadHistoryEmptyStateMessage: "History",
    resumeThread: mocks.resumeThread,
    archiveCurrentThread: mocks.archiveCurrentThread,
    canArchiveThread: true,
    archiveDisabledReason: null,
    startNewChat: mocks.startNewChat,
    canStartNewChat: true,
    newChatDisabledReason: null,
  }),
}));

vi.mock("@/features/tasks/hooks/useNaturalLanguageParser", () => ({
  parseNaturalLanguage: (message: string) => ({
    text: message,
    estimatedDuration: null,
    scheduledDate: null,
  }),
}));

vi.mock("@/shared/schedulingIntent", () => ({
  analyzeSchedulingIntent: () => ({}),
  shouldRouteMessageToPlanner: () => false,
}));

vi.mock("@/shared/bigGoalIntent", () => ({
  isGoalBreakdownStarterMessage: () => false,
  looksLikeBigGoal: () => false,
}));

vi.mock("@/components/ui/sonner", () => ({
  toast: {
    error: vi.fn(),
  },
}));

vi.mock("@/utils/currentDateTime", () => ({
  formatCurrentDateTimeWithOffset: () => "2026-04-22T10:00:00-07:00",
}));

import { useLegacyCompanionAssistantAdapter } from "./useLegacyCompanionAssistantAdapter";

describe("useLegacyCompanionAssistantAdapter", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.plannerPendingProposals = [
      {
        id: "proposal-1",
        kind: "create_quest",
        summary: "Create a quest",
        payload: {},
        status: "pending",
      },
    ];
  });

  it("maps legacy create_campaign proposals to campaign_create pending actions", () => {
    mocks.plannerPendingProposals = [
      {
        id: "proposal-campaign-1",
        kind: "create_campaign",
        summary: "Create a campaign",
        payload: { title: "Launch Sprint" },
        status: "pending",
      },
    ];

    const { result } = renderHook(() =>
      useLegacyCompanionAssistantAdapter({
        enabled: true,
        surface: "companion",
      }),
    );

    expect(result.current.pendingAction?.actionType).toBe("campaign_create");
  });

  it("maps legacy adjust_campaign_plan proposals to campaign_adjust pending actions", () => {
    mocks.plannerPendingProposals = [
      {
        id: "proposal-campaign-adjust-1",
        kind: "adjust_campaign_plan",
        summary: "Adjust a campaign",
        payload: { epicId: "epic-1", adjustmentType: "extend_deadline" },
        status: "pending",
      },
    ];

    const { result } = renderHook(() =>
      useLegacyCompanionAssistantAdapter({
        enabled: true,
        surface: "companion",
      }),
    );

    expect(result.current.pendingAction?.actionType).toBe("campaign_adjust");
  });

  it("maps legacy update_ritual proposals to ritual_update pending actions", () => {
    mocks.plannerPendingProposals = [
      {
        id: "proposal-ritual-update-1",
        kind: "update_ritual",
        summary: "Update a ritual",
        payload: { habitId: "habit-1", title: "Practice" },
        status: "pending",
      },
    ];

    const { result } = renderHook(() =>
      useLegacyCompanionAssistantAdapter({
        enabled: true,
        surface: "companion",
      }),
    );

    expect(result.current.pendingAction?.actionType).toBe("ritual_update");
  });

  it("does not expose unsupported legacy proposal kinds as pending actions", async () => {
    mocks.plannerPendingProposals = [
      {
        id: "proposal-unsupported-1",
        kind: "unsupported_future_kind",
        summary: "Unsupported proposal",
        payload: { foo: "bar" },
        status: "pending",
        legacyConfirmationSupported: false,
      },
    ];

    const { result } = renderHook(() =>
      useLegacyCompanionAssistantAdapter({
        enabled: true,
        surface: "companion",
      }),
    );

    expect(result.current.pendingAction).toBeNull();
    expect(result.current.unsupportedPendingProposalNotice).toEqual({
      id: "proposal-unsupported-1",
      summary: "Unsupported proposal",
      detail:
        "This proposed change is visible here, but it can't be confirmed from this screen yet.",
    });
    expect(result.current.canStartNewChat).toBe(false);
    expect(result.current.newChatDisabledReason).toBeNull();
    expect(result.current.canArchiveThread).toBe(false);
    expect(result.current.archiveDisabledReason).toBeNull();

    await act(async () => {
      await result.current.confirmPendingAction();
      await result.current.cancelPendingAction();
    });

    expect(mocks.confirmProposal).not.toHaveBeenCalled();
    expect(mocks.rejectProposal).not.toHaveBeenCalled();
  });

  it("selects the first supported pending proposal when an unsupported one appears earlier", async () => {
    mocks.plannerPendingProposals = [
      {
        id: "proposal-unsupported-1",
        kind: "unsupported_future_kind",
        summary: "Unsupported proposal",
        payload: {},
        status: "pending",
        legacyConfirmationSupported: false,
      },
      {
        id: "proposal-supported-1",
        kind: "create_campaign",
        summary: "Create a campaign",
        payload: { title: "Launch Sprint" },
        status: "pending",
        legacyConfirmationSupported: true,
      },
    ];

    const { result } = renderHook(() =>
      useLegacyCompanionAssistantAdapter({
        enabled: true,
        surface: "companion",
      }),
    );

    expect(result.current.pendingAction?.actionType).toBe("campaign_create");
    expect(result.current.unsupportedPendingProposalNotice).toEqual({
      id: "proposal-unsupported-1",
      summary: "Unsupported proposal",
      detail:
        "This proposed change is visible here, but it can't be confirmed from this screen yet.",
    });
    expect(result.current.canStartNewChat).toBe(false);
    expect(result.current.newChatDisabledReason).toBeNull();

    await act(async () => {
      await result.current.confirmPendingAction();
    });

    expect(mocks.confirmProposal).toHaveBeenCalledWith("proposal-supported-1");
  });

  it("returns a dormant shell when disabled", async () => {
    const { result } = renderHook(() =>
      useLegacyCompanionAssistantAdapter({
        enabled: false,
        surface: "journeys",
      }),
    );

    expect(result.current.messages).toEqual([]);
    expect(result.current.pendingAction).toBeNull();
    expect(result.current.unsupportedPendingProposalNotice).toBeNull();
    expect(result.current.isSubmitting).toBe(false);
    expect(result.current.isResolvingAction).toBe(false);
    expect(result.current.activeThread).toBeNull();
    expect(result.current.canOpenThreadPicker).toBe(false);
    expect(result.current.isSpeaking).toBe(false);
    expect(result.current.speechProvider).toBe("none");
    expect(result.current.placeholder).toBe("chat");

    await act(async () => {
      await result.current.submitMessage("Hello", "text");
      await result.current.confirmPendingAction();
      await result.current.cancelPendingAction();
      await result.current.resumeThread("thread-1");
      await result.current.archiveCurrentThread();
      await result.current.startNewChat();
    });

    expect(mocks.submitCompanionChat).not.toHaveBeenCalled();
    expect(mocks.submitJourneysConversation).not.toHaveBeenCalled();
    expect(mocks.submitPlanner).not.toHaveBeenCalled();
    expect(mocks.confirmProposal).not.toHaveBeenCalled();
    expect(mocks.rejectProposal).not.toHaveBeenCalled();
    expect(mocks.resumeThread).not.toHaveBeenCalled();
    expect(mocks.archiveCurrentThread).not.toHaveBeenCalled();
    expect(mocks.startNewChat).not.toHaveBeenCalled();
  });

  it("blocks journeys thread controls with a specific reason when an unsupported draft is visible", () => {
    mocks.plannerPendingProposals = [
      {
        id: "proposal-unsupported-1",
        kind: "unsupported_future_kind",
        summary: "Unsupported proposal",
        payload: {},
        status: "pending",
        legacyConfirmationSupported: false,
      },
    ];

    const { result } = renderHook(() =>
      useLegacyCompanionAssistantAdapter({
        enabled: true,
        surface: "journeys",
      }),
    );

    expect(result.current.canStartNewChat).toBe(false);
    expect(result.current.newChatDisabledReason).toBe(
      "Keep this thread open while the visible pending draft is still unresolved.",
    );
    expect(result.current.canOpenThreadPicker).toBe(false);
    expect(result.current.threadPickerDisabledReason).toBe(
      "Keep this thread open while the visible pending draft is still unresolved.",
    );
    expect(result.current.canArchiveThread).toBe(false);
    expect(result.current.archiveDisabledReason).toBe(
      "Keep this thread open while the visible pending draft is still unresolved.",
    );
  });
});
