import { act, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const companionFixture = {
  id: "companion-1",
  user_id: "user-1",
  favorite_color: "#00ff88",
  spirit_animal: "Wolf",
  core_element: "Fire",
  current_stage: 0,
  current_xp: 14,
  current_image_url: "https://example.com/stage0.png",
  created_at: "2026-02-19T00:00:00.000Z",
  updated_at: "2026-02-19T00:00:00.000Z",
};

const mocks = vi.hoisted(() => {
  const rpcMock = vi.fn();
  const invokeMock = vi.fn();
  const fromMock = vi.fn();
  const generateWithValidationMock = vi.fn();
  const setIsEvolvingLoadingMock = vi.fn();
  const toastErrorMock = vi.fn();
  const toastSuccessMock = vi.fn();
  const checkCompanionAchievementsMock = vi.fn();
  const loggerWarnMock = vi.fn();
  const loggerLogMock = vi.fn();
  const loggerErrorMock = vi.fn();
  const loggerInfoMock = vi.fn();
  const userCompanionResponses: Array<{ data: unknown; error: unknown }> = [];
  const companionEvolutionResponses: Array<{ data: unknown; error: unknown }> = [];

  return {
    rpcMock,
    invokeMock,
    fromMock,
    generateWithValidationMock,
    setIsEvolvingLoadingMock,
    toastErrorMock,
    toastSuccessMock,
    checkCompanionAchievementsMock,
    loggerWarnMock,
    loggerLogMock,
    loggerErrorMock,
    loggerInfoMock,
    userCompanionResponses,
    companionEvolutionResponses,
  };
});

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    rpc: mocks.rpcMock,
    functions: {
      invoke: mocks.invokeMock,
    },
    from: mocks.fromMock,
  },
}));

vi.mock("./useAuth", () => ({
  useAuth: () => ({
    user: { id: "user-1" },
  }),
}));

vi.mock("./useAchievements", () => ({
  useAchievements: () => ({
    checkCompanionAchievements: mocks.checkCompanionAchievementsMock,
  }),
}));

vi.mock("./useEvolutionThresholds", () => ({
  useEvolutionThresholds: () => ({
    getThreshold: (stage: number) => {
      if (stage === 0) return 0;
      if (stage === 1) return 10;
      return 100;
    },
    shouldEvolve: (currentStage: number, currentXP: number) => {
      if (currentStage === 0) return currentXP >= 10;
      return false;
    },
  }),
}));

vi.mock("@/contexts/EvolutionContext", () => ({
  useEvolution: () => ({
    isEvolvingLoading: false,
    setIsEvolvingLoading: mocks.setIsEvolvingLoadingMock,
  }),
}));

vi.mock("sonner", () => ({
  toast: {
    error: mocks.toastErrorMock,
    success: mocks.toastSuccessMock,
  },
}));

vi.mock("@/utils/logger", () => ({
  logger: {
    warn: mocks.loggerWarnMock,
    log: mocks.loggerLogMock,
    error: mocks.loggerErrorMock,
    info: mocks.loggerInfoMock,
  },
}));

vi.mock("@/utils/validateCompanionImage", () => ({
  generateWithValidation: mocks.generateWithValidationMock,
}));

import { useCompanion } from "./useCompanion";

const createRelayInvokeError = () => ({
  name: "FunctionsRelayError",
  message: "Relay error invoking the edge function",
  context: new Response(
    JSON.stringify({
      error: "temporarily unavailable",
      code: "service_unavailable",
    }),
    {
      status: 503,
      headers: {
        "Content-Type": "application/json",
      },
    },
  ),
});

const createQueryBuilder = (table: string) => {
  const builder = {
    select: vi.fn(() => builder),
    eq: vi.fn(() => builder),
    in: vi.fn(() => builder),
    order: vi.fn(() => builder),
    limit: vi.fn(() => builder),
    maybeSingle: vi.fn(async () => {
      if (table === "user_companion") {
        return mocks.userCompanionResponses.shift() ?? { data: companionFixture, error: null };
      }
      if (table === "companion_evolutions") {
        return mocks.companionEvolutionResponses.shift() ?? { data: { id: "evo-0" }, error: null };
      }

      return { data: null, error: null };
    }),
  };

  return builder;
};

const createWrapper = (queryClient: QueryClient) => {
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
};

const renderUseCompanion = async (queryClient?: QueryClient) => {
  const client =
    queryClient ??
    new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });

  const rendered = renderHook(() => useCompanion(), {
    wrapper: createWrapper(client),
  });

  await waitFor(() => {
    expect(rendered.result.current.companion?.id).toBe(companionFixture.id);
  });

  return { ...rendered, queryClient: client };
};

