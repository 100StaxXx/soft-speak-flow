import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  invoke: vi.fn(),
  invalidateQueries: vi.fn(),
  trackInteraction: vi.fn(),
  toggleRecording: vi.fn(),
  requestPermission: vi.fn().mockResolvedValue("granted"),
  speakCompanionReply: vi.fn(),
  stopCompanionSpeech: vi.fn(),
  toastError: vi.fn(),
}));

vi.mock("@tanstack/react-query", () => ({
  useQuery: () => ({
    data: [],
    isSuccess: true,
    isLoading: false,
  }),
  useQueryClient: () => ({
    invalidateQueries: mocks.invalidateQueries,
  }),
}));

vi.mock("@/components/ui/sonner", () => ({
  toast: {
    error: mocks.toastError,
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
    greeting: "You made it back.",
    voiceStyle: "streetwise",
  }),
}));

vi.mock("@/hooks/useAIInteractionTracker", () => ({
  useAIInteractionTracker: () => ({
    trackInteraction: mocks.trackInteraction,
  }),
}));

vi.mock("@/hooks/useVoiceInput", () => ({
  useVoiceInput: () => ({
    isRecording: false,
    isAutoStopping: false,
    isSupported: true,
    permissionStatus: "prompt" as const,
    startRecording: vi.fn(),
    stopRecording: vi.fn(),
    toggleRecording: mocks.toggleRecording,
    requestPermission: mocks.requestPermission,
  }),
}));

vi.mock("@/services/companionSpeech", () => ({
  speakCompanionReply: mocks.speakCompanionReply,
  stopCompanionSpeech: mocks.stopCompanionSpeech,
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    functions: {
      invoke: (...args: unknown[]) => mocks.invoke(...args),
    },
  },
}));

import { useCompanionChat } from "./useCompanionChat";

describe("useCompanionChat", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows a rollout-aware error when the companion chat function is missing", async () => {
    mocks.invoke.mockResolvedValue({
      data: null,
      error: {
        name: "FunctionsHttpError",
        message: "Edge Function returned a non-2xx status code",
        context: new Response("", { status: 404 }),
      },
    });

    const { result } = renderHook(() => useCompanionChat());

    await waitFor(() => {
      expect(result.current.messages[0]?.content).toBe("You made it back.");
    });

    await act(async () => {
      await result.current.submitMessage("Talk to me.", "text");
    });

    await waitFor(() => {
      expect(mocks.toastError).toHaveBeenCalledWith(
        "Companion Talk isn't live in this environment yet. Please try again after the backend is updated.",
      );
    });

    expect(result.current.messages).toHaveLength(3);
  });
});
