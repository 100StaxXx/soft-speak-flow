import type { ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  invoke: vi.fn(),
  historyResponse: {
    data: [] as unknown[] | null,
    error: null as unknown,
  },
  trackInteraction: vi.fn(),
  toggleRecording: vi.fn(),
  requestPermission: vi.fn().mockResolvedValue("granted"),
  speakCompanionReply: vi.fn(),
  stopCompanionSpeech: vi.fn(),
  toastError: vi.fn(),
}));

const createHistoryQueryBuilder = () => {
  const builder = {
    select: vi.fn(() => builder),
    eq: vi.fn(() => builder),
    order: vi.fn(() => builder),
    limit: vi.fn(async () => ({
      data: mocks.historyResponse.data,
      error: mocks.historyResponse.error,
    })),
  };

  return builder;
};

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
    from: (table: string) => {
      if (table !== "companion_chats") {
        throw new Error(`Unexpected table ${table}`);
      }

      return createHistoryQueryBuilder();
    },
    functions: {
      invoke: (...args: unknown[]) => mocks.invoke(...args),
    },
  },
}));

import { useCompanionChat } from "./useCompanionChat";

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
};

describe("useCompanionChat", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.historyResponse.data = [];
    mocks.historyResponse.error = null;
    window.localStorage.removeItem?.("companion-chat-voice-settings-v1");
    window.localStorage.removeItem?.("companion-chat-spoken-replies-v1");
  });

  it("seeds the greeting when history bootstrap hits a setup-related schema mismatch", async () => {
    mocks.historyResponse.data = null;
    mocks.historyResponse.error = {
      code: "PGRST204",
      message: "Could not find the 'surface' column of 'companion_chats' in the schema cache",
      details: null,
      hint: null,
    };

    const { result } = renderHook(() => useCompanionChat(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.messages[0]?.content).toBe("You made it back.");
    });

    expect(mocks.toastError).not.toHaveBeenCalled();
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

    const { result } = renderHook(() => useCompanionChat(), {
      wrapper: createWrapper(),
    });

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
