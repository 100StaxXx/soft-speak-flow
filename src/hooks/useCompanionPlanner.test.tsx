import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getCompanionPlannerOpener } from "@/shared/companionPlannerCopy";

const mocks = vi.hoisted(() => ({
  externalCalendarHorizons: [] as string[],
  classify: vi.fn(),
  invoke: vi.fn(),
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
      upsert: vi.fn().mockResolvedValue({ error: null }),
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
  useCalendarIntegrations: (...args: unknown[]) => mocks.useCalendarIntegrations(...args),
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
    enrichedContext: null,
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
  applySubtaskTitlePlan: (...args: unknown[]) => mocks.applySubtaskTitlePlan(...args),
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
    const { result } = renderHook(() => useCompanionPlanner({ bootstrapGreeting: false }));

    expect(result.current.horizon).toBe("day");
    expect(mocks.externalCalendarHorizons).toEqual(["day", "week"]);
  });

  it("bootstraps with planner-specific opener copy", async () => {
    const { result } = renderHook(() => useCompanionPlanner());

    await waitFor(() => {
      expect(result.current.messages[0]?.content).toBe(
        getCompanionPlannerOpener({ userId: null }),
      );
    });

    expect(result.current.messages[0]?.content).not.toBe("Let's line things up.");
  });

  it("primes quest capture locally and keeps the planner idle", async () => {
    Object.defineProperty(window, "localStorage", {
      configurable: true,
      writable: true,
      value: {
        getItem: vi.fn(() => JSON.stringify({
          preferredTimeOfDay: "evening",
          preferredTimeReason: "After work I can focus better.",
          reminderPreference: "15 minutes",
        })),
        setItem: vi.fn(),
        removeItem: vi.fn(),
      },
    });

    const { result } = renderHook(() => useCompanionPlanner({ bootstrapGreeting: false }));

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
    expect(result.current.sessionState.pendingStarterIntent).toBe("quest_capture");
    expect(result.current.sessionState.draft.draftKind).toBe("create_quest");
    expect(result.current.sessionState.preferredTimeOfDay).toBe("evening");
    expect(result.current.sessionState.preferredTimeReason).toBe("After work I can focus better.");
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

    const { result } = renderHook(() => useCompanionPlanner({ bootstrapGreeting: false }));

    act(() => {
      result.current.primeQuestCapture();
    });

    await act(async () => {
      await result.current.submitMessage("Write my newsletter tomorrow at 18:00", "text");
    });

    await waitFor(() => {
      expect(result.current.pendingProposals).toHaveLength(1);
    });

    const request = mocks.invoke.mock.calls.at(-1)?.[1];
    expect(request?.body.sessionState.pendingStarterIntent).toBe("quest_capture");
    expect(request?.body.sessionState.draft.draftKind).toBe("create_quest");
    expect(request?.body.conversationHistory).toEqual([
      {
        role: "assistant",
        content: "Quest?",
      },
    ]);
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

    const { result } = renderHook(() => useCompanionPlanner({ bootstrapGreeting: false }));

    await act(async () => {
      await result.current.submitMessage("Help me plan today's quests.", "text");
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
    expect(result.current.messages[1]?.content).not.toContain("lost the thread");
  });

  it("refreshes Outlook planner context before submitting to companion-planner-chat", async () => {
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

    const { result } = renderHook(() => useCompanionPlanner({ bootstrapGreeting: false }));

    await act(async () => {
      await result.current.submitMessage("Plan my day with Outlook in mind.", "text");
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
            summary: "Create a quest for Workout with a short note and 2 subtasks.",
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

    const { result } = renderHook(() => useCompanionPlanner({ bootstrapGreeting: false }));

    await act(async () => {
      await result.current.submitMessage("Set up a workout quest with details", "text");
    });

    await waitFor(() => {
      expect(result.current.pendingProposals).toHaveLength(1);
    });

    await act(async () => {
      await result.current.confirmProposal("proposal-1");
    });

    expect(mocks.addTask).toHaveBeenCalledWith({
      taskText: "Workout",
      difficulty: "medium",
      taskDate: null,
      scheduledTime: null,
      notes: "Upper body focus with 10 minutes of cardio to finish.",
      subtasks: ["Warm up", "Finish with cardio"],
    });
  });

  it("clears lingering planner questions after confirming a ready proposal", async () => {
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

    const { result } = renderHook(() => useCompanionPlanner({ bootstrapGreeting: false }));

    await act(async () => {
      await result.current.submitMessage("Make me a workout quest", "text");
    });

    expect(result.current.questions.map((question) => question.field)).toEqual(["details"]);

    await act(async () => {
      await result.current.confirmProposal("proposal-1");
    });

    expect(result.current.questions).toEqual([]);
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

    const { result } = renderHook(() => useCompanionPlanner({ bootstrapGreeting: false }));

    await act(async () => {
      await result.current.submitMessage("Make me a workout quest", "text");
    });

    expect(result.current.questions.map((question) => question.field)).toEqual(["details"]);

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

    const { result } = renderHook(() => useCompanionPlanner({ bootstrapGreeting: false }));

    await act(async () => {
      await result.current.submitMessage("Make me two movement quests", "text");
    });

    expect(result.current.questions.map((question) => question.field)).toEqual(["details"]);

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

    const { result } = renderHook(() => useCompanionPlanner({ bootstrapGreeting: false }));

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

    const { result } = renderHook(() => useCompanionPlanner({ bootstrapGreeting: false }));

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
      queueAction: mocks.queueAction,
      retryNow: mocks.retryNow,
    });
    expect(mocks.invalidateQueries).toHaveBeenCalledWith({ queryKey: ["subtasks", "task-1"] });
    expect(mocks.invalidateQueries).toHaveBeenCalledWith({ queryKey: ["daily-tasks"] });
    expect(mocks.invalidateQueries).toHaveBeenCalledWith({ queryKey: ["calendar-tasks"] });
    expect(mocks.invalidateQueries).toHaveBeenCalledWith({ queryKey: ["inbox-tasks"] });
  });

  it("keeps the quest update confirmed when subtask writes fail after the main update succeeds", async () => {
    mocks.applySubtaskTitlePlan.mockRejectedValue(new Error("subtask write failed"));
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

    const { result } = renderHook(() => useCompanionPlanner({ bootstrapGreeting: false }));

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

    const { result } = renderHook(() => useCompanionPlanner({ bootstrapGreeting: false }));

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
              reason: "Once you name the goal, I'll look at what's open and shape the plan around it.",
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

    const { result } = renderHook(() => useCompanionPlanner({ bootstrapGreeting: false }));

    await act(async () => {
      await result.current.submitMessage("Write my launch notes", "text");
    });

    await waitFor(() => {
      expect(result.current.pendingProposals).toHaveLength(1);
    });

    await act(async () => {
      await result.current.submitMessage("Help me make room for what matters.", "text");
    });

    await waitFor(() => {
      expect(result.current.pendingProposals).toHaveLength(0);
    });

    expect(result.current.questions.map((question) => question.field)).toEqual(["details"]);
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

    const { result } = renderHook(() => useCompanionPlanner({ bootstrapGreeting: false }));

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
          reply: "That works. We can talk through the tradeoffs before I draft anything else.",
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

    const { result } = renderHook(() => useCompanionPlanner({ bootstrapGreeting: false }));

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
});
