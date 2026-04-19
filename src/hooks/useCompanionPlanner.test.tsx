import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  externalCalendarHorizons: [] as string[],
  classify: vi.fn(),
  invoke: vi.fn(),
  toastError: vi.fn(),
  trackInteraction: vi.fn(),
}));

vi.mock("@tanstack/react-query", () => ({
  useQuery: () => ({
    data: null,
    isLoading: false,
  }),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    functions: {
      invoke: (...args: unknown[]) => mocks.invoke(...args),
    },
  },
}));

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({
    user: null,
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
    addTask: vi.fn(),
    updateTask: vi.fn(),
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
    trackTaskCreation: vi.fn(),
    trackScheduleModification: vi.fn(),
  }),
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
  toast: {
    error: mocks.toastError,
  },
}));

import { useCompanionPlanner } from "./useCompanionPlanner";

describe("useCompanionPlanner", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.externalCalendarHorizons.length = 0;
    mocks.classify.mockResolvedValue(null);
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
});
