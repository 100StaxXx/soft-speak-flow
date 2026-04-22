import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  submitMessage: vi.fn(),
  invoke: vi.fn(),
  toastError: vi.fn(),
}));

vi.mock("@/components/ui/sonner", () => ({
  toast: {
    error: mocks.toastError,
  },
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    functions: {
      invoke: (...args: unknown[]) => mocks.invoke(...args),
    },
  },
}));

vi.mock("@/hooks/useCompanionPlanner", () => ({
  useCompanionPlanner: () => ({
    currentDate: "2026-04-21",
    todayLabel: "Tuesday, April 21",
    horizon: "day" as const,
    tonePack: "soft" as const,
    sessionState: {
      draft: {},
      openQuestionIds: [],
      preferredTimeOfDay: null,
      preferredTimeReason: null,
      reminderPreference: null,
      pendingStarterIntent: null,
      lastClassification: null,
    },
    plannerContext: {
      tasks: [],
      inboxTasks: [],
      activeEpics: [],
      rituals: [],
      calendarEvents: [],
      scheduleInsights: {
        horizon: "day" as const,
        selectedDate: "2026-04-21",
        dayLoads: [],
        overloadedDates: [],
        emptyDates: ["2026-04-21"],
        conflicts: [],
        suggestedSlots: [],
        moveSuggestions: [],
        summary: "Today is open.",
      },
      plannerMemory: {
        preferredTimeOfDay: null,
        preferredTimeReason: null,
        wakeTime: null,
        windDownTime: null,
      },
    },
  }),
}));

vi.mock("@/hooks/useJourneysCompanionConversation", async () => {
  const React = await import("react");

  return {
    useJourneysCompanionConversation: () => {
      const [messages, setMessages] = React.useState<Array<{
        id: string;
        role: "assistant" | "user";
        content: string;
        createdAt: string;
        inputMode?: "text";
        variant?: "default" | "quest_prompt";
      }>>([]);
      const [draftInput, setDraftInput] = React.useState("");

      const appendMessage = (
        role: "assistant" | "user",
        content: string,
        extras: Record<string, unknown> = {},
      ) => {
        setMessages((previous) => [
          ...previous,
          {
            id: `${role}-${previous.length + 1}`,
            role,
            content,
            createdAt: "2026-04-21T10:00:00.000Z",
            ...extras,
          },
        ]);
      };

      return {
        messages,
        draftInput,
        setDraftInput,
        interimText: "",
        isSubmitting: false,
        pendingPlannerHandoffMessage: null,
        threadPersistenceReady: true,
        threadPersistenceUnavailableReason: null,
        appendLocalMessage: appendMessage,
        clearPlannerHandoff: vi.fn(),
        injectAssistantOpening: (
          content: string,
          extras: Record<string, unknown> = {},
        ) => {
          appendMessage("assistant", content, extras);
          setDraftInput("");
        },
        resetThread: vi.fn(),
        hydrateThread: vi.fn(),
        isRecording: false,
        isAutoStopping: false,
        isVoiceSupported: false,
        permissionStatus: "prompt" as const,
        showPermissionDialog: false,
        setShowPermissionDialog: vi.fn(),
        isRequestingPermission: false,
        toggleRecording: vi.fn(),
        requestMicrophonePermission: vi.fn(),
        submitTypedMessage: vi.fn(),
        submitMessage: (...args: unknown[]) => mocks.submitMessage(...args),
      };
    },
  };
});

import { useJourneysCompanionSurface } from "./useJourneysCompanionSurface";

describe("useJourneysCompanionSurface", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("opens free-talk as an assistant-led waiting state", async () => {
    const onLaunchIntentConsumed = vi.fn();

    const { result } = renderHook(() => useJourneysCompanionSurface({
      launchIntent: {
        id: "launch-free-talk",
        message: "What's good, friend?",
        starterIntent: "free_talk_start",
        target: "conversation",
      },
      onLaunchIntentConsumed,
    }));

    await waitFor(() => {
      expect(result.current.messages).toHaveLength(1);
    });

    expect(result.current.messages[0]).toMatchObject({
      role: "assistant",
      content: "What's good, friend?",
    });
    expect(mocks.invoke).not.toHaveBeenCalled();
    expect(onLaunchIntentConsumed).toHaveBeenCalledWith("launch-free-talk");
  });

  it("opens quest capture as a yellow prompt and waits", async () => {
    const { result } = renderHook(() => useJourneysCompanionSurface({
      launchIntent: {
        id: "launch-quest",
        message: "Quest?",
        starterIntent: "quest_capture",
        target: "conversation",
      },
    }));

    await waitFor(() => {
      expect(result.current.messages).toHaveLength(1);
    });

    expect(result.current.messages[0]).toMatchObject({
      role: "assistant",
      content: "Quest?",
      variant: "quest_prompt",
    });
    expect(mocks.invoke).not.toHaveBeenCalled();
  });

  it("sends typed chat through companion-chat with planner handoff disabled", async () => {
    const { result } = renderHook(() => useJourneysCompanionSurface());

    await act(async () => {
      result.current.setDraftInput("Quest details");
    });

    await act(async () => {
      result.current.submitTypedMessage();
    });

    expect(mocks.submitMessage).toHaveBeenCalledWith("Quest details", "text", expect.objectContaining({
      disablePlannerHandoff: true,
    }));
  });

  it("runs the plan-day starter through companion-planner-chat and appends only the reply text", async () => {
    mocks.invoke.mockResolvedValue({
      data: {
        mode: "conversational",
        reply: "Start with your fixed blocks, then use the open pocket after lunch.",
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
          lastClassification: null,
        },
      },
      error: null,
    });

    const { result } = renderHook(() => useJourneysCompanionSurface({
      launchIntent: {
        id: "launch-plan-day",
        message: "Plan my day",
        starterIntent: "plan_day",
        target: "planner",
      },
    }));

    await waitFor(() => {
      expect(result.current.messages).toHaveLength(2);
    });

    expect(result.current.messages[0]).toMatchObject({
      role: "user",
      content: "Plan my day",
    });
    expect(result.current.messages[1]).toMatchObject({
      role: "assistant",
      content: "Start with your fixed blocks, then use the open pocket after lunch.",
    });
    expect(mocks.invoke).toHaveBeenCalledWith("companion-planner-chat", expect.objectContaining({
      body: expect.objectContaining({
        message: "Plan my day",
        plannerContext: expect.objectContaining({
          starterIntent: "plan_day",
        }),
      }),
    }));
  });

  it("runs the upcoming starter through companion-planner-chat with the upcoming intent", async () => {
    mocks.invoke.mockResolvedValue({
      data: {
        mode: "schedule_read",
        reply: "Today is light, and tomorrow starts with a clean morning block.",
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
          lastClassification: null,
        },
      },
      error: null,
    });

    const { result } = renderHook(() => useJourneysCompanionSurface({
      launchIntent: {
        id: "launch-upcoming",
        message: "What do I have coming up?",
        starterIntent: "upcoming_start",
        target: "planner",
      },
    }));

    await waitFor(() => {
      expect(result.current.messages).toHaveLength(2);
    });

    expect(mocks.invoke).toHaveBeenCalledWith("companion-planner-chat", expect.objectContaining({
      body: expect.objectContaining({
        message: "What do I have coming up?",
        plannerContext: expect.objectContaining({
          starterIntent: "upcoming_start",
        }),
      }),
    }));
    expect(result.current.messages[1]).toMatchObject({
      role: "assistant",
      content: "Today is light, and tomorrow starts with a clean morning block.",
    });
  });
});
