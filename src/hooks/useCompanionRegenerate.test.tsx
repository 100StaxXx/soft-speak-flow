import { act, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const fromMock = vi.fn();
  const rpcMock = vi.fn();
  const generateWithValidationMock = vi.fn();
  const toastSuccessMock = vi.fn();
  const toastErrorMock = vi.fn();

  return {
    fromMock,
    rpcMock,
    generateWithValidationMock,
    toastSuccessMock,
    toastErrorMock,
  };
});

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: mocks.fromMock,
    rpc: mocks.rpcMock,
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
    mocks.rpcMock.mockReturnValue({
      single: vi.fn(async () => ({
        data: { image_regenerations_used: 1 },
        error: null,
      })),
    });
    mocks.generateWithValidationMock.mockResolvedValue({
      imageUrl: "https://example.com/new-image.png",
      imageFocalX: 0.52,
      imageFocalY: 0.47,
      validationPassed: true,
      retryCount: 0,
    });
  });

  it("uses the current portrait as identity evidence for regeneration", async () => {
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
        current_image_url: "https://example.com/current-image.png",
      });
    });

    await waitFor(() => {
      expect(mocks.generateWithValidationMock).toHaveBeenCalled();
    });

    expect(mocks.generateWithValidationMock).toHaveBeenCalledWith(
      expect.objectContaining({
        flowType: "regenerate",
        companionId: "companion-1",
        previousStageImageUrl: "https://example.com/current-image.png",
      }),
      expect.objectContaining({
        maxRetries: 1,
      }),
    );
    expect(mocks.rpcMock).toHaveBeenCalledWith("consume_companion_regeneration", {
      p_companion_id: "companion-1",
      p_image_url: "https://example.com/new-image.png",
      p_image_focal_x: 0.52,
      p_image_focal_y: 0.47,
    });
  });
});
