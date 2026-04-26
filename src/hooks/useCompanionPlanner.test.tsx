import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getCompanionPlannerOpener } from "@/shared/companionPlannerCopy";

const mocks = vi.hoisted(() => ({
  externalCalendarHorizons: [] as string[],
  classify: vi.fn(),
  invoke: vi.fn(),
  persistCompanionThreadMessages: vi.fn().mockResolvedValue(undefined),
  upsertPlannerPreferences: vi.fn(),
  insertPlannerEvent: vi.fn(),
  invalidateQueries: vi.fn(),
  addTask: vi.fn(),
  updateTask: vi.fn(),
  applySubtaskTitlePlan: vi.fn(),
  queueAction: vi.fn(),
  retryNow: vi.fn(),
  trackTaskCreation: vi.fn(),
  trackScheduleModification: vi.fn(),
  toastError: vi.fn(),
  toastMessage: vi.fn(),
  trackInteraction: vi.fn(),
  sendTaskToCalendar: vi.fn(),
  syncPlanningContext: vi.fn(),
  useCalendarIntegrations: vi.fn(),
  enrichedContext: null as Record<string, unknown> | null,
  user: {
    id: "user-1",
  } as { id: string } | null,
  companion: {
    id: "companion-1",
  } as { id: string } | null,
}));

vi.mock("@tanstack/react-query", () => ({
  useQuery: () => ({
    data: null,
    isLoading: false,
  }),
  useQueryClient: () => ({
    invalidateQueries: mocks.invalidateQueries,
  }),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    functions: {
      invoke: (...args: unknown[]) => mocks.invoke(...args),
    },
    from: (table: string) =>
      table === "planner_events"
        ? {
          insert: (...args: unknown[]) => mocks.insertPlannerEvent(...args),
        }
        : {
          upsert: (...args: unknown[]) =>
            mocks.upsertPlannerPreferences(...args),
        },
  },
}));

vi.mock("@/services/companionChatThreads", () => ({
  generateCompanionThreadSessionId: () => "planner-session-1",
  getCompanionChatThreadsQueryKey: (
    userId: string | null | undefined,
    companionId: string | null | undefined,
    surface: string,
  ) => [
    "companion-chat-threads",
    userId ?? "anon",
    companionId ?? "none",
    surface,
  ],
  persistCompanionThreadMessages: (...args: unknown[]) =>
    mocks.persistCompanionThreadMessages(...args),
}));

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({
    user: mocks.user,
  }),
}));

vi.mock("@/hooks/useCompanion", () => ({
  useCompanion: () => ({
    companion: mocks.companion,
  }),
}));

vi.mock("@/hooks/useCompanionDialogue", () => ({
  useCompanionDialogue: () => ({
    greeting: "Let's line things up.",
  }),
}));

vi.mock("@/hooks/useIntentClassifier", () => ({
  useIntentClassifier: () => ({
    classify: mocks.classify,
    isClassifying: false,
  }),
}));

vi.mock("@/hooks/useTasksQuery", () => ({
  useTasksQuery: () => ({
    tasks: [],
    isLoading: false,
  }),
}));

vi.mock("@/hooks/useCalendarTasks", () => ({
  useCalendarTasks: () => ({
    tasks: [],
    isLoading: false,
  }),
}));

vi.mock("@/hooks/useExternalCalendarEvents", () => ({
  useExternalCalendarEvents: (_date: Date, horizon: string) => {
    mocks.externalCalendarHorizons.push(horizon);
    return {
      events: [],
      isLoading: false,
    };
  },
}));

vi.mock("@/hooks/useInboxTasks", () => ({
  useInboxTasks: () => ({
    inboxTasks: [],
  }),
}));

vi.mock("@/hooks/useEpics", () => ({
  useEpics: () => ({
    activeEpics: [],
    createEpic: vi.fn(),
    renameEpic: vi.fn(),
    createCampaignRitual: vi.fn(),
  }),
}));

vi.mock("@/hooks/useTaskMutations", () => ({
  useTaskMutations: () => ({
    addTask: mocks.addTask,
    updateTask: mocks.updateTask,
  }),
}));

vi.mock("@/hooks/useRitualUpdate", () => ({
  useRitualUpdate: () => ({
    saveRitual: vi.fn(),
  }),
}));

vi.mock("@/hooks/useCalendarIntegrations", () => ({
  useCalendarIntegrations: (...args: unknown[]) =>
    mocks.useCalendarIntegrations(...args),
}));

vi.mock("@/hooks/useQuestCalendarSync", () => ({
  useQuestCalendarSync: () => ({
    sendTaskToCalendar: {
      mutateAsync: (...args: unknown[]) => mocks.sendTaskToCalendar(...args),
    },
    syncPlanningContext: {
      mutateAsync: (...args: unknown[]) => mocks.syncPlanningContext(...args),
    },
  }),
}));

vi.mock("@/hooks/useUserAIContext", () => ({
  useUserAIContext: () => ({
    enrichedContext: mocks.enrichedContext,
  }),
}));

vi.mock("@/hooks/useAIInteractionTracker", () => ({
  useAIInteractionTracker: () => ({
    trackInteraction: mocks.trackInteraction,
  }),
}));

vi.mock("@/hooks/useSchedulingLearner", () => ({
  useSchedulingLearner: () => ({
    trackTaskCreation: mocks.trackTaskCreation,
    trackScheduleModification: mocks.trackScheduleModification,
  }),
}));

vi.mock("@/contexts/ResilienceContext", () => ({
  useResilience: () => ({
    queueAction: mocks.queueAction,
    shouldQueueWrites: false,
    retryNow: mocks.retryNow,
  }),
}));

vi.mock("@/features/tasks/lib/subtaskWrites", () => ({
  applySubtaskTitlePlan: (...args: unknown[]) =>
    mocks.applySubtaskTitlePlan(...args),
}));

vi.mock("@/hooks/useVoiceInput", () => ({
  useVoiceInput: () => ({
    isRecording: false,
    isAutoStopping: false,
    isSupported: true,
    permissionStatus: "granted" as const,
    toggleRecording: vi.fn(),
    requestPermission: vi.fn().mockResolvedValue("granted"),
  }),
}));

vi.mock("@/components/ui/sonner", () => ({
  toast: Object.assign(
    (...args: unknown[]) => mocks.toastMessage(...args),
    {
      error: (...args: unknown[]) => mocks.toastError(...args),
    },
  ),
}));

import { useCompanionPlanner } from "./useCompanionPlanner";