describe("useCompanion evolveCompanion", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.userCompanionResponses.length = 0;
    mocks.companionEvolutionResponses.length = 0;
    mocks.userCompanionResponses.push({ data: companionFixture, error: null });

    mocks.fromMock.mockImplementation((table: string) => createQueryBuilder(table));
    mocks.rpcMock.mockResolvedValue({ data: null, error: null });
    mocks.invokeMock.mockResolvedValue({ data: null, error: null });
    mocks.generateWithValidationMock.mockResolvedValue({
      imageUrl: "https://example.com/generated-companion.png",
      validationPassed: true,
      retryCount: 0,
    });
  });

  it("calls generate-companion-evolution directly and invalidates companion queries", async () => {
    mocks.invokeMock.mockResolvedValue({
      data: { evolved: true, new_stage: 1 },
      error: null,
    });

    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");
    const { result } = await renderUseCompanion(queryClient);

    let mutationResult: Awaited<ReturnType<typeof result.current.evolveCompanion.mutateAsync>>;
    await act(async () => {
      mutationResult = await result.current.evolveCompanion.mutateAsync({
        newStage: 1,
        currentXP: 14,
      });
    });

    expect(mutationResult!).toEqual({ newStage: 1 });
    expect(mocks.invokeMock).toHaveBeenCalledWith("generate-companion-evolution", { body: {} });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["companion"] });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["companion-stories-all"] });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["evolution-cards"] });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["current-evolution-card"] });
  });

  it("surfaces evolved:false payloads with a clear user message", async () => {
    mocks.invokeMock.mockResolvedValue({
      data: { evolved: false, message: "Not enough XP" },
      error: null,
    });

    const { result } = await renderUseCompanion();

    await act(async () => {
      await expect(
        result.current.evolveCompanion.mutateAsync({
          newStage: 1,
          currentXP: 14,
        }),
      ).rejects.toThrow("Your companion is not ready to evolve yet.");
    });

    expect(mocks.toastErrorMock).toHaveBeenCalledWith("Your companion is not ready to evolve yet.");
    expect(mocks.setIsEvolvingLoadingMock).toHaveBeenCalledWith(false);
  });

  it("retries a transient invoke failure once and then succeeds", async () => {
    mocks.invokeMock
      .mockResolvedValueOnce({
        data: null,
        error: createRelayInvokeError(),
      })
      .mockResolvedValueOnce({
        data: { evolved: true, new_stage: 1 },
        error: null,
      });

    const { result } = await renderUseCompanion();

    await act(async () => {
      await expect(
        result.current.evolveCompanion.mutateAsync({
          newStage: 1,
          currentXP: 14,
        }),
      ).resolves.toEqual({ newStage: 1 });
    });

    const generateInvokeCalls = mocks.invokeMock.mock.calls.filter(
      ([fnName]) => fnName === "generate-companion-evolution",
    );
    expect(generateInvokeCalls).toHaveLength(2);
    expect(mocks.toastErrorMock).not.toHaveBeenCalled();
  });

  it("surfaces a clean error after retryable infrastructure failures are exhausted", async () => {
    mocks.invokeMock.mockResolvedValue({
      data: null,
      error: createRelayInvokeError(),
    });

    const { result } = await renderUseCompanion();

    await act(async () => {
      await expect(
        result.current.evolveCompanion.mutateAsync({
          newStage: 1,
          currentXP: 14,
        }),
      ).rejects.toThrow("Evolution service is temporarily unavailable. Please try again in a minute.");
    });

    const generateInvokeCalls = mocks.invokeMock.mock.calls.filter(
      ([fnName]) => fnName === "generate-companion-evolution",
    );
    expect(generateInvokeCalls).toHaveLength(2);
    expect(mocks.toastErrorMock).toHaveBeenCalledWith(
      "Evolution service is temporarily unavailable. Please try again in a minute.",
    );
  });

  it("suppresses duplicate-click evolution requests while one is in flight", async () => {
    let resolveInvoke: ((value: unknown) => void) | null = null;
    mocks.invokeMock.mockImplementationOnce(
      () => new Promise((resolve) => {
        resolveInvoke = resolve;
      }),
    );

    const { result } = await renderUseCompanion();

    const firstMutation = result.current.evolveCompanion.mutateAsync({
      newStage: 1,
      currentXP: 14,
    });

    const secondMutation = result.current.evolveCompanion.mutateAsync({
      newStage: 1,
      currentXP: 14,
    });

    await waitFor(() => {
      expect(mocks.invokeMock).toHaveBeenCalledTimes(1);
    });

    resolveInvoke?.({
      data: { evolved: true, new_stage: 1 },
      error: null,
    });

    await act(async () => {
      await expect(firstMutation).resolves.toEqual({ newStage: 1 });
      await expect(secondMutation).resolves.toBeNull();
    });

    expect(mocks.invokeMock).toHaveBeenCalledTimes(1);
  });

  it("surfaces a clear error when award_xp_v2 is unavailable", async () => {
    mocks.rpcMock.mockResolvedValue({
      data: null,
      error: {
        code: "42883",
        message: 'function public.award_xp_v2(text, integer, jsonb, text) does not exist',
        details: null,
        hint: null,
      },
    });

    const { result } = await renderUseCompanion();

    await act(async () => {
      await expect(
        result.current.awardXP.mutateAsync({
          eventType: "focus_session",
          xpAmount: 5,
        }),
      ).rejects.toThrow("XP service is temporarily unavailable. Please try again shortly.");
    });

    expect(mocks.toastErrorMock).toHaveBeenCalledWith("XP service is temporarily unavailable. Please try again shortly.");
    expect(mocks.loggerErrorMock).toHaveBeenCalledWith(
      "award_xp_v2 unavailable during XP award",
      expect.objectContaining({
        userId: "user-1",
        eventType: "focus_session",
        error_code: "42883",
      }),
    );
  });

  it("uses onboarding fast retry defaults for companion creation", async () => {
    mocks.rpcMock.mockResolvedValueOnce({
      data: [
        {
          ...companionFixture,
          is_new: true,
        },
      ],
      error: null,
    });

    const { result } = await renderUseCompanion();

    await act(async () => {
      await result.current.createCompanion.mutateAsync({
        favoriteColor: "#FF6B35",
        spiritAnimal: "Wolf",
        coreElement: "Fire",
        storyTone: "epic",
      });
    });

    expect(mocks.generateWithValidationMock).toHaveBeenCalledWith(
      expect.objectContaining({
        flowType: "onboarding",
        stage: 0,
      }),
      expect.objectContaining({
        maxRetries: 0,
      }),
    );
  });
});
