import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
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
});