describe("useCompanionPlanner", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.externalCalendarHorizons.length = 0;
    mocks.classify.mockResolvedValue(null);
    mocks.user = { id: "user-1" };
    mocks.companion = { id: "companion-1" };
    mocks.upsertPlannerPreferences.mockResolvedValue({ error: null });
    mocks.insertPlannerEvent.mockResolvedValue({ error: null });
    mocks.addTask.mockResolvedValue(undefined);
    mocks.updateTask.mockResolvedValue(undefined);
    mocks.applySubtaskTitlePlan.mockResolvedValue([]);
    mocks.retryNow.mockResolvedValue(undefined);
    mocks.queueAction.mockResolvedValue(undefined);
    mocks.trackTaskCreation.mockResolvedValue(undefined);
    mocks.trackScheduleModification.mockResolvedValue(undefined);
    mocks.sendTaskToCalendar.mockResolvedValue(undefined);
    mocks.syncPlanningContext.mockResolvedValue(null);
    mocks.useCalendarIntegrations.mockReturnValue({
      connectedByProvider: {},
      defaultProvider: null,
    });
    mocks.enrichedContext = null;
    Object.defineProperty(window, "localStorage", {
      configurable: true,
      writable: true,
      value: {
        getItem: vi.fn(() => null),
        setItem: vi.fn(),
        removeItem: vi.fn(),
      },
    });
  });

  it("initializes the default horizon before dependent event queries run", () => {
    const { result } = renderHook(() =>
      useCompanionPlanner({ bootstrapGreeting: false })
    );

    expect(result.current.horizon).toBe("day");
    expect(mocks.externalCalendarHorizons).toEqual(["day", "week"]);
  });

  it("does not bootstrap a hardcoded planner opener", async () => {
    const { result } = renderHook(() => useCompanionPlanner());

    expect(getCompanionPlannerOpener({ userId: null })).toBe("");
    expect(result.current.messages).toEqual([]);
  });

  it("stays dormant when disabled until fallback actually needs it", async () => {
    const { result } = renderHook(() =>
      useCompanionPlanner({
        enabled: false,
        bootstrapGreeting: true,
      })
    );

    expect(result.current.messages).toEqual([]);

    await act(async () => {
      await result.current.submitMessage("Plan my day", "text");
    });

    expect(mocks.invoke).not.toHaveBeenCalled();
    expect(result.current.messages).toEqual([]);
  });

  it("preserves hydrated fallback planner state when re-enabled", async () => {
    const { result, rerender } = renderHook(
      ({ enabled }: { enabled: boolean }) =>
        useCompanionPlanner({
          enabled,
          bootstrapGreeting: true,
        }),
      {
        initialProps: { enabled: false },
      },
    );

    act(() => {
      result.current.hydrateThread({
        sessionId: "fallback-planner-session",
        messages: [
          {
            id: "planner-assistant-1",
            sessionId: "fallback-planner-session",
            role: "assistant",
            content: "I drafted a lighter day for you.",
            createdAt: "2026-04-18T08:00:01.000Z",
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
                dayAssessment: "low_energy",
                suggestedQuests: [
                  {
                    suggestionId: "plan-1",
                    proposalId: "proposal-plan-1",
                    title: "Triage inbox priorities",
                    type: "must",
                    estimatedDuration: "20 min",
                    estimatedDurationMinutes: 20,
                    source: "optimization",
                    reason: "It gives you a calm starting point.",
                  },
                ],
              },
            },
          },
        ],
      });
    });

    rerender({ enabled: true });

    await waitFor(() => {
      expect(result.current.sessionId).toBe("fallback-planner-session");
      expect(result.current.messages).toEqual([
        expect.objectContaining({
          id: "planner-assistant-1",
          content: "I drafted a lighter day for you.",
        }),
      ]);
      expect(result.current.structuredResponse?.planDay?.message).toBe(
        "I drafted a lighter day for you.",
      );
    });
  });

  it("hydrates persisted planner messages with structured output", async () => {
    const { result } = renderHook(() =>
      useCompanionPlanner({ bootstrapGreeting: false })
    );

    act(() => {
      result.current.hydrateThread({
        sessionId: "persisted-planner-session",
        messages: [
          {
            id: "planner-user-1",
            sessionId: "persisted-planner-session",
            role: "user",
            content: "Plan my day",
            createdAt: "2026-04-18T08:00:00.000Z",
            source: "agent",
          },
          {
            id: "planner-assistant-1",
            sessionId: "persisted-planner-session",
            role: "assistant",
            content: "I drafted a focused day for you.",
            createdAt: "2026-04-18T08:00:01.000Z",
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
                message: "I drafted a focused day for you.",
                dayAssessment: "balanced",
                suggestedQuests: [
                  {
                    suggestionId: "plan-1",
                    proposalId: "proposal-plan-1",
                    title: "Outline launch checklist",
                    type: "must",
                    estimatedDuration: "45 min",
                    estimatedDurationMinutes: 45,
                    source: "campaign",
                    reason: "It keeps launch moving.",
                  },
                ],
              },
            },
            metadata: {
              structuredResponse: {
                intent: {
                  intentType: "quest",
                  timeHorizon: "today",
                  isRecurring: false,
                  shouldCreateQuest: true,
                  shouldPromptCampaign: false,
                },
                planDay: {
                  message: "I drafted a focused day for you.",
                  dayAssessment: "balanced",
                  suggestedQuests: [
                    {
                      suggestionId: "plan-1",
                      proposalId: "proposal-plan-1",
                      title: "Outline launch checklist",
                      type: "must",
                      estimatedDuration: "45 min",
                      estimatedDurationMinutes: 45,
                      source: "campaign",
                      reason: "It keeps launch moving.",
                    },
                  ],
                },
              },
              followUpQuestions: [],
              proposals: [
                {
                  id: "proposal-plan-1",
                  kind: "create_quest",
                  title: "Outline launch checklist",
                  summary:
                    "Create a focused quest for Outline launch checklist.",
                  reasoning: "It fits your first open work block.",
                  payload: {
                    taskText: "Outline launch checklist",
                    taskDate: "2026-04-18",
                    scheduledTime: "09:00",
                    estimatedDuration: 45,
                  },
                  status: "pending",
                  readyToConfirm: true,
                  missingFields: [],
                },
              ],
              suggestedReminders: [],
              sessionState: {
                draft: {},
                openQuestionIds: [],
                preferredTimeOfDay: null,
                preferredTimeReason: null,
                reminderPreference: null,
                pendingStarterIntent: null,
                lastClassification: "quest",
              },
            },
          },
        ],
      });
    });

    expect(result.current.sessionId).toBe("persisted-planner-session");
    expect(result.current.messages).toHaveLength(2);
    expect(result.current.messages[1]?.role).toBe("companion");
    expect(result.current.messages[1]?.structuredResponse?.planDay?.message).toBe(
      "I drafted a focused day for you.",
    );
    expect(result.current.structuredResponse?.planDay?.suggestedQuests).toHaveLength(1);
    expect(result.current.proposals).toEqual([
      expect.objectContaining({
        id: "proposal-plan-1",
        kind: "create_quest",
        status: "pending",
      }),
    ]);
  });

  it("restores persisted planner proposals so reloaded suggestions stay actionable", async () => {
    const { result } = renderHook(() =>
      useCompanionPlanner({ bootstrapGreeting: false })
    );

    act(() => {
      result.current.hydrateThread({
        sessionId: "persisted-planner-session",
        messages: [
          {
            id: "planner-user-1",
            sessionId: "persisted-planner-session",
            role: "user",
            content: "Plan my day",
            createdAt: "2026-04-18T08:00:00.000Z",
            source: "plan",
          },
          {
            id: "planner-assistant-1",
            sessionId: "persisted-planner-session",
            role: "assistant",
            content: "I drafted a focused day for you.",
            createdAt: "2026-04-18T08:00:01.000Z",
            source: "plan",
            structuredResponse: {
              intent: {
                intentType: "quest",
                timeHorizon: "today",
                isRecurring: false,
                shouldCreateQuest: true,
                shouldPromptCampaign: false,
              },
              planDay: {
                message: "I drafted a focused day for you.",
                dayAssessment: "balanced",
                suggestedQuests: [
                  {
                    suggestionId: "plan-1",
                    proposalId: "proposal-plan-1",
                    title: "Outline launch checklist",
                    type: "must",
                    estimatedDuration: "45 min",
                    estimatedDurationMinutes: 45,
                    source: "campaign",
                    reason: "It keeps launch moving.",
                  },
                ],
              },
            },
            metadata: {
              followUpQuestions: [],
              proposals: [
                {
                  id: "proposal-plan-1",
                  kind: "create_quest",
                  title: "Outline launch checklist",
                  summary:
                    "Create a focused quest for Outline launch checklist.",
                  reasoning: "It fits your first open work block.",
                  payload: {
                    taskText: "Outline launch checklist",
                    taskDate: "2026-04-18",
                    scheduledTime: "09:00",
                    estimatedDuration: 45,
                  },
                  status: "pending",
                  readyToConfirm: true,
                  missingFields: [],
                },
              ],
              suggestedReminders: [],
              sessionState: {
                draft: {},
                openQuestionIds: [],
                preferredTimeOfDay: null,
                preferredTimeReason: null,
                reminderPreference: null,
                pendingStarterIntent: null,
                lastClassification: "quest",
              },
            },
          },
        ],
      });
    });

    await act(async () => {
      await result.current.confirmProposal("proposal-plan-1");
    });

    expect(mocks.addTask).toHaveBeenCalledWith(
      expect.objectContaining({
        taskText: "Outline launch checklist",
        taskDate: "2026-04-18",
        scheduledTime: "09:00",
        estimatedDuration: 45,
      }),
    );
  });

  it("replays persisted proposal decisions so saved suggestions stay marked after reload", async () => {
    const { result } = renderHook(() =>
      useCompanionPlanner({ bootstrapGreeting: false })
    );

    act(() => {
      result.current.hydrateThread({
        sessionId: "persisted-planner-session",
        messages: [
          {
            id: "planner-user-1",
            sessionId: "persisted-planner-session",
            role: "user",
            content: "Plan my day",
            createdAt: "2026-04-18T08:00:00.000Z",
            source: "plan",
          },
          {
            id: "planner-assistant-1",
            sessionId: "persisted-planner-session",
            role: "assistant",
            content: "I drafted a focused day for you.",
            createdAt: "2026-04-18T08:00:01.000Z",
            source: "plan",
            structuredResponse: {
              intent: {
                intentType: "quest",
                timeHorizon: "today",
                isRecurring: false,
                shouldCreateQuest: true,
                shouldPromptCampaign: false,
              },
              planDay: {
                message: "I drafted a focused day for you.",
                dayAssessment: "balanced",
                suggestedQuests: [
                  {
                    suggestionId: "plan-1",
                    proposalId: "proposal-plan-1",
                    title: "Outline launch checklist",
                    type: "must",
                    estimatedDuration: "45 min",
                    estimatedDurationMinutes: 45,
                    source: "campaign",
                    reason: "It keeps launch moving.",
                  },
                ],
              },
            },
            metadata: {
              followUpQuestions: [],
              proposals: [
                {
                  id: "proposal-plan-1",
                  kind: "create_quest",
                  title: "Outline launch checklist",
                  summary:
                    "Create a focused quest for Outline launch checklist.",
                  reasoning: "It fits your first open work block.",
                  payload: {
                    taskText: "Outline launch checklist",
                    taskDate: "2026-04-18",
                    scheduledTime: "09:00",
                    estimatedDuration: 45,
                  },
                  status: "pending",
                  readyToConfirm: true,
                  missingFields: [],
                },
              ],
              suggestedReminders: [],
              sessionState: {
                draft: {},
                openQuestionIds: [],
                preferredTimeOfDay: null,
                preferredTimeReason: null,
                reminderPreference: null,
                pendingStarterIntent: null,
                lastClassification: "quest",
              },
            },
          },
          {
            id: "planner-assistant-2",
            sessionId: "persisted-planner-session",
            role: "assistant",
            content: "Saved: Outline launch checklist.",
            createdAt: "2026-04-18T08:05:00.000Z",
            source: "plan",
            metadata: {
              proposalDecision: {
                proposalId: "proposal-plan-1",
                status: "confirmed",
              },
            },
          },
        ],
      });
    });

    expect(result.current.proposals).toEqual([
      expect.objectContaining({
        id: "proposal-plan-1",
        status: "confirmed",
      }),
    ]);
  });

  it("persists planner structured output metadata for journeys thread history", async () => {
    mocks.invoke.mockResolvedValue({
      data: {
        mode: "schedule_read",
        reply: "I drafted a focused day for you.",
        followUpQuestions: [],
        proposals: [],
        suggestedReminders: [],
        structuredResponse: {
          intent: {
            intentType: "quest",
            timeHorizon: "today",
            isRecurring: false,
            shouldCreateQuest: true,
            shouldPromptCampaign: false,
          },
          planDay: {
            message: "I drafted a focused day for you.",
            dayAssessment: "balanced",
            suggestedQuests: [
              {
                suggestionId: "plan-1",
                proposalId: "proposal-plan-1",
                title: "Outline launch checklist",
                type: "must",
                estimatedDuration: "45 min",
                estimatedDurationMinutes: 45,
                source: "campaign",
                reason: "It keeps launch moving.",
              },
            ],
          },
        },
        memoryUpdates: {},
        sessionState: {
          draft: {},
          openQuestionIds: [],
          preferredTimeOfDay: null,
          preferredTimeReason: null,
          reminderPreference: null,
          pendingStarterIntent: null,
          lastClassification: "quest",
        },
      },
      error: null,
    });

    const { result } = renderHook(() =>
      useCompanionPlanner({
        bootstrapGreeting: false,
        threadPersistence: {
          enabled: true,
          surface: "journeys",
        },
      })
    );

    await act(async () => {
      await result.current.submitMessage("Plan my day", "text");
    });

    expect(mocks.persistCompanionThreadMessages).toHaveBeenCalledWith(
      expect.objectContaining({
        surface: "journeys",
        source: "plan",
        rows: expect.arrayContaining([
          expect.objectContaining({
            role: "assistant",
            content: "I drafted a focused day for you.",
            metadata: expect.objectContaining({
              structuredResponse: expect.objectContaining({
                planDay: expect.objectContaining({
                  message: "I drafted a focused day for you.",
                }),
              }),
              proposals: [],
              suggestedReminders: [],
              followUpQuestions: [],
              sessionState: expect.objectContaining({
                lastClassification: "quest",
              }),
            }),
          }),
        ]),
      }),
    );
  });

  it("primes quest capture locally and keeps the planner idle", async () => {
    Object.defineProperty(window, "localStorage", {
      configurable: true,
      writable: true,
      value: {
        getItem: vi.fn(() =>
          JSON.stringify({
            preferredTimeOfDay: "evening",
            preferredTimeReason: "After work I can focus better.",
            reminderPreference: "15 minutes",
          })
        ),
        setItem: vi.fn(),
        removeItem: vi.fn(),
      },
    });

    const { result } = renderHook(() =>
      useCompanionPlanner({ bootstrapGreeting: false })
    );

    act(() => {
      result.current.setDraftInput("Old draft");
      result.current.primeQuestCapture();
    });

    expect(result.current.messages).toHaveLength(1);
    expect(result.current.messages[0]?.role).toBe("companion");
    expect(result.current.messages[0]?.content).toBe("Quest?");
    expect(result.current.questions).toEqual([]);
    expect(result.current.pendingProposals).toEqual([]);
    expect(result.current.draftInput).toBe("");
    expect(result.current.isSubmitting).toBe(false);
    expect(result.current.sessionState.pendingStarterIntent).toBe(
      "quest_capture",
    );
    expect(result.current.sessionState.draft.draftKind).toBe("create_quest");
    expect(result.current.sessionState.preferredTimeOfDay).toBe("evening");
    expect(result.current.sessionState.preferredTimeReason).toBe(
      "After work I can focus better.",
    );
    expect(result.current.sessionState.reminderPreference).toBe("15 minutes");
    expect(mocks.invoke).not.toHaveBeenCalled();
  });

  it("persists quest capture seeds for journeys thread reloads", async () => {
    const { result } = renderHook(() =>
      useCompanionPlanner({
        bootstrapGreeting: false,
        threadPersistence: {
          enabled: true,
          surface: "journeys",
        },
      })
    );

    act(() => {
      result.current.primeQuestCapture();
    });

    expect(mocks.persistCompanionThreadMessages).toHaveBeenCalledWith(
      expect.objectContaining({
        surface: "journeys",
        source: "plan",
        rows: expect.arrayContaining([
          expect.objectContaining({
            role: "assistant",
            content: "Quest?",
            metadata: expect.objectContaining({
              structuredResponse: null,
              followUpQuestions: [],
              proposals: [],
              suggestedReminders: [],
              sessionState: expect.objectContaining({
                pendingStarterIntent: "quest_capture",
                draft: expect.objectContaining({
                  draftKind: "create_quest",
                }),
              }),
            }),
          }),
        ]),
      }),
    );
  });

  it("continues quest capture follow-ups through the normal planner request", async () => {
    mocks.invoke.mockResolvedValue({
      data: {
        mode: "proposal",
        reply: "I drafted your quest.",
        followUpQuestions: [],
        proposals: [
          {
            id: "proposal-quest-capture-1",
            kind: "create_quest",
            title: "Create Write my newsletter",
            summary: "Create a scheduled quest for Write my newsletter.",
            payload: {
              taskText: "Write my newsletter",
              taskDate: "2026-04-19",
              scheduledTime: "18:00",
            },
            status: "pending",
            readyToConfirm: true,
            missingFields: [],
          },
        ],
        suggestedReminders: [],
        memoryUpdates: {},
        sessionState: {
          draft: {
            title: "Write my newsletter",
            draftKind: "create_quest",
          },
          openQuestionIds: [],
          preferredTimeOfDay: null,
          preferredTimeReason: null,
          reminderPreference: null,
          pendingStarterIntent: null,
          lastClassification: "quest",
        },
      },
      error: null,
    });

    const { result } = renderHook(() =>
      useCompanionPlanner({ bootstrapGreeting: false })
    );

    act(() => {
      result.current.primeQuestCapture();
    });

    await act(async () => {
      await result.current.submitMessage(
        "Write my newsletter tomorrow at 18:00",
        "text",
      );
    });

    await waitFor(() => {
      expect(result.current.pendingProposals).toHaveLength(1);
    });

    const request = mocks.invoke.mock.calls.at(-1)?.[1];
    expect(request?.body.sessionState.pendingStarterIntent).toBe(
      "quest_capture",
    );
    expect(request?.body.sessionState.draft.draftKind).toBe("create_quest");
    expect(request?.body.conversationHistory).toEqual([
      {
        role: "assistant",
        content: "Quest?",
      },
    ]);
  });

  it("treats an exact typed quest starter like a local quest-capture seed", async () => {
    const { result } = renderHook(() =>
      useCompanionPlanner({ bootstrapGreeting: false })
    );

    await act(async () => {
      await result.current.submitMessage("Quest?", "text");
    });

    expect(result.current.messages).toHaveLength(1);
    expect(result.current.messages[0]?.role).toBe("companion");
    expect(result.current.messages[0]?.content).toBe("Quest?");
    expect(result.current.sessionState.pendingStarterIntent).toBe(
      "quest_capture",
    );
    expect(result.current.sessionState.draft.draftKind).toBe("create_quest");
    expect(mocks.invoke).not.toHaveBeenCalled();
  });

  it("shows a rollout-aware planner error instead of a fake lost-thread message", async () => {
    mocks.invoke.mockResolvedValue({
      data: null,
      error: {
        name: "FunctionsHttpError",
        message: "Edge Function returned a non-2xx status code",
        context: new Response("", { status: 404 }),
      },
    });

    const { result } = renderHook(() =>
      useCompanionPlanner({ bootstrapGreeting: false })
    );

    await act(async () => {
      await result.current.submitMessage(
        "Help me plan today's quests.",
        "text",
      );
    });

    await waitFor(() => {
      expect(mocks.toastError).toHaveBeenCalledWith(
        "Companion Planner isn't live in this environment yet. Please try again after the backend is updated.",
      );
    });

    expect(result.current.messages).toHaveLength(2);
    expect(result.current.messages[1]?.content).toBe(
      "Companion Planner isn't live in this environment yet. Please try again after the backend is updated.",
    );
    expect(result.current.messages[1]?.content).not.toContain(
      "lost the thread",
    );
  });

  it("uses refreshed Outlook planner context when the preflight completes in time", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-19T09:30:00.000Z"));
    mocks.useCalendarIntegrations.mockReturnValue({
      connectedByProvider: {
        outlook: {
          id: "conn-outlook-1",
          provider: "outlook",
          sync_mode: "full_sync",
        },
      },
      defaultProvider: "outlook",
    });
    mocks.syncPlanningContext.mockResolvedValue({
      calendarEvents: [
        {
          id: "evt-1",
          title: "Outlook block",
          start: "2026-04-19T12:00:00.000Z",
          end: "2026-04-19T13:00:00.000Z",
          isAllDay: false,
          provider: "outlook",
          readOnly: true,
        },
      ],
      tasks: [
        {
          id: "task-sync-1",
          task_text: "Imported Outlook task",
          task_date: null,
          scheduled_time: null,
          estimated_duration: null,
          notes: null,
          difficulty: null,
          recurrence_pattern: null,
          recurrence_end_date: null,
          completed: false,
          priority: null,
          source: "outlook_sync",
          habit_source_id: null,
          epic_id: null,
          epic_title: null,
          contact_id: null,
          subtasks: [],
        },
      ],
      removedTaskIds: [],
    });
    mocks.invoke.mockResolvedValue({
      data: {
        mode: "conversational",
        reply: "Let's map your day.",
        followUpQuestions: [],
        proposals: [],
        suggestedReminders: [],
        memoryUpdates: {},
        sessionState: {
          draft: {},
          openQuestionIds: [],
          preferredTimeOfDay: null,
          preferredTimeReason: null,
          reminderPreference: null,
          lastClassification: "quest",
        },
      },
      error: null,
    });

    const { result } = renderHook(() =>
      useCompanionPlanner({ bootstrapGreeting: false })
    );

    await act(async () => {
      await result.current.submitMessage(
        "Plan my day with Outlook in mind.",
        "text",
      );
    });

    expect(mocks.syncPlanningContext).toHaveBeenCalledWith({
      startDate: "2026-04-19",
      endDate: "2026-04-19",
    });
    const request = mocks.invoke.mock.calls.at(-1)?.[1];
    expect(request?.body.plannerContext.inboxTasks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "task-sync-1",
          title: "Imported Outlook task",
          source: "outlook_sync",
        }),
      ]),
    );
    expect(request?.body.plannerContext.calendarEvents).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "evt-1",
          title: "Outlook block",
          provider: "outlook",
        }),
      ]),
    );
  });

  it("falls back to the local planner context when Outlook sync preflight times out", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-19T09:30:00.000Z"));
    mocks.useCalendarIntegrations.mockReturnValue({
      connectedByProvider: {
        outlook: {
          id: "conn-outlook-1",
          provider: "outlook",
          sync_mode: "full_sync",
        },
      },
      defaultProvider: "outlook",
    });
    mocks.syncPlanningContext.mockImplementation(
      () => new Promise(() => undefined),
    );
    mocks.invoke.mockResolvedValue({
      data: {
        mode: "conversational",
        reply: "Let's map your day.",
        followUpQuestions: [],
        proposals: [],
        suggestedReminders: [],
        memoryUpdates: {},
        sessionState: {
          draft: {},
          openQuestionIds: [],
          preferredTimeOfDay: null,
          preferredTimeReason: null,
          reminderPreference: null,
          lastClassification: "quest",
        },
      },
      error: null,
    });

    const { result } = renderHook(() =>
      useCompanionPlanner({ bootstrapGreeting: false })
    );

    await act(async () => {
      const submitPromise = result.current.submitMessage(
        "Plan my day with Outlook in mind.",
        "text",
      );
      await vi.advanceTimersByTimeAsync(3_000);
      await submitPromise;
    });

    const request = mocks.invoke.mock.calls.at(-1)?.[1];
    expect(mocks.syncPlanningContext).toHaveBeenCalledWith({
      startDate: "2026-04-19",
      endDate: "2026-04-19",
    });
    expect(request?.body.plannerContext.inboxTasks).toEqual([]);
    expect(request?.body.plannerContext.calendarEvents).toEqual([]);
  });

  it("falls back to backend classification when client-side classification preflight times out", async () => {
    vi.useFakeTimers();
    mocks.classify.mockImplementation(
      () => new Promise(() => undefined),
    );
    mocks.invoke.mockResolvedValue({
      data: {
        mode: "schedule_read",
        reply: "Here is your schedule for 2026-04-18.",
        followUpQuestions: [],
        proposals: [],
        suggestedReminders: [],
        memoryUpdates: {},
        sessionState: {
          draft: {},
          openQuestionIds: [],
          preferredTimeOfDay: null,
          preferredTimeReason: null,
          reminderPreference: null,
          lastClassification: "quest",
        },
      },
      error: null,
    });

    const { result } = renderHook(() =>
      useCompanionPlanner({ bootstrapGreeting: false })
    );

    await act(async () => {
      const submitPromise = result.current.submitMessage(
        "Show me today's route.",
        "text",
      );
      await vi.advanceTimersByTimeAsync(3_000);
      await submitPromise;
    });

    const request = mocks.invoke.mock.calls.at(-1)?.[1];
    expect(request?.body.classificationHint).toBeNull();
  });

  it("keeps read-only schedule briefings out of planner memory telemetry", async () => {
    mocks.invoke.mockResolvedValue({
      data: {
        mode: "schedule_read",
        reply: "Today: therapy at 3 PM.\nTomorrow: open.",
        plannerContract: {
          mode: "schedule_read",
          writePolicy: "read_only",
          decisionSummary: "Today has one fixed event.",
          reasonCodes: ["calendar_constraint"],
          decisionPoint: {
            label: "No changes needed right now.",
            action: "none",
          },
          clarifyingQuestion: null,
        },
        followUpQuestions: [],
        proposals: [],
        suggestedReminders: [],
        structuredResponse: {
          intent: {
            intentType: "conversation",
            timeHorizon: "today",
            isRecurring: false,
            shouldCreateQuest: false,
            shouldPromptCampaign: false,
          },
          comingUp: {
            message: "Today: therapy at 3 PM.\nTomorrow: open.",
            nextEvent: null,
            nextBestAction: null,
            remainingToday: [],
            tomorrowSummary: "open",
            missedItems: [],
          },
        },
        memoryUpdates: {},
        sessionState: {
          draft: {},
          openQuestionIds: [],
          preferredTimeOfDay: null,
          preferredTimeReason: null,
          reminderPreference: null,
          lastClassification: "conversation",
        },
      },
      error: null,
    });

    const { result } = renderHook(() =>
      useCompanionPlanner({ bootstrapGreeting: false })
    );

    await act(async () => {
      await result.current.submitMessage("What do I have coming up?", "text", {
        starterIntent: "upcoming_start",
      });
    });

    expect(mocks.insertPlannerEvent).not.toHaveBeenCalled();
    expect(mocks.trackInteraction).not.toHaveBeenCalled();
    expect(result.current.messages.at(-1)?.content).toBe(
      "Today: therapy at 3 PM.\nTomorrow: open.",
    );
  });

  it("tracks optimizer source, mode, and fallback telemetry when proposals are generated", async () => {
    mocks.invoke.mockResolvedValue({
      data: {
        mode: "proposal",
        reply: "I drafted three quests for you.",
        followUpQuestions: [],
        proposals: [
          {
            id: "proposal-1",
            kind: "create_quest",
            title: "Create Clean The House",
            summary: "Create a quest for Clean The House.",
            payload: {
              taskText: "Clean The House",
              source: "optimizer",
              optimizerSource: "remote",
              optimizerMode: "week",
              usedFallback: false,
              fallbackToInbox: false,
              draftStatus: "scheduled_draft",
              reasonSummary:
                "Scheduled after work to match your availability. and keeps this moving today.",
            },
            status: "pending",
            readyToConfirm: true,
            missingFields: [],
          },
          {
            id: "proposal-2",
            kind: "create_quest",
            title: "Create Workout",
            summary: "Create a quest for Workout.",
            payload: {
              taskText: "Workout",
              source: "optimizer",
              optimizerSource: "remote",
              optimizerMode: "week",
              usedFallback: false,
              fallbackToInbox: false,
              draftStatus: "tentative_time",
              reasonSummary:
                "Scheduled after work to match your availability. consider moving it earlier if the day tightens.",
            },
            status: "pending",
            readyToConfirm: true,
            missingFields: [],
          },
          {
            id: "proposal-3",
            kind: "create_quest",
            title: "Create Work On The App",
            summary: "Create an inbox quest for Work On The App.",
            payload: {
              taskText: "Work On The App",
              source: "optimizer",
              optimizerSource: "remote",
              optimizerMode: "week",
              usedFallback: true,
              fallbackToInbox: true,
              draftStatus: "needs_scheduling",
              reasonSummary:
                "I kept this as a draft because I couldn't find a clean slot yet. approve it later or place it manually.",
            },
            status: "pending",
            readyToConfirm: true,
            missingFields: [],
          },
        ],
        suggestedReminders: [],
        memoryUpdates: {},
        sessionState: {
          draft: {
            title: "Workout",
            draftKind: "create_quest",
          },
          openQuestionIds: [],
          preferredTimeOfDay: null,
          preferredTimeReason: null,
          reminderPreference: null,
          lastClassification: "quest",
        },
      },
      error: null,
    });

    const { result } = renderHook(() =>
      useCompanionPlanner({ bootstrapGreeting: false })
    );

    await act(async () => {
      await result.current.setHorizon("week");
      await result.current.submitMessage(
        "Clean the house, work on the app, and workout later",
        "text",
      );
    });

    expect(mocks.trackInteraction).toHaveBeenCalledWith(
      expect.objectContaining({
        interactionType: "companion_planner",
        userAction: "accepted",
        modifications: expect.objectContaining({
          optimizerProposalCount: 3,
          optimizerSources: ["remote"],
          optimizerModes: ["week"],
          usedFallback: true,
          fallbackProposalCount: 1,
        }),
      }),
    );
  });

  it("passes enriched quest notes and subtasks through create confirmations", async () => {
    mocks.invoke.mockResolvedValue({
      data: {
        mode: "proposal",
        reply: "I drafted a richer quest for you.",
        followUpQuestions: [],
        proposals: [
          {
            id: "proposal-1",
            kind: "create_quest",
            title: "Create Workout",
            summary:
              "Create a quest for Workout with a short note and 2 subtasks.",
            payload: {
              taskText: "Workout",
              difficulty: "medium",
              taskDate: null,
              scheduledTime: null,
              notes: "Upper body focus with 10 minutes of cardio to finish.",
              subtasks: ["Warm up", "Finish with cardio"],
            },
            status: "pending",
            readyToConfirm: true,
            missingFields: [],
          },
        ],
        suggestedReminders: [],
        memoryUpdates: {},
        sessionState: {
          draft: {
            title: "Workout",
            draftKind: "create_quest",
            questNotes: "Upper body focus with 10 minutes of cardio to finish.",
            questSubtasks: ["Warm up", "Finish with cardio"],
          },
          openQuestionIds: [],
          preferredTimeOfDay: null,
          preferredTimeReason: null,
          reminderPreference: null,
          lastClassification: "quest",
        },
      },
      error: null,
    });

    const { result } = renderHook(() =>
      useCompanionPlanner({ bootstrapGreeting: false })
    );

    await act(async () => {
      await result.current.submitMessage(
        "Set up a workout quest with details",
        "text",
      );
    });

    await waitFor(() => {
      expect(result.current.pendingProposals).toHaveLength(1);
    });

    await act(async () => {
      await result.current.confirmProposal("proposal-1");
    });

    expect(mocks.addTask).toHaveBeenCalledWith(expect.objectContaining({
      taskText: "Workout",
      difficulty: "medium",
      taskDate: null,
      scheduledTime: null,
      notes: "Upper body focus with 10 minutes of cardio to finish.",
      subtasks: ["Warm up", "Finish with cardio"],
    }));
  });

  it("clears stale preferred time reasons before persisting explicit quest timing", async () => {
    Object.defineProperty(window, "localStorage", {
      configurable: true,
      writable: true,
      value: {
        getItem: vi.fn(() =>
          JSON.stringify({
            preferredTimeOfDay: "afternoon",
            preferredTimeReason: "usual afternoon rhythm",
            reminderPreference: "15 minutes",
          })
        ),
        setItem: vi.fn(),
        removeItem: vi.fn(),
      },
    });

    mocks.invoke.mockResolvedValue({
      data: {
        mode: "proposal",
        reply:
          "I drafted this as a quest for today at 5:00 pm. Take a look, and confirm it if it fits.",
        followUpQuestions: [],
        proposals: [
          {
            id: "proposal-1",
            kind: "create_quest",
            title: "Create Workout",
            summary: 'Create a quest for "Workout" at 5:00 pm.',
            payload: {
              taskText: "Workout",
              difficulty: "medium",
              taskDate: "2026-04-18",
              scheduledTime: "17:00",
              reminderMinutesBefore: 15,
            },
            status: "pending",
            readyToConfirm: true,
            missingFields: [],
          },
        ],
        suggestedReminders: [],
        memoryUpdates: {
          preferredTimeOfDay: "evening",
          preferredTimeReason: null,
          reminderPreference: "15 minutes",
        },
        sessionState: {
          draft: {
            title: "Workout",
            draftKind: "create_quest",
            scheduledDate: "2026-04-18",
            scheduledTime: "17:00",
            timeOfDay: "evening",
            timeReason: null,
          },
          openQuestionIds: [],
          preferredTimeOfDay: "evening",
          preferredTimeReason: null,
          reminderPreference: "15 minutes",
          pendingStarterIntent: null,
          lastClassification: "quest",
        },
      },
      error: null,
    });

    const { result } = renderHook(() =>
      useCompanionPlanner({ bootstrapGreeting: false })
    );

    act(() => {
      result.current.primeQuestCapture();
    });

    await act(async () => {
      await result.current.submitMessage("Workout at 5", "text");
    });

    await waitFor(() => {
      expect(result.current.pendingProposals).toHaveLength(1);
    });

    expect(result.current.sessionState.preferredTimeOfDay).toBe("evening");
    expect(result.current.sessionState.preferredTimeReason).toBeNull();

    await act(async () => {
      await result.current.confirmProposal("proposal-1");
    });

    expect(mocks.addTask).toHaveBeenCalledWith(expect.objectContaining({
      taskText: "Workout",
      scheduledTime: "17:00",
    }));
    expect(mocks.upsertPlannerPreferences).toHaveBeenCalled();

    const [payload] = mocks.upsertPlannerPreferences.mock.calls.at(-1) ?? [];
    expect(payload).toEqual(expect.objectContaining({
      user_id: "user-1",
    }));
    expect(payload.preferred_work_blocks.planner_profile.preferredTimeOfDay)
      .toBe("evening");
    expect(payload.preferred_work_blocks.planner_profile.preferredTimeReason)
      .toBeNull();
    expect(payload.preferred_work_blocks.planner_profile.preferredWindows)
      .toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            timeOfDay: "evening",
            time: "17:00",
            reason: null,
          }),
        ]),
      );
  });

  it("normalizes confirm-ready quest drafts so follow-up questions never block confirmation", async () => {
    mocks.invoke.mockResolvedValue({
      data: {
        mode: "proposal",
        reply: "What makes this timing right?",
        followUpQuestions: [
          {
            id: "details",
            prompt: "What makes this timing right?",
            required: true,
            field: "details",
          },
        ],
        proposals: [
          {
            id: "proposal-1",
            kind: "create_quest",
            title: "Create Workout",
            summary: "Create a quest for Workout.",
            payload: {
              taskText: "Workout",
              difficulty: "medium",
              taskDate: null,
              scheduledTime: null,
            },
            status: "pending",
            readyToConfirm: true,
            missingFields: [],
          },
        ],
        suggestedReminders: [],
        memoryUpdates: {},
        sessionState: {
          draft: {
            title: "Workout",
            draftKind: "create_quest",
          },
          openQuestionIds: ["details"],
          preferredTimeOfDay: null,
          preferredTimeReason: null,
          reminderPreference: null,
          lastClassification: "quest",
        },
      },
      error: null,
    });

    const { result } = renderHook(() =>
      useCompanionPlanner({ bootstrapGreeting: false })
    );

    await act(async () => {
      await result.current.submitMessage("Make me a workout quest", "text");
    });

    expect(result.current.questions).toEqual([]);
    expect(result.current.sessionState.openQuestionIds).toEqual([]);
    expect(result.current.messages.at(-1)?.content).toBe(
      "I drafted this quest for you. Review it and confirm if it fits.",
    );

    await act(async () => {
      await result.current.confirmProposal("proposal-1");
    });

    expect(result.current.questions).toEqual([]);
  });

  it("normalizes mixed proposal turns when a ready quest draft is present", async () => {
    mocks.invoke.mockResolvedValue({
      data: {
        mode: "proposal",
        reply: "What makes this timing right?",
        followUpQuestions: [
          {
            id: "details",
            prompt: "What makes this timing right?",
            required: true,
            field: "details",
          },
        ],
        proposals: [
          {
            id: "proposal-1",
            kind: "create_quest",
            title: "Create Workout",
            summary: "Create a quest for Workout.",
            payload: {
              taskText: "Workout",
              difficulty: "medium",
              taskDate: null,
              scheduledTime: null,
            },
            status: "pending",
            readyToConfirm: true,
            missingFields: [],
          },
          {
            id: "proposal-2",
            kind: "update_campaign",
            title: "Update Campaign",
            summary: "Update Campaign Aurora.",
            payload: {},
            status: "pending",
            readyToConfirm: false,
            missingFields: ["campaign details"],
          },
        ],
        suggestedReminders: [],
        memoryUpdates: {},
        sessionState: {
          draft: {
            title: "Workout",
            draftKind: "create_quest",
          },
          openQuestionIds: ["details"],
          preferredTimeOfDay: null,
          preferredTimeReason: null,
          reminderPreference: null,
          lastClassification: "quest",
        },
      },
      error: null,
    });

    const { result } = renderHook(() =>
      useCompanionPlanner({ bootstrapGreeting: false })
    );

    await act(async () => {
      await result.current.submitMessage("Make me a workout quest", "text");
    });

    expect(result.current.pendingProposals).toHaveLength(2);
    expect(result.current.questions).toEqual([]);
    expect(result.current.sessionState.openQuestionIds).toEqual([]);
    expect(result.current.messages.at(-1)?.content).toBe(
      "I drafted this quest for you. Review it and confirm if it fits.",
    );
  });

  it("clears lingering planner questions after rejecting a ready proposal", async () => {
    mocks.invoke.mockResolvedValue({
      data: {
        mode: "proposal",
        reply: "I drafted your workout quest.",
        followUpQuestions: [
          {
            id: "details",
            prompt: "What makes this timing right?",
            required: true,
            field: "details",
          },
        ],
        proposals: [
          {
            id: "proposal-1",
            kind: "create_quest",
            title: "Create Workout",
            summary: "Create a quest for Workout.",
            payload: {
              taskText: "Workout",
            },
            status: "pending",
            readyToConfirm: true,
            missingFields: [],
          },
        ],
        suggestedReminders: [],
        memoryUpdates: {},
        sessionState: {
          draft: {
            title: "Workout",
            draftKind: "create_quest",
          },
          openQuestionIds: ["details"],
          preferredTimeOfDay: null,
          preferredTimeReason: null,
          reminderPreference: null,
          lastClassification: "quest",
        },
      },
      error: null,
    });

    const { result } = renderHook(() =>
      useCompanionPlanner({ bootstrapGreeting: false })
    );

    await act(async () => {
      await result.current.submitMessage("Make me a workout quest", "text");
    });

    expect(result.current.questions).toEqual([]);

    await act(async () => {
      await result.current.rejectProposal("proposal-1");
    });

    expect(result.current.questions).toEqual([]);
    expect(mocks.addTask).not.toHaveBeenCalled();
  });

  it("clears lingering planner questions after confirming all ready proposals", async () => {
    mocks.invoke.mockResolvedValue({
      data: {
        mode: "proposal",
        reply: "I drafted both quest options.",
        followUpQuestions: [
          {
            id: "details",
            prompt: "What makes this timing right?",
            required: true,
            field: "details",
          },
        ],
        proposals: [
          {
            id: "proposal-1",
            kind: "create_quest",
            title: "Create Workout",
            summary: "Create a quest for Workout.",
            payload: {
              taskText: "Workout",
            },
            status: "pending",
            readyToConfirm: true,
            missingFields: [],
          },
          {
            id: "proposal-2",
            kind: "create_quest",
            title: "Create Stretch",
            summary: "Create a quest for Stretch.",
            payload: {
              taskText: "Stretch",
            },
            status: "pending",
            readyToConfirm: true,
            missingFields: [],
          },
        ],
        suggestedReminders: [],
        memoryUpdates: {},
        sessionState: {
          draft: {
            title: "Workout",
            draftKind: "create_quest",
          },
          openQuestionIds: ["details"],
          preferredTimeOfDay: null,
          preferredTimeReason: null,
          reminderPreference: null,
          lastClassification: "quest",
        },
      },
      error: null,
    });

    const { result } = renderHook(() =>
      useCompanionPlanner({ bootstrapGreeting: false })
    );

    await act(async () => {
      await result.current.submitMessage("Make me two movement quests", "text");
    });

    expect(result.current.questions).toEqual([]);

    await act(async () => {
      await result.current.confirmAll();
    });

    expect(result.current.questions).toEqual([]);
    expect(mocks.addTask).toHaveBeenCalledTimes(2);
  });

  it("auto-publishes confirmed quest creations to Outlook when Outlook is the full-sync default", async () => {
    mocks.useCalendarIntegrations.mockReturnValue({
      connectedByProvider: {
        outlook: {
          id: "conn-outlook-2",
          provider: "outlook",
          sync_mode: "full_sync",
        },
      },
      defaultProvider: "outlook",
    });
    mocks.addTask.mockResolvedValue({
      id: "task-created-1",
      queued: false,
    });
    mocks.invoke.mockResolvedValue({
      data: {
        mode: "proposal",
        reply: "I drafted a quest for you.",
        followUpQuestions: [],
        proposals: [
          {
            id: "proposal-outlook-1",
            kind: "create_quest",
            title: "Create Deep Work Block",
            summary: "Create a scheduled work block.",
            payload: {
              taskText: "Deep Work Block",
              difficulty: "medium",
              taskDate: "2026-04-19",
              scheduledTime: "09:00",
            },
            status: "pending",
            readyToConfirm: true,
            missingFields: [],
          },
        ],
        suggestedReminders: [],
        memoryUpdates: {},
        sessionState: {
          draft: {
            title: "Deep Work Block",
            draftKind: "create_quest",
          },
          openQuestionIds: [],
          preferredTimeOfDay: null,
          preferredTimeReason: null,
          reminderPreference: null,
          lastClassification: "quest",
        },
      },
      error: null,
    });

    const { result } = renderHook(() =>
      useCompanionPlanner({ bootstrapGreeting: false })
    );

    await act(async () => {
      await result.current.submitMessage("Block deep work at 9.", "text");
    });

    await waitFor(() => {
      expect(result.current.pendingProposals).toHaveLength(1);
    });

    await act(async () => {
      await result.current.confirmProposal("proposal-outlook-1");
    });

    expect(mocks.sendTaskToCalendar).toHaveBeenCalledWith({
      taskId: "task-created-1",
      options: {
        provider: "outlook",
      },
    });
  });

  it("applies update quest subtask plans after confirming the proposal", async () => {
    mocks.invoke.mockResolvedValue({
      data: {
        mode: "proposal",
        reply: "I updated the quest draft with a note and steps.",
        followUpQuestions: [],
        proposals: [
          {
            id: "proposal-1",
            kind: "update_quest",
            title: "Update Workout",
            summary: "Update Workout and append 2 subtasks.",
            payload: {
              taskId: "task-1",
              updates: {
                notes: "Leg day plus a cooldown walk.",
              },
              subtaskPlan: {
                mode: "append",
                titles: ["Warm up", "Cooldown walk"],
              },
            },
            status: "pending",
            readyToConfirm: true,
            missingFields: [],
          },
        ],
        suggestedReminders: [],
        memoryUpdates: {},
        sessionState: {
          draft: {
            taskId: "task-1",
            draftKind: "update_quest",
            questNotes: "Leg day plus a cooldown walk.",
            questSubtasks: ["Warm up", "Cooldown walk"],
            questSubtaskPlanMode: "append",
          },
          openQuestionIds: [],
          preferredTimeOfDay: null,
          preferredTimeReason: null,
          reminderPreference: null,
          lastClassification: "quest",
        },
      },
      error: null,
    });

    const { result } = renderHook(() =>
      useCompanionPlanner({ bootstrapGreeting: false })
    );

    await act(async () => {
      await result.current.submitMessage("Update my workout quest", "text");
    });

    await waitFor(() => {
      expect(result.current.pendingProposals).toHaveLength(1);
    });

    await act(async () => {
      await result.current.confirmProposal("proposal-1");
    });

    expect(mocks.updateTask).toHaveBeenCalledWith({
      taskId: "task-1",
      updates: {
        notes: "Leg day plus a cooldown walk.",
      },
    });
    expect(mocks.applySubtaskTitlePlan).toHaveBeenCalledWith({
      mode: "append",
      taskId: "task-1",
      userId: "user-1",
      titles: ["Warm up", "Cooldown walk"],
      shouldQueueWrites: false,
      queueAction: expect.any(Function),
      retryNow: mocks.retryNow,
    });
    expect(mocks.invalidateQueries).toHaveBeenCalledWith({
      queryKey: ["subtasks", "task-1"],
    });
    expect(mocks.invalidateQueries).toHaveBeenCalledWith({
      queryKey: ["daily-tasks"],
    });
    expect(mocks.invalidateQueries).toHaveBeenCalledWith({
      queryKey: ["calendar-tasks"],
    });
    expect(mocks.invalidateQueries).toHaveBeenCalledWith({
      queryKey: ["inbox-tasks"],
    });
  });

  it("keeps the quest update confirmed when subtask writes fail after the main update succeeds", async () => {
    mocks.applySubtaskTitlePlan.mockRejectedValue(
      new Error("subtask write failed"),
    );
    mocks.invoke.mockResolvedValue({
      data: {
        mode: "proposal",
        reply: "I updated the quest draft with a note and steps.",
        followUpQuestions: [],
        proposals: [
          {
            id: "proposal-1",
            kind: "update_quest",
            title: "Update Workout",
            summary: "Update Workout and replace 1 subtask.",
            payload: {
              taskId: "task-1",
              updates: {
                notes: "Full reset workout.",
              },
              subtaskPlan: {
                mode: "replace",
                titles: ["Reset the routine"],
              },
            },
            status: "pending",
            readyToConfirm: true,
            missingFields: [],
          },
        ],
        suggestedReminders: [],
        memoryUpdates: {},
        sessionState: {
          draft: {
            taskId: "task-1",
            draftKind: "update_quest",
            questNotes: "Full reset workout.",
            questSubtasks: ["Reset the routine"],
            questSubtaskPlanMode: "replace",
          },
          openQuestionIds: [],
          preferredTimeOfDay: null,
          preferredTimeReason: null,
          reminderPreference: null,
          lastClassification: "quest",
        },
      },
      error: null,
    });

    const { result } = renderHook(() =>
      useCompanionPlanner({ bootstrapGreeting: false })
    );

    await act(async () => {
      await result.current.submitMessage("Refresh my workout quest", "text");
    });

    await waitFor(() => {
      expect(result.current.pendingProposals).toHaveLength(1);
    });

    await act(async () => {
      await result.current.confirmProposal("proposal-1");
    });

    await waitFor(() => {
      expect(result.current.proposals[0]?.status).toBe("confirmed");
    });

    expect(mocks.updateTask).toHaveBeenCalledWith({
      taskId: "task-1",
      updates: {
        notes: "Full reset workout.",
      },
    });
    expect(mocks.toastMessage).toHaveBeenCalledWith(
      "Quest updated, but I couldn't finish the step breakdown yet.",
    );
    expect(result.current.messages.at(-1)?.content).toBe(
      "Saved: Update Workout. I couldn't finish the step breakdown yet.",
    );
  });

  it("omits nullable nested classification fields from the planner request body", async () => {
    mocks.classify.mockResolvedValue({
      type: "quest",
      confidence: 0.91,
      reasoning: "Schedule question",
      timelineAnalysis: null,
    });
    mocks.invoke.mockResolvedValue({
      data: {
        mode: "schedule_read",
        reply: "Here is your schedule for 2026-04-18.",
        followUpQuestions: [],
        proposals: [],
        suggestedReminders: [],
        memoryUpdates: {},
        sessionState: {
          draft: {},
          openQuestionIds: [],
          preferredTimeOfDay: null,
          preferredTimeReason: null,
          reminderPreference: null,
          lastClassification: "quest",
        },
      },
      error: null,
    });

    const { result } = renderHook(() =>
      useCompanionPlanner({ bootstrapGreeting: false })
    );

    await act(async () => {
      await result.current.submitMessage("Show me today's route.", "text");
    });

    const request = mocks.invoke.mock.calls[0]?.[1];
    expect(request?.body.classificationHint).toEqual({
      type: "quest",
      confidence: 0.91,
      reasoning: "Schedule question",
    });
    expect(request?.body.currentDateTime).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(request?.body.conversationHistory).toEqual([]);
    expect("timelineAnalysis" in request.body.classificationHint).toBe(false);
  });

  it("normalizes legacy classifier aliases and drops malformed timeline analysis before sending the planner request", async () => {
    mocks.classify.mockResolvedValue({
      type: "brain_dump",
      confidence: 0.83,
      reasoning: "Needs unpacking",
      timelineAnalysis: {
        statedDays: "14",
        typicalDays: 60,
        feasibility: "impossible",
        adjustmentFactors: ["retake", 2],
      },
    });
    mocks.invoke.mockResolvedValue({
      data: {
        mode: "schedule_read",
        reply: "Here is your schedule for 2026-04-18.",
        followUpQuestions: [],
        proposals: [],
        suggestedReminders: [],
        memoryUpdates: {},
        sessionState: {
          draft: {},
          openQuestionIds: [],
          preferredTimeOfDay: null,
          preferredTimeReason: null,
          reminderPreference: null,
          lastClassification: "quest",
        },
      },
      error: null,
    });

    const { result } = renderHook(() =>
      useCompanionPlanner({ bootstrapGreeting: false })
    );

    await act(async () => {
      await result.current.submitMessage("Show me today's route.", "text");
    });

    const request = mocks.invoke.mock.calls[0]?.[1];
    expect(request?.body.classificationHint).toEqual({
      type: "brain-dump",
      confidence: 0.83,
      reasoning: "Needs unpacking",
    });
    expect("timelineAnalysis" in request.body.classificationHint).toBe(false);
  });

  it("strips nullable AI signal fields before building the planner request body", async () => {
    mocks.enrichedContext = {
      preferredDifficulty: null,
      preferredHabitFrequency: null,
      preferredEpicDuration: null,
      commonContexts: null,
      suggestedWorkload: "normal",
    };
    mocks.invoke.mockResolvedValue({
      data: {
        mode: "schedule_read",
        reply: "Here is your schedule for 2026-04-18.",
        followUpQuestions: [],
        proposals: [],
        suggestedReminders: [],
        memoryUpdates: {},
        sessionState: {
          draft: {},
          openQuestionIds: [],
          preferredTimeOfDay: null,
          preferredTimeReason: null,
          reminderPreference: null,
          lastClassification: "quest",
        },
      },
      error: null,
    });

    const { result } = renderHook(() =>
      useCompanionPlanner({ bootstrapGreeting: false })
    );

    await act(async () => {
      await result.current.submitMessage("Plan my day", "text");
    });

    const request = mocks.invoke.mock.calls[0]?.[1];
    expect(request?.body.plannerContext.aiSignals).toEqual({
      suggestedWorkload: "normal",
    });
  });

  it("clears stale pending proposals when the planner responds with a clarification question only", async () => {
    mocks.invoke
      .mockResolvedValueOnce({
        data: {
          mode: "proposal",
          reply: "I turned this into a quest draft.",
          followUpQuestions: [],
          proposals: [
            {
              id: "proposal-1",
              kind: "create_quest",
              title: "Write my launch notes",
              summary: "Draft a focused writing block.",
              payload: {},
              status: "pending",
              readyToConfirm: true,
              missingFields: [],
            },
          ],
          suggestedReminders: [],
          memoryUpdates: {},
          sessionState: {
            draft: {
              title: "Write my launch notes",
              draftKind: "create_quest",
            },
            openQuestionIds: [],
            preferredTimeOfDay: null,
            preferredTimeReason: null,
            reminderPreference: null,
            lastClassification: "quest",
          },
        },
        error: null,
      })
      .mockResolvedValueOnce({
        data: {
          mode: "conversational",
          reply: "Let's start with what you want to get done.",
          followUpQuestions: [
            {
              id: "details",
              prompt: "What do you want to get done?",
              reason:
                "Once you name the goal, I'll look at what's open and shape the plan around it.",
              required: true,
              field: "details",
            },
          ],
          proposals: [],
          suggestedReminders: [],
          memoryUpdates: {},
          sessionState: {
            draft: {},
            openQuestionIds: ["details"],
            preferredTimeOfDay: null,
            preferredTimeReason: null,
            reminderPreference: null,
            lastClassification: "quest",
          },
        },
        error: null,
      });

    const { result } = renderHook(() =>
      useCompanionPlanner({ bootstrapGreeting: false })
    );

    await act(async () => {
      await result.current.submitMessage("Write my launch notes", "text");
    });

    await waitFor(() => {
      expect(result.current.pendingProposals).toHaveLength(1);
    });

    await act(async () => {
      await result.current.submitMessage(
        "Make room",
        "text",
      );
    });

    await waitFor(() => {
      expect(result.current.pendingProposals).toHaveLength(0);
    });

    expect(result.current.questions.map((question) => question.field)).toEqual([
      "details",
    ]);
  });

  it("clears stale pending proposals when the planner responds with a schedule read", async () => {
    mocks.invoke
      .mockResolvedValueOnce({
        data: {
          mode: "proposal",
          reply: "I turned this into a quest draft.",
          followUpQuestions: [],
          proposals: [
            {
              id: "proposal-1",
              kind: "create_quest",
              title: "Write my launch notes",
              summary: "Draft a focused writing block.",
              payload: {},
              status: "pending",
              readyToConfirm: true,
              missingFields: [],
            },
          ],
          suggestedReminders: [],
          memoryUpdates: {},
          sessionState: {
            draft: {
              title: "Write my launch notes",
              draftKind: "create_quest",
            },
            openQuestionIds: [],
            preferredTimeOfDay: null,
            preferredTimeReason: null,
            reminderPreference: null,
            lastClassification: "quest",
          },
        },
        error: null,
      })
      .mockResolvedValueOnce({
        data: {
          mode: "schedule_read",
          reply: "Here's what the rest of today and tomorrow look like.",
          followUpQuestions: [],
          proposals: [],
          suggestedReminders: [],
          memoryUpdates: {},
          sessionState: {
            draft: {},
            openQuestionIds: [],
            preferredTimeOfDay: null,
            preferredTimeReason: null,
            reminderPreference: null,
            lastClassification: "quest",
          },
        },
        error: null,
      });

    const { result } = renderHook(() =>
      useCompanionPlanner({ bootstrapGreeting: false })
    );

    await act(async () => {
      await result.current.submitMessage("Write my launch notes", "text");
    });

    await waitFor(() => {
      expect(result.current.pendingProposals).toHaveLength(1);
    });

    await act(async () => {
      await result.current.submitMessage("What do I have coming up?", "text");
    });

    await waitFor(() => {
      expect(result.current.pendingProposals).toHaveLength(0);
    });
  });

  it("replaces stale pending proposals when a later conversational reply has no new proposal", async () => {
    mocks.invoke
      .mockResolvedValueOnce({
        data: {
          mode: "proposal",
          reply: "I turned this into a quest draft.",
          followUpQuestions: [],
          proposals: [
            {
              id: "proposal-1",
              kind: "create_quest",
              title: "Write my launch notes",
              summary: "Draft a focused writing block.",
              payload: {},
              status: "pending",
              readyToConfirm: true,
              missingFields: [],
            },
          ],
          suggestedReminders: [],
          memoryUpdates: {},
          sessionState: {
            draft: {
              title: "Write my launch notes",
              draftKind: "create_quest",
            },
            openQuestionIds: [],
            preferredTimeOfDay: null,
            preferredTimeReason: null,
            reminderPreference: null,
            lastClassification: "quest",
          },
        },
        error: null,
      })
      .mockResolvedValueOnce({
        data: {
          mode: "conversational",
          reply:
            "That works. We can talk through the tradeoffs before I draft anything else.",
          followUpQuestions: [],
          proposals: [],
          suggestedReminders: [],
          memoryUpdates: {},
          sessionState: {
            draft: {},
            openQuestionIds: [],
            preferredTimeOfDay: null,
            preferredTimeReason: null,
            reminderPreference: null,
            lastClassification: "quest",
          },
        },
        error: null,
      });

    const { result } = renderHook(() =>
      useCompanionPlanner({ bootstrapGreeting: false })
    );

    await act(async () => {
      await result.current.submitMessage("Write my launch notes", "text");
    });

    await waitFor(() => {
      expect(result.current.pendingProposals).toHaveLength(1);
    });

    await act(async () => {
      await result.current.submitMessage("Talk me through it first.", "text");
    });

    await waitFor(() => {
      expect(result.current.pendingProposals).toHaveLength(0);
    });
  });

  it("tracks accepted proposal analytics with proposal identifiers", async () => {
    mocks.invoke.mockResolvedValue({
      data: {
        mode: "proposal",
        reply:
          "I drafted this quest for you. Review it and confirm if it fits.",
        followUpQuestions: [],
        proposals: [
          {
            id: "proposal-1",
            kind: "create_quest",
            title: "Create Workout",
            summary: "Create a quest for Workout.",
            payload: {
              taskText: "Workout",
              taskDate: "2026-04-18",
              scheduledTime: "17:30",
              source: "optimizer",
              optimizerSource: "remote",
              optimizerMode: "day",
              usedFallback: false,
              draftStatus: "scheduled_draft",
              schedulingConfidence: "high",
              slotScore: 72,
              reasonCodes: ["after_work_window", "matches_energy_window"],
              softConflicts: [],
              hardConflict: false,
              fallbackToInbox: false,
              reasonSummary:
                "Scheduled after work to match your availability. and keeps this moving today.",
            },
            status: "pending",
            readyToConfirm: true,
            missingFields: [],
          },
        ],
        suggestedReminders: [],
        memoryUpdates: {},
        sessionState: {
          draft: {
            title: "Workout",
            draftKind: "create_quest",
          },
          openQuestionIds: [],
          preferredTimeOfDay: null,
          preferredTimeReason: null,
          reminderPreference: null,
          lastClassification: "quest",
        },
      },
      error: null,
    });

    const { result } = renderHook(() =>
      useCompanionPlanner({ bootstrapGreeting: false })
    );

    await act(async () => {
      await result.current.submitMessage("Make me a workout quest", "text");
    });

    await act(async () => {
      await result.current.confirmProposal("proposal-1");
    });

    expect(mocks.trackInteraction).toHaveBeenCalledWith(
      expect.objectContaining({
        userAction: "accepted",
        modifications: expect.objectContaining({
          proposalId: "proposal-1",
          proposalKind: "create_quest",
          optimizerSource: "remote",
          optimizerMode: "day",
          usedFallback: false,
          draftStatus: "scheduled_draft",
          schedulingConfidence: "high",
          slotScore: 72,
          reasonCodes: ["after_work_window", "matches_energy_window"],
          hardConflict: false,
          fallbackToInbox: false,
          reasonSummary:
            "Scheduled after work to match your availability. and keeps this moving today.",
        }),
      }),
    );
  });

  it("tracks rejected proposal analytics with decision overrides", async () => {
    mocks.invoke.mockResolvedValue({
      data: {
        mode: "proposal",
        reply:
          "I drafted this quest for you. Review it and confirm if it fits.",
        followUpQuestions: [],
        proposals: [
          {
            id: "proposal-1",
            kind: "create_quest",
            title: "Create Workout",
            summary: "Create a quest for Workout.",
            payload: {
              taskText: "Workout",
              source: "optimizer",
              optimizerSource: "remote",
              optimizerMode: "day",
              usedFallback: true,
              draftStatus: "needs_scheduling",
              schedulingConfidence: "low",
              slotScore: 0,
              reasonCodes: ["needs_manual_scheduling"],
              softConflicts: ["no_safe_slot_found"],
              hardConflict: false,
              fallbackToInbox: true,
              reasonSummary:
                "I kept this as a draft because I couldn't find a clean slot yet. approve it later or place it manually.",
            },
            status: "pending",
            readyToConfirm: true,
            missingFields: [],
          },
        ],
        suggestedReminders: [],
        memoryUpdates: {},
        sessionState: {
          draft: {
            title: "Workout",
            draftKind: "create_quest",
          },
          openQuestionIds: [],
          preferredTimeOfDay: null,
          preferredTimeReason: null,
          reminderPreference: null,
          lastClassification: "quest",
        },
      },
      error: null,
    });

    const { result } = renderHook(() =>
      useCompanionPlanner({ bootstrapGreeting: false })
    );

    await act(async () => {
      await result.current.submitMessage("Make me a workout quest", "text");
    });

    await act(async () => {
      await result.current.rejectProposal("proposal-1");
    });

    expect(mocks.trackInteraction).toHaveBeenCalledWith(
      expect.objectContaining({
        userAction: "rejected",
        modifications: expect.objectContaining({
          proposalId: "proposal-1",
          proposalKind: "create_quest",
          decisionOverride: true,
          optimizerSource: "remote",
          optimizerMode: "day",
          usedFallback: true,
          draftStatus: "needs_scheduling",
          schedulingConfidence: "low",
          slotScore: 0,
          reasonCodes: ["needs_manual_scheduling"],
          softConflicts: ["no_safe_slot_found"],
          hardConflict: false,
          fallbackToInbox: true,
          reasonSummary:
            "I kept this as a draft because I couldn't find a clean slot yet. approve it later or place it manually.",
        }),
      }),
    );
  });

  it("tracks modified proposal analytics for edited quest drafts", async () => {
    mocks.invoke.mockResolvedValue({
      data: {
        mode: "proposal",
        reply:
          "I drafted this quest for you. Review it and confirm if it fits.",
        followUpQuestions: [],
        proposals: [
          {
            id: "proposal-1",
            kind: "create_quest",
            title: "Create Workout",
            summary: "Create a quest for Workout.",
            payload: {
              taskText: "Workout",
              source: "optimizer",
              optimizerSource: "remote",
              optimizerMode: "day",
              usedFallback: false,
              draftStatus: "tentative_time",
              schedulingConfidence: "medium",
              slotScore: 44,
              reasonCodes: ["after_work_window", "fragmented_slot"],
              softConflicts: ["late_day_pressure"],
              hardConflict: false,
              fallbackToInbox: false,
              reasonSummary:
                "Scheduled after work to match your availability. It uses a tighter gap than ideal. consider moving it earlier if the day tightens.",
            },
            status: "pending",
            readyToConfirm: true,
            missingFields: [],
          },
        ],
        suggestedReminders: [],
        memoryUpdates: {},
        sessionState: {
          draft: {
            title: "Workout",
            draftKind: "create_quest",
          },
          openQuestionIds: [],
          preferredTimeOfDay: null,
          preferredTimeReason: null,
          reminderPreference: null,
          lastClassification: "quest",
        },
      },
      error: null,
    });

    const { result } = renderHook(() =>
      useCompanionPlanner({ bootstrapGreeting: false })
    );

    await act(async () => {
      await result.current.submitMessage("Make me a workout quest", "text");
    });

    await act(async () => {
      await result.current.completeProposalEdit("proposal-1", {
        savedTitle: "Workout moved to tomorrow",
      });
    });

    expect(mocks.trackInteraction).toHaveBeenCalledWith(
      expect.objectContaining({
        userAction: "modified",
        modifications: expect.objectContaining({
          proposalId: "proposal-1",
          proposalKind: "create_quest",
          savedTitle: "Workout moved to tomorrow",
          editedExternally: true,
          optimizerSource: "remote",
          optimizerMode: "day",
          usedFallback: false,
          draftStatus: "tentative_time",
          schedulingConfidence: "medium",
          slotScore: 44,
          reasonCodes: ["after_work_window", "fragmented_slot"],
          softConflicts: ["late_day_pressure"],
          hardConflict: false,
          fallbackToInbox: false,
          reasonSummary:
            "Scheduled after work to match your availability. It uses a tighter gap than ideal. consider moving it earlier if the day tightens.",
        }),
      }),
    );
  });
});
