import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getCompanionPlannerOpener } from "@/shared/companionPlannerCopy";

const mocks = vi.hoisted(() => ({
  classify: vi.fn(),
  invoke: vi.fn(),
  rpc: vi.fn(),
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
  enrichedContext: null as Record<string, unknown> | null,
  todayTasks: [] as Array<Record<string, unknown>>,
  weekTasks: [] as Array<Record<string, unknown>>,
  monthTasks: [] as Array<Record<string, unknown>>,
  inboxTasks: [] as Array<Record<string, unknown>>,
  habits: null as Array<Record<string, unknown>> | null,
  epics: null as Array<Record<string, unknown>> | null,
  activeEpics: [] as Array<Record<string, unknown>>,
  queuedReceipts: [] as Array<Record<string, unknown>>,
  user: {
    id: "user-1",
  } as { id: string } | null,
  companion: {
    id: "companion-1",
  } as { id: string } | null,
}));

vi.mock("@tanstack/react-query", () => ({
  useQuery: (options?: { queryKey?: unknown[] }) => {
    const queryKey = options?.queryKey;
    if (Array.isArray(queryKey) && queryKey[0] === "habits") {
      return {
        data: mocks.habits,
        isLoading: false,
      };
    }

    return {
      data: null,
      isLoading: false,
    };
  },
  useQueryClient: () => ({
    invalidateQueries: mocks.invalidateQueries,
  }),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    functions: {
      invoke: (...args: unknown[]) => mocks.invoke(...args),
    },
    rpc: (...args: unknown[]) => mocks.rpc(...args),
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
    tasks: mocks.todayTasks,
    isLoading: false,
  }),
}));

vi.mock("@/hooks/useCalendarTasks", () => ({
  useCalendarTasks: (_date: Date, view: string) => ({
    tasks: view === "month" ? mocks.monthTasks : mocks.weekTasks,
    isLoading: false,
  }),
}));

vi.mock("@/hooks/useInboxTasks", () => ({
  useInboxTasks: () => ({
    inboxTasks: mocks.inboxTasks,
  }),
}));

