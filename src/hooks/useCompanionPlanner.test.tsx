import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  externalCalendarHorizons: [] as string[],
}));

vi.mock("@tanstack/react-query", () => ({
  useQuery: () => ({
    data: null,
    isLoading: false,
  }),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {},
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
    classify: vi.fn(),
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
    trackInteraction: vi.fn(),
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
    error: vi.fn(),
  },
}));

import { useCompanionPlanner } from "./useCompanionPlanner";

describe("useCompanionPlanner", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.externalCalendarHorizons.length = 0;
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
});
