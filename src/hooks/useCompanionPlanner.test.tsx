import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  calendarItemHorizons: [] as string[],
  classify: vi.fn(),
  invoke: vi.fn(),
  upsertPlannerPreferences: vi.fn(),
  useQuests: vi.fn(),
  useCalendarTasks: vi.fn(),
  useCalendarItems: vi.fn(),
  useInboxTasks: vi.fn(),
  useJournalEntries: vi.fn(),
  useCampaigns: vi.fn(),
  useQuestCalendarSync: vi.fn(),
  useUserAIContext: vi.fn(),
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
    from: () => ({
      upsert: (...args: unknown[]) => mocks.upsertPlannerPreferences(...args),
    }),
  },
}));

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({
    user: mocks.user,
  }),
}));

vi.mock("@/hooks/useCompanion", () => ({
  useCompanion: () => ({
    companion: null,
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

vi.mock("@/hooks/useQuests", () => ({
  useQuests: (...args: unknown[]) => mocks.useQuests(...args),
}));

vi.mock("@/hooks/useCalendarTasks", () => ({
  useCalendarTasks: (...args: unknown[]) => mocks.useCalendarTasks(...args),
}));

vi.mock("@/hooks/useCalendarItems", () => ({
  useCalendarItems: (_date: Date, horizon: string, options?: unknown) => {
    mocks.calendarItemHorizons.push(horizon);
    return mocks.useCalendarItems(_date, horizon, options);
  },
}));

vi.mock("@/hooks/useInboxTasks", () => ({
  useInboxTasks: (...args: unknown[]) => mocks.useInboxTasks(...args),
}));

vi.mock("@/hooks/useJournalEntries", () => ({
  useJournalEntries: (...args: unknown[]) => mocks.useJournalEntries(...args),
}));

vi.mock("@/hooks/useCampaigns", () => ({
  useCampaigns: (...args: unknown[]) => mocks.useCampaigns(...args),
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
  useQuestCalendarSync: (...args: unknown[]) => mocks.useQuestCalendarSync(...args),
}));

vi.mock("@/hooks/useUserAIContext", () => ({
  useUserAIContext: (...args: unknown[]) => mocks.useUserAIContext(...args),
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
    mocks.calendarItemHorizons.length = 0;
    mocks.classify.mockResolvedValue(null);
    mocks.user = { id: "user-1" };
    mocks.upsertPlannerPreferences.mockResolvedValue({ error: null });
    mocks.useQuests.mockReturnValue({
      quests: [],
      isLoading: false,
    });
    mocks.useCalendarTasks.mockReturnValue({
      tasks: [],
      isLoading: false,
    });
    mocks.useCalendarItems.mockReturnValue({
      items: [],
      isLoading: false,
    });
    mocks.useInboxTasks.mockReturnValue({
      inboxTasks: [],
    });
    mocks.useJournalEntries.mockReturnValue({
      entries: [],
      isLoading: false,
      error: null,
    });
    mocks.useCampaigns.mockReturnValue({
      activeCampaigns: [],
      createCampaign: vi.fn(),
      renameCampaign: vi.fn(),
      createCampaignRitual: vi.fn(),
    });
    mocks.addTask.mockResolvedValue(undefined);
    mocks.updateTask.mockResolvedValue(undefined);
    mocks.applySubtaskTitlePlan.mockResolvedValue([]);
    mocks.retryNow.mockResolvedValue(undefined);
    mocks.queueAction.mockResolvedValue(undefined);
    mocks.trackTaskCreation.mockResolvedValue(undefined);
    mocks.trackScheduleModification.mockResolvedValue(undefined);
    mocks.sendTaskToCalendar.mockResolvedValue(undefined);
    mocks.syncPlanningContext.mockResolvedValue(null);
    mocks.useQuestCalendarSync.mockReturnValue({
      sendTaskToCalendar: {
        mutateAsync: (...args: unknown[]) => mocks.sendTaskToCalendar(...args),
      },
      syncPlanningContext: {
        mutateAsync: (...args: unknown[]) => mocks.syncPlanningContext(...args),
      },
    });
    mocks.useCalendarIntegrations.mockReturnValue({
      connectedByProvider: {},
      defaultProvider: null,
    });
    mocks.enrichedContext = null;
    mocks.useUserAIContext.mockImplementation(() => ({
      enrichedContext: mocks.enrichedContext,
    }));
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
      useCompanionPlanner()
    );

    expect(result.current.horizon).toBe("day");
    expect(result.current.legacyExecution.compatibilityOnly).toBe(true);
    expect(result.current.legacyExecution.enabled).toBe(false);
    expect(result.current.legacyExecution.disabledReason).toContain(
      "compatibility-only",
    );
    expect(result.current.legacyExecution.supportedProposalKinds).toContain(
      "create_quest",
    );
    expect(mocks.calendarItemHorizons).toEqual(["day", "week"]);
  });

  it("reads day planner context through canonical campaign, quest, journal, and calendar wrappers", () => {
    renderHook(() => useCompanionPlanner());

    expect(mocks.useCampaigns).toHaveBeenCalledWith({ enabled: true });
    expect(mocks.useQuests).toHaveBeenCalledWith(expect.any(Date), {
      enabled: true,
    });
    expect(mocks.useCalendarItems).toHaveBeenNthCalledWith(
      1,
      expect.any(Date),
      "day",
      { enabled: true, includeQuests: false },
    );
    expect(mocks.useCalendarItems).toHaveBeenNthCalledWith(
      2,
      expect.any(Date),
      "week",
      { enabled: true, includeQuests: false },
    );
    expect(mocks.useJournalEntries).toHaveBeenCalledWith({
      enabled: true,
      entryTypes: ["daily_check_in", "evening_reflection"],
      checkInType: "morning",
      limit: 5,
    });
  });

  it("disables planner read hooks when the legacy path is inactive", () => {
    renderHook(() => useCompanionPlanner({ enabled: false }));

    expect(mocks.useQuests).toHaveBeenCalledWith(expect.any(Date), {
      enabled: false,
    });
    expect(mocks.useCalendarTasks).toHaveBeenNthCalledWith(
      1,
      expect.any(Date),
      "week",
      { enabled: false },
    );
    expect(mocks.useCalendarTasks).toHaveBeenNthCalledWith(
      2,
      expect.any(Date),
      "month",
      { enabled: false },
    );
    expect(mocks.useCalendarItems).toHaveBeenNthCalledWith(
      1,
      expect.any(Date),
      "day",
      { enabled: false, includeQuests: false },
    );
    expect(mocks.useCalendarItems).toHaveBeenNthCalledWith(
      2,
      expect.any(Date),
      "week",
      { enabled: false, includeQuests: false },
    );
    expect(mocks.useInboxTasks).toHaveBeenCalledWith({ enabled: false });
    expect(mocks.useCampaigns).toHaveBeenCalledWith({ enabled: false });
    expect(mocks.useCalendarIntegrations).toHaveBeenCalledWith({
      enabled: false,
    });
    expect(mocks.useQuestCalendarSync).toHaveBeenCalledWith({
      enabled: false,
    });
    expect(mocks.useUserAIContext).toHaveBeenCalledWith({ enabled: false });
    expect(mocks.useJournalEntries).toHaveBeenCalledWith({
      enabled: false,
      entryTypes: ["daily_check_in", "evening_reflection"],
      checkInType: "morning",
      limit: 5,
    });
  });

  it("clears local planner state when disabled", async () => {
    const { result, rerender } = renderHook(
      ({ enabled }) => useCompanionPlanner({ enabled }),
      {
        initialProps: { enabled: true },
      },
    );

    act(() => {
      result.current.setHorizon("week");
      result.current.primeQuestCapture();
      result.current.setDraftInput("Old draft");
    });

    expect(result.current.messages).toHaveLength(1);
    expect(result.current.sessionState.pendingStarterIntent).toBe(
      "quest_capture",
    );
    expect(result.current.horizon).toBe("week");

    rerender({ enabled: false });

    await waitFor(() => {
      expect(result.current.messages).toEqual([]);
    });

    expect(result.current.pendingProposals).toEqual([]);
    expect(result.current.questions).toEqual([]);
    expect(result.current.structuredResponse).toBeNull();
    expect(result.current.sessionState.pendingStarterIntent).toBeNull();
    expect(result.current.draftInput).toBe("");
    expect(result.current.horizon).toBe("day");
  });

  it("maps canonical external calendar items into planner context events", async () => {
    mocks.useCalendarItems.mockImplementation((_date: Date, horizon: string) => ({
      items: horizon === "week"
        ? [
          {
            id: "external:event-row-1",
            source: "external_event",
            title: "Strategy block",
            startsAt: "2026-04-22T13:00:00.000Z",
            endsAt: "2026-04-22T14:00:00.000Z",
            isAllDay: false,
            provider: "google",
            readOnly: true,
            questId: null,
            syncMode: null,
            sourceTable: "external_calendar_events",
            externalEventId: "event-row-1",
            connectionId: "connection-1",
            taskDate: null,
            scheduledTime: null,
            estimatedDuration: null,
          },
          {
            id: "quest:task-1",
            source: "quest",
            title: "Ignored quest projection",
            startsAt: "2026-04-22T15:00:00.000Z",
            endsAt: "2026-04-22T15:30:00.000Z",
            isAllDay: false,
            provider: null,
            readOnly: false,
            questId: "task-1",
            syncMode: null,
            sourceTable: "daily_tasks",
            externalEventId: null,
            connectionId: null,
            taskDate: "2026-04-22",
            scheduledTime: "15:00",
            estimatedDuration: 30,
          },
        ]
        : [],
      isLoading: false,
    }));
    mocks.invoke.mockResolvedValue({
      data: {
        mode: "conversational",
        reply: "Here's your plan.",
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
      useCompanionPlanner({ legacyExecutionEnabled: true })
    );

    await act(async () => {
      await result.current.submitMessage("Help me plan today.", "text");
    });

    const request = mocks.invoke.mock.calls.at(-1)?.[1];
    expect(request?.body.plannerContext.calendarEvents).toEqual([
      {
        id: "event-row-1",
        title: "Strategy block",
        start: "2026-04-22T13:00:00.000Z",
        end: "2026-04-22T14:00:00.000Z",
        isAllDay: false,
        provider: "google",
        readOnly: true,
      },
    ]);
  });

  it("starts with an empty transcript by default", async () => {
    const { result } = renderHook(() => useCompanionPlanner());

    await waitFor(() => {
      expect(result.current.messages).toEqual([]);
    });
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
      useCompanionPlanner({ legacyExecutionEnabled: true })
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
      useCompanionPlanner({ legacyExecutionEnabled: true })
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
      useCompanionPlanner({ legacyExecutionEnabled: true })
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
      useCompanionPlanner({ legacyExecutionEnabled: true })
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
      useCompanionPlanner({ legacyExecutionEnabled: true })
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
      useCompanionPlanner({ legacyExecutionEnabled: true })
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
      useCompanionPlanner({ legacyExecutionEnabled: true })
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
      useCompanionPlanner({ legacyExecutionEnabled: true })
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
      useCompanionPlanner({ legacyExecutionEnabled: true })
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
      await result.current.legacyExecution.confirmProposal("proposal-1");
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
      useCompanionPlanner({ legacyExecutionEnabled: true })
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
      await result.current.legacyExecution.confirmProposal("proposal-1");
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
      useCompanionPlanner({ legacyExecutionEnabled: true })
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
      await result.current.legacyExecution.confirmProposal("proposal-1");
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
      useCompanionPlanner({ legacyExecutionEnabled: true })
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
      useCompanionPlanner({ legacyExecutionEnabled: true })
    );

    await act(async () => {
      await result.current.submitMessage("Make me a workout quest", "text");
    });

    expect(result.current.questions).toEqual([]);

    await act(async () => {
      await result.current.legacyExecution.rejectProposal("proposal-1");
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
      useCompanionPlanner({ legacyExecutionEnabled: true })
    );

    await act(async () => {
      await result.current.submitMessage("Make me two movement quests", "text");
    });

    expect(result.current.questions).toEqual([]);

    await act(async () => {
      await result.current.legacyExecution.confirmAll();
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
      useCompanionPlanner({ legacyExecutionEnabled: true })
    );

    await act(async () => {
      await result.current.submitMessage("Block deep work at 9.", "text");
    });

    await waitFor(() => {
      expect(result.current.pendingProposals).toHaveLength(1);
    });

    await act(async () => {
      await result.current.legacyExecution.confirmProposal("proposal-outlook-1");
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
      useCompanionPlanner({ legacyExecutionEnabled: true })
    );

    await act(async () => {
      await result.current.submitMessage("Update my workout quest", "text");
    });

    await waitFor(() => {
      expect(result.current.pendingProposals).toHaveLength(1);
    });

    await act(async () => {
      await result.current.legacyExecution.confirmProposal("proposal-1");
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
      queueAction: mocks.queueAction,
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
      useCompanionPlanner({ legacyExecutionEnabled: true })
    );

    await act(async () => {
      await result.current.submitMessage("Refresh my workout quest", "text");
    });

    await waitFor(() => {
      expect(result.current.pendingProposals).toHaveLength(1);
    });

    await act(async () => {
      await result.current.legacyExecution.confirmProposal("proposal-1");
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

  it("fails loudly when a future planner proposal kind reaches the legacy confirm path", async () => {
    mocks.invoke.mockResolvedValue({
      data: {
        mode: "proposal",
        reply: "I drafted a future proposal.",
        followUpQuestions: [],
        proposals: [
          {
            id: "proposal-1",
            kind: "future_kind",
            title: "Future Proposal",
            summary: "A proposal kind the legacy confirmer does not support.",
            payload: {},
            status: "pending",
            readyToConfirm: true,
            missingFields: [],
          },
        ],
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
      useCompanionPlanner({ legacyExecutionEnabled: true })
    );

    await act(async () => {
      await result.current.submitMessage("Handle a future proposal", "text");
    });

    await waitFor(() => {
      expect(result.current.pendingProposals).toHaveLength(1);
    });

    expect(result.current.pendingProposals[0]?.legacyConfirmationSupported).toBe(
      false,
    );
    expect(
      result.current.pendingProposals[0]?.legacyConfirmationUnsupportedReason,
    ).toContain("future_kind");
    expect(result.current.legacyConfirmation.supportedPendingProposals).toHaveLength(0);
    expect(result.current.legacyConfirmation.activePendingProposal).toBeNull();
    expect(result.current.legacyConfirmation.unsupportedPendingProposalNotice)
      .toEqual({
        id: "proposal-1",
        summary: "A proposal kind the legacy confirmer does not support.",
        detail:
          "This proposed change is visible here, but it can't be confirmed from this screen yet.",
      });

    await act(async () => {
      await result.current.legacyExecution.confirmProposal("proposal-1");
    });

    await waitFor(() => {
      expect(mocks.toastError).toHaveBeenCalledWith(
        "I couldn't save that change yet.",
      );
    });

    expect(result.current.proposals[0]?.status).toBe("pending");
    expect(mocks.addTask).not.toHaveBeenCalled();
    expect(mocks.updateTask).not.toHaveBeenCalled();
  });

  it("only counts and batch-confirms legacy proposals the compatibility executor supports", async () => {
    mocks.invoke.mockResolvedValue({
      data: {
        mode: "proposal",
        reply: "I drafted a couple of next moves.",
        followUpQuestions: [],
        proposals: [
          {
            id: "proposal-unsupported-1",
            kind: "future_kind",
            title: "Future Proposal",
            summary: "Unsupported in the legacy confirmer.",
            payload: {},
            status: "pending",
            readyToConfirm: true,
            missingFields: [],
          },
          {
            id: "proposal-supported-1",
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
      useCompanionPlanner({ legacyExecutionEnabled: true })
    );

    await act(async () => {
      await result.current.submitMessage("Draft two actions", "text");
    });

    await waitFor(() => {
      expect(result.current.pendingProposals).toHaveLength(2);
    });

    expect(result.current.legacyConfirmation.supportedPendingProposals).toHaveLength(1);
    expect(
      result.current.legacyConfirmation.activePendingProposal?.id,
    ).toBe("proposal-supported-1");
    expect(result.current.legacyConfirmation.readySupportedProposalCount).toBe(1);
    expect(result.current.legacyConfirmation.unsupportedPendingProposalNotice)
      .toEqual({
        id: "proposal-unsupported-1",
        summary: "Unsupported in the legacy confirmer.",
        detail:
          "This proposed change is visible here, but it can't be confirmed from this screen yet.",
      });

    await act(async () => {
      await result.current.legacyExecution.confirmAll();
    });

    expect(mocks.addTask).toHaveBeenCalledTimes(1);
    expect(mocks.toastError).not.toHaveBeenCalledWith(
      "I couldn't save that change yet.",
    );
    expect(result.current.proposals.find((proposal) => proposal.id === "proposal-supported-1")?.status)
      .toBe("confirmed");
    expect(result.current.proposals.find((proposal) => proposal.id === "proposal-unsupported-1")?.status)
      .toBe("pending");
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
      useCompanionPlanner({ legacyExecutionEnabled: true })
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
      useCompanionPlanner({ legacyExecutionEnabled: true })
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
      useCompanionPlanner({ legacyExecutionEnabled: true })
    );

    await act(async () => {
      await result.current.submitMessage("Plan my day", "text");
    });

    const request = mocks.invoke.mock.calls[0]?.[1];
    expect(request?.body.plannerContext.aiSignals).toEqual({
      suggestedWorkload: "normal",
    });
  });

  it("keeps plan-day suggestions out of pending confirmation until a suggestion is accepted", async () => {
    mocks.invoke.mockResolvedValue({
      data: {
        mode: "conversational",
        reply: "I found a few clean next moves for the rest of today.",
        followUpQuestions: [],
        proposals: [
          {
            id: "proposal-1",
            kind: "create_quest",
            title: "Create Recovery reset",
            summary: "Create a quest for Recovery reset.",
            reasoning:
              "You missed a couple of earlier blocks, so a reset helps you recover momentum.",
            payload: {
              taskText: "Recovery reset",
              estimatedDuration: 30,
              suggestionSource: "recovery",
              suggestionType: "must",
            },
            status: "suggested",
            readyToConfirm: true,
            missingFields: [],
          },
        ],
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
            message: "I found a few clean next moves for the rest of today.",
            dayAssessment: "behind",
            suggestedQuests: [
              {
                suggestionId: "proposal-1",
                proposalId: "proposal-1",
                title: "Recovery reset",
                type: "must",
                estimatedDuration: "30 min",
                estimatedDurationMinutes: 30,
                source: "recovery",
                reason:
                  "You missed a couple of earlier blocks, so a reset helps you recover momentum.",
              },
            ],
          },
          comingUp: null,
        },
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
      useCompanionPlanner({ legacyExecutionEnabled: true })
    );

    await act(async () => {
      await result.current.submitMessage("Plan my day", "text");
    });

    expect(result.current.pendingProposals).toHaveLength(0);
    expect(result.current.structuredResponse?.planDay?.suggestedQuests).toHaveLength(1);

    await act(async () => {
      await result.current.acceptSuggestedQuest("proposal-1");
    });

    expect(result.current.pendingProposals).toHaveLength(1);

    await act(async () => {
      await result.current.legacyExecution.rejectProposal("proposal-1");
    });

    expect(result.current.pendingProposals).toHaveLength(0);
    expect(result.current.structuredResponse?.planDay?.suggestedQuests[0]?.title).toBe(
      "Recovery reset",
    );
  });

  it("surfaces a typed coming-up summary without creating pending proposals", async () => {
    mocks.invoke.mockResolvedValue({
      data: {
        mode: "schedule_read",
        reply: "Today: Dentist at 3:00 PM; +1 more. Tomorrow: nothing scheduled.",
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
          planDay: null,
          comingUp: {
            message:
              "Today: Dentist at 3:00 PM; +1 more. Tomorrow: nothing scheduled.",
            nextEvent: {
              id: "event-1",
              title: "Dentist",
              label: "Dentist at 3:00 PM",
              startsAt: "2026-04-21T15:00:00-07:00",
              endsAt: "2026-04-21T16:00:00-07:00",
              isAllDay: false,
              source: "calendar",
            },
            remainingToday: [
              {
                id: "event-1",
                title: "Dentist",
                label: "Dentist at 3:00 PM",
                startsAt: "2026-04-21T15:00:00-07:00",
                endsAt: "2026-04-21T16:00:00-07:00",
                isAllDay: false,
                source: "calendar",
              },
            ],
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
          lastClassification: "quest",
        },
      },
      error: null,
    });

    const { result } = renderHook(() => useCompanionPlanner());

    await act(async () => {
      await result.current.submitMessage("What do I have coming up?", "text");
    });

    expect(result.current.pendingProposals).toHaveLength(0);
    expect(result.current.structuredResponse?.comingUp?.nextEvent?.title).toBe(
      "Dentist",
    );
    expect(result.current.structuredResponse?.comingUp?.tomorrowSummary).toBe(
      "open",
    );
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
      useCompanionPlanner({ legacyExecutionEnabled: true })
    );

    await act(async () => {
      await result.current.submitMessage("Write my launch notes", "text");
    });

    await waitFor(() => {
      expect(result.current.pendingProposals).toHaveLength(1);
    });

    await act(async () => {
      await result.current.submitMessage(
        "Help me make room for what matters.",
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
      useCompanionPlanner({ legacyExecutionEnabled: true })
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
      useCompanionPlanner({ legacyExecutionEnabled: true })
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
      useCompanionPlanner({ legacyExecutionEnabled: true })
    );

    await act(async () => {
      await result.current.submitMessage("Make me a workout quest", "text");
    });

    await act(async () => {
      await result.current.legacyExecution.confirmProposal("proposal-1");
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
      useCompanionPlanner({ legacyExecutionEnabled: true })
    );

    await act(async () => {
      await result.current.submitMessage("Make me a workout quest", "text");
    });

    await act(async () => {
      await result.current.legacyExecution.rejectProposal("proposal-1");
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
      useCompanionPlanner({ legacyExecutionEnabled: true })
    );

    await act(async () => {
      await result.current.submitMessage("Make me a workout quest", "text");
    });

    await act(async () => {
      await result.current.legacyExecution.completeProposalEdit("proposal-1", {
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
