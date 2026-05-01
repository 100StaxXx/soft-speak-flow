import type { ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  user: { id: "user-1" } as { id: string } | null,
  invoke: vi.fn(),
  parseFunctionInvokeError: vi.fn(),
  toUserFacingFunctionError: vi.fn(),
}));

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({ user: mocks.user }),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    functions: {
      invoke: mocks.invoke,
    },
  },
}));

vi.mock("@/utils/supabaseFunctionErrors", () => ({
  parseFunctionInvokeError: mocks.parseFunctionInvokeError,
  toUserFacingFunctionError: mocks.toUserFacingFunctionError,
}));

import { useDailyPlanOptimization } from "./useDailyPlanOptimization";

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

describe("useDailyPlanOptimization", () => {
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    mocks.user = { id: "user-1" };
    mocks.invoke.mockReset();
    mocks.parseFunctionInvokeError.mockReset();
    mocks.toUserFacingFunctionError.mockReset();
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  it("parses optimize-daily-plan invoke failures before exposing query errors", async () => {
    const invokeError = new Error("Edge Function returned a non-2xx status code");
    const parsedError = {
      category: "http",
      isOffline: false,
      backendMessage: "AI service not configured",
    };

    mocks.invoke.mockResolvedValueOnce({ data: null, error: invokeError });
    mocks.parseFunctionInvokeError.mockResolvedValueOnce(parsedError);
    mocks.toUserFacingFunctionError.mockReturnValueOnce("AI service not configured");

    const { result } = renderHook(() => useDailyPlanOptimization(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.error).toBe("AI service not configured");
    });

    expect(mocks.invoke).toHaveBeenCalledWith("optimize-daily-plan");
    expect(mocks.parseFunctionInvokeError).toHaveBeenCalledWith(invokeError);
    expect(mocks.toUserFacingFunctionError).toHaveBeenCalledWith(parsedError, {
      action: "load coach guidance",
    });
  });
});
