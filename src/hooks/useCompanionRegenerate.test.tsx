import { act, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const fromMock = vi.fn();
  const generateWithValidationMock = vi.fn();
  const toastSuccessMock = vi.fn();
  const toastErrorMock = vi.fn();

  return {
    fromMock,
    generateWithValidationMock,
    toastSuccessMock,
    toastErrorMock,
  };
});

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: mocks.fromMock,
  },
}));

vi.mock("./useAuth", () => ({
  useAuth: () => ({
    user: { id: "user-1" },
  }),
}));

vi.mock("sonner", () => ({
  toast: {
    success: mocks.toastSuccessMock,
    error: mocks.toastErrorMock,
  },
}));

vi.mock("@/utils/validateCompanionImage", () => ({
  generateWithValidation: mocks.generateWithValidationMock,
}));

import { useCompanionRegenerate } from "./useCompanionRegenerate";

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

const createUserCompanionBuilder = () => {
  const builder = {
    select: vi.fn(() => builder),
    eq: vi.fn(() => builder),
    maybeSingle: vi.fn(async () => ({
      data: { image_regenerations_used: 0 },
      error: null,
    })),
    update: vi.fn(() => builder),
    single: vi.fn(async () => ({
      data: { image_regenerations_used: 1 },
      error: null,
    })),
  };

  return builder;
};

describe("useCompanionRegenerate", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.fromMock.mockImplementation((table: string) => {
      if (table === "user_companion") {
        return createUserCompanionBuilder();
      }
      throw new Error(`Unexpected table: ${table}`);
    });
    mocks.generateWithValidationMock.mockResolvedValue({
      imageUrl: "https://example.com/new-image.png",
      validationPassed: true,
      retryCount: 0,
    });
  });

  it("uses reduced retry budget and regenerate flow type", async () => {
    const { result } = renderHook(() => useCompanionRegenerate(), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      result.current.regenerate({
        id: "companion-1",
        spirit_animal: "Wolf",
        core_element: "Fire",
        favorite_color: "#FF6B35",
        current_stage: 3,
      });
    });

    await waitFor(() => {
      expect(mocks.generateWithValidationMock).toHaveBeenCalled();
    });

    expect(mocks.generateWithValidationMock).toHaveBeenCalledWith(
      expect.objectContaining({
        flowType: "regenerate",
      }),
      expect.objectContaining({
        maxRetries: 1,
      }),
    );
  });
});
