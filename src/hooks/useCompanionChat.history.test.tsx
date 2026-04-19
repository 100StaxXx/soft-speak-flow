import type { ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useCompanionChat } from "./useCompanionChat";

const mocks = vi.hoisted(() => ({
  eqCalls: [] as Array<[string, unknown]>,
  toastError: vi.fn(),
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
    voiceStyle: "steady",
  }),
}));

vi.mock("@/hooks/useAIInteractionTracker", () => ({
  useAIInteractionTracker: () => ({
    trackInteraction: vi.fn(),
  }),
}));

vi.mock("@/hooks/useVoiceInput", () => ({
  useVoiceInput: () => ({
    isRecording: false,
    isAutoStopping: false,
    isSupported: true,
    permissionStatus: "prompt" as const,
    toggleRecording: vi.fn(),
    requestPermission: vi.fn().mockResolvedValue("granted"),
  }),
}));

vi.mock("@/services/companionSpeech", () => ({
  speakCompanionReply: vi.fn(),
  stopCompanionSpeech: vi.fn(),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: () => {
      const chain = {
        select: () => chain,
        eq: (column: string, value: unknown) => {
          mocks.eqCalls.push([column, value]);
          return chain;
        },
        order: () => chain,
        limit: async () => ({
          data: [],
          error: null,
        }),
      };

      return chain;
    },
    functions: {
      invoke: vi.fn(),
    },
    auth: {
      getSession: vi.fn().mockResolvedValue({
        data: {
          session: {
            user: { id: "user-1" },
          },
        },
      }),
    },
  },
}));

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

describe("useCompanionChat history filtering", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.eqCalls = [];
  });

  it("filters companion history to the companion chat surface only", async () => {
    const { result } = renderHook(() => useCompanionChat(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.messages[0]?.content).toBe("You made it back.");
    });

    expect(mocks.eqCalls).toContainEqual(["surface", "companion"]);
    expect(mocks.eqCalls).toContainEqual(["source", "chat"]);
  });
});
