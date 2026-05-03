import type { ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useCompanionLauncherImage } from "./useCompanionLauncherImage";

const mocks = vi.hoisted(() => ({
  invoke: vi.fn(),
  loggerWarn: vi.fn(),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    functions: {
      invoke: mocks.invoke,
    },
  },
}));

vi.mock("./useAuth", () => ({
  useAuth: () => ({
    user: { id: "user-1" },
  }),
}));

vi.mock("@/utils/logger", () => ({
  logger: {
    warn: mocks.loggerWarn,
    info: vi.fn(),
    error: vi.fn(),
    scope: vi.fn(() => ({
      warn: mocks.loggerWarn,
      info: vi.fn(),
      error: vi.fn(),
    })),
  },
}));

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
};

describe("useCompanionLauncherImage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.invoke.mockResolvedValue({
      data: null,
      error: new Error("generation unavailable"),
    });
  });

  it("does not immediately retry a failed launcher request for the same source", async () => {
    const { rerender } = renderHook(
      ({ sourceImageUrl }) =>
        useCompanionLauncherImage({
          companionId: "companion-1",
          sourceImageUrl,
          enabled: true,
        }),
      {
        initialProps: {
          sourceImageUrl: "https://assets.example.com/source-a.png",
        },
        wrapper: createWrapper(),
      },
    );

    await waitFor(() => {
      expect(mocks.invoke).toHaveBeenCalledTimes(1);
      expect(mocks.loggerWarn).toHaveBeenCalledTimes(1);
    });

    rerender({ sourceImageUrl: "https://assets.example.com/source-a.png" });
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(mocks.invoke).toHaveBeenCalledTimes(1);

    rerender({ sourceImageUrl: "https://assets.example.com/source-b.png" });

    await waitFor(() => {
      expect(mocks.invoke).toHaveBeenCalledTimes(2);
    });
  });
});