vi.mock("@/hooks/useEpics", () => ({
  useEpics: () => ({
    epics: mocks.epics ?? mocks.activeEpics,
    activeEpics: mocks.activeEpics,
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
    receipts: mocks.queuedReceipts,
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
    mocks.classify.mockReset();
    mocks.invoke.mockReset();
    mocks.classify.mockResolvedValue(null);
    mocks.invoke.mockResolvedValue({
      data: {
        mode: "schedule_read",
        reply: "Planner read.",
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
          pendingStarterIntent: null,
          lastClassification: "quest",
        },
      },
      error: null,
    });
    mocks.user = { id: "user-1" };
    mocks.companion = { id: "companion-1" };
    mocks.upsertPlannerPreferences.mockResolvedValue({ error: null });
    mocks.rpc.mockImplementation((fn: string) => {
      if (fn === "upsert_day_plan_draft") {
        return Promise.resolve({ data: "plan-1", error: null });
      }
      if (fn === "apply_day_plan") {
        return Promise.resolve({
          data: { planId: "plan-1", committedTaskIds: ["task-1"] },
          error: null,
        });
      }
      return Promise.resolve({ data: null, error: null });
    });
    mocks.insertPlannerEvent.mockResolvedValue({ error: null });
    mocks.addTask.mockResolvedValue(undefined);
    mocks.updateTask.mockResolvedValue(undefined);
    mocks.applySubtaskTitlePlan.mockResolvedValue([]);
    mocks.retryNow.mockResolvedValue(undefined);
    mocks.queueAction.mockResolvedValue(undefined);
    mocks.trackTaskCreation.mockResolvedValue(undefined);
    mocks.trackScheduleModification.mockResolvedValue(undefined);
    mocks.enrichedContext = null;
    mocks.todayTasks = [];
    mocks.weekTasks = [];
    mocks.monthTasks = [];
    mocks.inboxTasks = [];
    mocks.habits = null;
    mocks.epics = null;
    mocks.activeEpics = [];
    mocks.queuedReceipts = [];
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

  it("initializes the default horizon without external calendar event queries", () => {
    const { result } = renderHook(() =>
      useCompanionPlanner({ bootstrapGreeting: false })
    );

    expect(result.current.horizon).toBe("day");
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

    const savedListener = vi.fn();
    window.addEventListener("companion-plan-my-day-action-saved", savedListener);

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
    expect(savedListener).toHaveBeenCalledTimes(1);
    window.removeEventListener("companion-plan-my-day-action-saved", savedListener);
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

  it("hydrates committed DayPlan snapshots so reloads do not show the draft lock-in CTA again", async () => {
    const { result } = renderHook(() =>
      useCompanionPlanner({ bootstrapGreeting: false })
    );

    act(() => {
      result.current.hydrateThread({
        sessionId: "persisted-planner-session",
        messages: [
          {
            id: "planner-assistant-1",
            sessionId: "persisted-planner-session",
            role: "assistant",
            content: "I drafted a focused day for you.",
            createdAt: "2026-04-18T08:00:01.000Z",
            source: "plan",
            metadata: {
              dayPlan: {
                id: null,
                date: "2026-04-18",
                status: "draft",
                updatedAt: "2026-04-18T08:00:01.000Z",
                blocks: [
                  {
                    id: "proposal-plan-1",
                    proposalId: "proposal-plan-1",
                    questId: null,
                    title: "Outline launch checklist",
                    startTime: "09:00",
                    durationMinutes: 45,
                    energyType: "deep",
                    source: "campaign",
                    reasoning: "It keeps launch moving.",
                  },
                ],
              },
              followUpQuestions: [],
              proposals: [],
              suggestedReminders: [],
              sessionState: {
                draft: {},
                openQuestionIds: [],
                pendingStarterIntent: null,
                lastClassification: "quest",
              },
            },
          },
          {
            id: "planner-assistant-2",
            sessionId: "persisted-planner-session",
            role: "assistant",
            content: "Plan locked in for Sat, Apr 18.",
            createdAt: "2026-04-18T08:05:00.000Z",
            source: "plan",
            metadata: {
              dayPlan: {
                id: "plan-1",
                date: "2026-04-18",
                status: "committed",
                updatedAt: "2026-04-18T08:00:01.000Z",
                blocks: [
                  {
                    id: "proposal-plan-1",
                    proposalId: "proposal-plan-1",
                    questId: "task-1",
                    title: "Outline launch checklist",
                    startTime: "09:00",
                    durationMinutes: 45,
                    energyType: "deep",
                    source: "campaign",
                    reasoning: "It keeps launch moving.",
                  },
                ],
              },
              followUpQuestions: [],
              proposals: [],
              suggestedReminders: [],
              sessionState: {
                draft: {},
                openQuestionIds: [],
                pendingStarterIntent: null,
                lastClassification: "quest",
              },
            },
          },
        ],
      });
    });

    expect(result.current.dayPlan?.status).toBe("committed");
    expect(result.current.dayPlan?.id).toBe("plan-1");
    expect(result.current.dayPlan?.blocks[0]?.questId).toBe("task-1");
    expect(result.current.committedDayPlanId).toBe("plan-1");
  });

  it("persists a committed DayPlan snapshot after locking in a draft", async () => {
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
      result.current.hydrateThread({
        sessionId: "persisted-planner-session",
        messages: [
          {
            id: "planner-assistant-1",
            sessionId: "persisted-planner-session",
            role: "assistant",
            content: "I drafted a focused day for you.",
            createdAt: "2026-04-18T08:00:01.000Z",
            source: "plan",
            metadata: {
              dayPlan: {
                id: null,
                date: "2026-04-18",
                status: "draft",
                updatedAt: "2026-04-18T08:00:01.000Z",
                blocks: [
                  {
                    id: "proposal-plan-1",
                    proposalId: "proposal-plan-1",
                    questId: null,
                    title: "Outline launch checklist",
                    startTime: "09:00",
                    durationMinutes: 45,
                    energyType: "deep",
                    source: "campaign",
                    reasoning: "It keeps launch moving.",
                    difficulty: "hard",
                    reminderEnabled: true,
                    reminderMinutesBefore: 20,
                    category: "mind",
                    notes: "Draft the launch checklist before standup.",
                  },
                ],
              },
              followUpQuestions: [],
              proposals: [
                {
                  id: "proposal-plan-1",
                  kind: "create_quest",
                  title: "Outline launch checklist",
                  summary: "Create a focused quest.",
                  reasoning: "It fits your first open work block.",
                  payload: {
                    taskText: "Outline launch checklist",
                    taskDate: "2026-04-18",
                    scheduledTime: "09:00",
                    estimatedDuration: 45,
                    difficulty: "hard",
                    reminderEnabled: true,
                    reminderMinutesBefore: 20,
                    category: "mind",
                    notes: "Draft the launch checklist before standup.",
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
                pendingStarterIntent: null,
                lastClassification: "quest",
              },
            },
          },
        ],
      });
    });

    await act(async () => {
      await result.current.commitDayPlan();
    });

    expect(mocks.rpc).toHaveBeenCalledWith("upsert_day_plan_draft", {
      p_plan_date: "2026-04-18",
      p_blocks: [
        expect.objectContaining({
          title: "Outline launch checklist",
          difficulty: "hard",
          reminderEnabled: true,
          reminderMinutesBefore: 20,
          category: "mind",
          notes: "Draft the launch checklist before standup.",
        }),
      ],
    });
    expect(mocks.rpc).toHaveBeenCalledWith("apply_day_plan", {
      p_plan_id: "plan-1",
    });
    expect(result.current.dayPlan?.status).toBe("committed");
    expect(result.current.dayPlan?.blocks[0]?.questId).toBe("task-1");
    expect(result.current.proposals[0]?.status).toBe("confirmed");
    expect(mocks.persistCompanionThreadMessages).toHaveBeenCalledWith(
      expect.objectContaining({
        surface: "journeys",
        source: "plan",
        rows: expect.arrayContaining([
          expect.objectContaining({
            role: "assistant",
            content: "Plan locked in for Sat, Apr 18.",
            metadata: expect.objectContaining({
              dayPlan: expect.objectContaining({
                id: "plan-1",
                status: "committed",
                blocks: [
                  expect.objectContaining({
                    questId: "task-1",
                    difficulty: "hard",
                    reminderEnabled: true,
                    reminderMinutesBefore: 20,
                    category: "mind",
                    notes: "Draft the launch checklist before standup.",
                  }),
                ],
              }),
              proposals: [
                expect.objectContaining({
                  id: "proposal-plan-1",
                  status: "confirmed",
                }),
              ],
            }),
          }),
        ]),
      }),
    );
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

  it("anchors selected-date planner requests and relative parsing to that day", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-02-10T09:30:00.000-08:00"));
    mocks.invoke.mockResolvedValue({
      data: {
        mode: "proposal",
        reply: "Drafted.",
        followUpQuestions: [],
        proposals: [
          {
            id: "proposal-selected-date-1",
            kind: "create_quest",
            title: "Pilates",
            payload: {
              title: "Pilates",
              taskDate: "2026-02-14",
              scheduledTime: "08:00",
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
            title: "Pilates",
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

    await act(async () => {
      await result.current.submitMessage("Pilates tomorrow at 8am", "text", {
        selectedDate: "2026-02-13",
      });
    });

    const request = mocks.invoke.mock.calls.at(-1)?.[1];
    expect(request?.body.currentDate).toBe("2026-02-13");
    expect(request?.body.parsedInput.scheduledDate).toBe("2026-02-14");
    expect(request?.body.plannerContext.scheduleInsights.selectedDate).toBe(
      "2026-02-13",
    );
  });

  it("does not derive typed week as a launcher but still derives tomorrow planning", async () => {
    mocks.invoke.mockResolvedValue({
      data: {
        mode: "schedule_read",
        reply: "Planner read.",
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
          pendingStarterIntent: null,
          lastClassification: "quest",
        },
      },
      error: null,
    });
    const { result } = renderHook(() =>
      useCompanionPlanner({ bootstrapGreeting: false })
    );

    await act(async () => {
      await result.current.submitMessage("Plan my week", "text");
    });
    await act(async () => {
      await result.current.submitMessage("Prepare me for tomorrow", "text");
    });

    expect(
      mocks.invoke.mock.calls[0]?.[1]?.body.plannerContext.starterIntent,
    ).toBe("general");
    expect(
      mocks.invoke.mock.calls[1]?.[1]?.body.plannerContext.starterIntent,
    ).toBe("briefing_followup");
  });

  it("answers typed coming-up prompts with the local schedule digest", async () => {
    const { result } = renderHook(() =>
      useCompanionPlanner({ bootstrapGreeting: false })
    );

    await act(async () => {
      await result.current.submitMessage("What do I have coming up?", "text");
    });
    await act(async () => {
      await result.current.submitMessage("What do I hgave coming up?", "text");
    });

    expect(mocks.invoke).not.toHaveBeenCalled();
    expect(mocks.classify).not.toHaveBeenCalled();
    expect(result.current.messages.at(-1)?.content).toBe(
      "Today: nothing scheduled.\nTomorrow: nothing scheduled.",
    );
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

  it("uses local planner context without Outlook sync preflight", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-19T09:30:00.000Z"));
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

    const request = mocks.invoke.mock.calls.at(-1)?.[1];
    expect(request?.body.plannerContext.inboxTasks).toEqual([]);
    expect(request?.body.plannerContext.calendarEvents).toEqual([]);
  });

  it("does not wait on Outlook sync before submitting planner requests", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-19T09:30:00.000Z"));
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

    const request = mocks.invoke.mock.calls.at(-1)?.[1];
    expect(request?.body.plannerContext.inboxTasks).toEqual([]);
    expect(request?.body.plannerContext.calendarEvents).toEqual([]);
  });

  it("keeps planner campaign context limited to currently active campaigns", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-19T09:30:00.000Z"));
    const activeCampaign = {
      id: "epic-active",
      user_id: "user-1",
      title: "Active Campaign",
      description: null,
      status: "active",
      progress_percentage: 25,
      target_days: 30,
      start_date: "2026-04-01",
      end_date: "2026-05-01",
      created_at: "2026-04-01T00:00:00.000Z",
      epic_habits: [
        {
          habit_id: "habit-active",
          habits: {
            id: "habit-active",
            title: "Active ritual",
            difficulty: "medium",
            frequency: "daily",
            preferred_time: "08:00",
            estimated_minutes: 15,
          },
        },
      ],
    };
    const staleRitual = {
      id: "stale-ritual",
      task_text: "Old campaign ritual",
      task_date: "2026-04-19",
      category: null,
      difficulty: "easy",
      priority: null,
      flexibility: null,
      energy_type: null,
      must_calendar_block: false,
      deadline_at: null,
      completed: false,
      scheduled_time: "07:00",
      completed_at: null,
      estimated_duration: 15,
      actual_time_spent: null,
      notes: null,
      recurrence_pattern: null,
      recurrence_end_date: null,
      source: "habit",
      contact_id: null,
      habit_source_id: "habit-stale",
      epic_id: "epic-deleted",
      epic_title: "Deleted Campaign",
      subtasks: [],
    };
    const staleQuest = {
      ...staleRitual,
      id: "stale-quest",
      task_text: "Leftover campaign quest",
      difficulty: "medium",
      priority: "high",
      scheduled_time: "10:00",
      estimated_duration: 30,
      source: "manual",
      habit_source_id: null,
    };
    const activeRitual = {
      ...staleRitual,
      id: "active-ritual-task",
      task_text: "Active campaign ritual",
      habit_source_id: "habit-active",
      epic_id: "epic-active",
      epic_title: "Active Campaign",
    };
    const staleActiveDeletedRitual = {
      ...staleRitual,
      id: "stale-active-deleted-ritual",
      task_text: "Daily Hydration",
      habit_source_id: "habit-deleted",
      epic_id: "epic-active",
      epic_title: "Active Campaign",
    };
    mocks.activeEpics = [activeCampaign];
    mocks.todayTasks = [
      staleRitual,
      staleQuest,
      activeRitual,
      staleActiveDeletedRitual,
    ];
    mocks.weekTasks = [
      staleRitual,
      staleQuest,
      activeRitual,
      staleActiveDeletedRitual,
    ];
    mocks.invoke.mockResolvedValue({
      data: {
        mode: "schedule_read",
        reply: "Here is the active campaign context.",
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
      await result.current.submitMessage("Plan with my campaigns", "text");
    });

    const request = mocks.invoke.mock.calls[0]?.[1];
    const plannerContext = request?.body.plannerContext;
    expect(plannerContext.tasks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "active-ritual-task",
          epicId: "epic-active",
          epicTitle: "Active Campaign",
        }),
        expect.objectContaining({
          id: "stale-quest",
          epicId: null,
          epicTitle: null,
        }),
      ]),
    );
    expect(plannerContext.tasks).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "stale-ritual" }),
        expect.objectContaining({ id: "stale-active-deleted-ritual" }),
      ]),
    );
    expect(plannerContext.activeEpics).toEqual([
      expect.objectContaining({ id: "epic-active", title: "Active Campaign" }),
    ]);
    expect(plannerContext.rituals).toEqual([
      expect.objectContaining({
        id: "habit-active",
        epicId: "epic-active",
        epicTitle: "Active Campaign",
      }),
    ]);
    expect(plannerContext.priorityScores).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "task:stale-quest",
          epicId: null,
        }),
      ]),
    );
    expect(plannerContext.priorityScores).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "task:stale-ritual" }),
        expect.objectContaining({ id: "task:stale-active-deleted-ritual" }),
        expect.objectContaining({ epicId: "epic-deleted" }),
      ]),
    );
    expect(JSON.stringify(plannerContext)).not.toContain("Daily Hydration");
  });

  it("keeps active standalone rituals in upcoming planner context", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-11T20:00:00-07:00"));
    mocks.habits = [
      {
        id: "habit-standalone",
        user_id: "user-1",
        title: "Mobility reset",
        frequency: "custom",
        custom_days: [2],
        custom_month_days: null,
        difficulty: "easy",
        category: "body",
        is_active: true,
        current_streak: 3,
        longest_streak: 5,
        created_at: "2026-05-01T00:00:00.000Z",
        preferred_time: "08:00",
        estimated_minutes: 20,
      },
      {
        id: "habit-inactive-campaign",
        user_id: "user-1",
        title: "Inactive campaign ritual",
        frequency: "daily",
        custom_days: null,
        custom_month_days: null,
        difficulty: "medium",
        category: "mind",
        is_active: true,
        current_streak: 0,
        longest_streak: 0,
        created_at: "2026-05-01T00:00:00.000Z",
        preferred_time: "09:00",
        estimated_minutes: 15,
      },
    ];
    mocks.epics = [{
      id: "epic-inactive",
      user_id: "user-1",
      title: "Paused Campaign",
      description: null,
      status: "paused",
      progress_percentage: 10,
      target_days: 30,
      start_date: "2026-05-01",
      end_date: null,
      created_at: "2026-05-01T00:00:00.000Z",
      epic_habits: [
        {
          habit_id: "habit-inactive-campaign",
          habits: {
            id: "habit-inactive-campaign",
            title: "Inactive campaign ritual",
            difficulty: "medium",
            frequency: "daily",
            preferred_time: "09:00",
            estimated_minutes: 15,
          },
        },
      ],
    }];
    mocks.activeEpics = [];
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-13T14:00:00.000Z"));

    const { result } = renderHook(() =>
      useCompanionPlanner({ bootstrapGreeting: false })
    );

    await act(async () => {
      await result.current.submitMessage("What do I have coming up?", "text");
    });

    expect(mocks.invoke).not.toHaveBeenCalled();
    expect(result.current.structuredResponse?.comingUp?.remainingToday).toEqual([
      expect.objectContaining({
        id: "ritual:habit-standalone:2026-05-13",
        title: "Mobility reset",
        source: "ritual",
      }),
    ]);
    expect(result.current.structuredResponse?.comingUp?.remainingToday).not
      .toEqual(
        expect.arrayContaining([
          expect.objectContaining({ title: "Inactive campaign ritual" }),
        ]),
      );
  });

  it("marks queued campaign ritual creates as pending local habits", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-19T14:30:00.000Z"));
    mocks.activeEpics = [{
      id: "epic-active",
      user_id: "user-1",
      title: "Active Campaign",
      description: null,
      status: "active",
      progress_percentage: 25,
      target_days: 30,
      start_date: "2026-04-01",
      end_date: "2026-05-01",
      created_at: "2026-04-01T00:00:00.000Z",
      epic_habits: [
        {
          habit_id: "habit-pending-ritual",
          habits: {
            id: "habit-pending-ritual",
            title: "Pending ritual",
            difficulty: "medium",
            frequency: "daily",
            preferred_time: "08:00",
            estimated_minutes: 15,
          },
        },
      ],
    }];
    mocks.todayTasks = [{
      id: "task-pending-ritual",
      task_text: "Pending ritual",
      task_date: "2026-04-19",
      completed: false,
      completed_at: null,
      scheduled_time: "08:00",
      estimated_duration: 15,
      habit_source_id: "habit-pending-ritual",
      epic_id: "epic-active",
      epic_title: "Active Campaign",
      subtasks: [],
    }];
    mocks.weekTasks = [...mocks.todayTasks];
    mocks.queuedReceipts = [{
      id: "queue-ritual",
      actionKind: "EPIC_RITUAL_CREATE",
      entityType: "epic",
      entityId: "epic-active",
      status: "queued",
      payload: {
        habit: { id: "habit-pending-ritual" },
      },
    }];
    const { result } = renderHook(() =>
      useCompanionPlanner({ bootstrapGreeting: false })
    );

    await act(async () => {
      await result.current.submitMessage("What do I have coming up?", "text");
    });

    expect(mocks.invoke).not.toHaveBeenCalled();
    expect(result.current.structuredResponse?.comingUp?.remainingToday).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          title: "Pending ritual",
          source: "task",
        }),
      ]),
    );
  });

  it("uses a local read-only coming-up digest without calling the backend", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-12T20:52:00.000Z"));
    const todayTask = {
      id: "task-late-planning",
      task_text: "Late planning quest",
      task_date: "2026-05-12",
      completed: false,
      completed_at: null,
      scheduled_time: "23:00",
      estimated_duration: 20,
      recurrence_pattern: null,
      subtasks: [],
    };
    const tomorrowTask = {
      id: "task-tomorrow-prep",
      task_text: "Tomorrow prep",
      task_date: "2026-05-13",
      completed: false,
      completed_at: null,
      scheduled_time: "09:30",
      estimated_duration: 30,
      recurrence_pattern: null,
      subtasks: [],
    };
    mocks.todayTasks = [todayTask];
    mocks.weekTasks = [todayTask, tomorrowTask];
    const { result } = renderHook(() =>
      useCompanionPlanner({ bootstrapGreeting: false })
    );

    await act(async () => {
      await result.current.submitMessage("What do I have coming up?", "text");
    });

    expect(mocks.toastError).not.toHaveBeenCalled();
    expect(mocks.invoke).not.toHaveBeenCalled();
    expect(result.current.messages.at(-1)?.content).toContain("Today:");
    expect(result.current.structuredResponse?.comingUp?.remainingToday).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ title: "Late planning quest" }),
      ]),
    );
    expect(result.current.structuredResponse?.comingUp?.tomorrowSchedule)
      .toEqual(
        expect.arrayContaining([
          expect.objectContaining({ title: "Tomorrow prep" }),
        ]),
      );
  });

  it("does not mark selected future-date coming-up rows as missed in the local fallback", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-12T20:52:00.000Z"));
    const futureTask = {
      id: "task-future-cardio",
      task_text: "Daily Cardio",
      task_date: "2026-05-13",
      completed: false,
      completed_at: null,
      scheduled_time: "06:00",
      estimated_duration: 30,
      recurrence_pattern: null,
      subtasks: [],
    };
    mocks.todayTasks = [];
    mocks.weekTasks = [futureTask];
    const { result } = renderHook(() =>
      useCompanionPlanner({ bootstrapGreeting: false })
    );

    await act(async () => {
      await result.current.submitMessage("What do I have coming up?", "text", {
        selectedDate: "2026-05-13",
      });
    });

    expect(result.current.structuredResponse?.comingUp?.remainingToday)
      .toEqual([
        expect.objectContaining({ title: "Daily Cardio" }),
      ]);
    expect(result.current.structuredResponse?.comingUp?.missedItems).toEqual(
      [],
    );
  });

  it("keeps in-progress coming-up rows out of missed in the local fallback", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-12T20:15:00.000Z"));
    const currentTask = {
      id: "task-current-cardio",
      task_text: "Daily Cardio",
      task_date: "2026-05-12",
      completed: false,
      completed_at: null,
      scheduled_time: "13:00",
      estimated_duration: 30,
      recurrence_pattern: null,
      subtasks: [],
    };
    mocks.todayTasks = [currentTask];
    mocks.weekTasks = [currentTask];
    const { result } = renderHook(() =>
      useCompanionPlanner({ bootstrapGreeting: false })
    );

    await act(async () => {
      await result.current.submitMessage("What do I have coming up?", "text");
    });

    expect(result.current.structuredResponse?.comingUp?.remainingToday)
      .toEqual([
        expect.objectContaining({ title: "Daily Cardio" }),
      ]);
    expect(result.current.structuredResponse?.comingUp?.missedItems).toEqual(
      [],
    );
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
    expect(mocks.invoke).not.toHaveBeenCalled();
    expect(result.current.messages.at(-1)?.content).toBe(
      "Today: nothing scheduled.\nTomorrow: nothing scheduled.",
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
          "I can talk through this quest idea for today at 5:00 pm.",
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

  it("keeps confirmed quest creations local until the user sends them", async () => {
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

    expect(mocks.addTask).toHaveBeenCalledWith(expect.objectContaining({
      taskText: "Deep Work Block",
      taskDate: "2026-04-19",
      scheduledTime: "09:00",
    }));
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

    const savedListener = vi.fn();
    window.addEventListener("companion-plan-my-day-action-saved", savedListener);

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
    expect(savedListener).toHaveBeenCalledTimes(1);
    window.removeEventListener("companion-plan-my-day-action-saved", savedListener);
  });
});
