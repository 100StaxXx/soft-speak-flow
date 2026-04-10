import { act, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MAX_TOAST_DURATION_MS } from "@/constants/toast";
import { COMPANION_HATCH_STARTED_EVENT } from "@/lib/companionEvolutionEvents";

const companionFixture = {
  id: "companion-1",
  user_id: "user-1",
  favorite_color: "#00ff88",
  spirit_animal: "Wolf",
  core_element: "Fire",
  current_stage: 0,
  current_xp: 14,
  current_image_url: "https://example.com/stage0.png",
  current_image_focal_x: 0.5,
  current_image_focal_y: 0.5,
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
  const userCompanionUpdateResponses: Array<{ data: unknown; error: unknown }> = [];
  const userCompanionUpdatePayloads: Array<Record<string, unknown>> = [];
  const companionEvolutionResponses: Array<{ data: unknown; error: unknown }> = [];
  const companionEvolutionListResponses: Array<{ data: unknown; error: unknown }> = [];

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
    userCompanionUpdateResponses,
    userCompanionUpdatePayloads,
    companionEvolutionResponses,
    companionEvolutionListResponses,
  };
});

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    rpc: mocks.rpcMock,
    functions: {
      invoke: mocks.invokeMock,
    },
    from: mocks.fromMock,
    storage: {
      from: () => ({
        getPublicUrl: (assetPath: string) => ({
          data: { publicUrl: `https://example.com/storage/v1/object/public/companion-presets/${assetPath}` },
        }),
      }),
    },
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
      const thresholds: Record<number, number> = {
        0: 0,
        1: 10,
        2: 30,
        3: 60,
        4: 80,
        5: 100,
      };
      return thresholds[stage] ?? 100;
    },
    shouldEvolve: (currentStage: number, currentXP: number) => {
      const thresholds: Record<number, number> = {
        1: 10,
        2: 30,
        3: 60,
        4: 80,
        5: 100,
      };
      const nextThreshold = thresholds[currentStage + 1];
      return typeof nextThreshold === "number" && currentXP >= nextThreshold;
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
  let isUpdateOperation = false;

  const resolveAwaitResponse = async () => {
    if (table === "companion_evolutions") {
      return mocks.companionEvolutionListResponses.shift() ?? { data: [], error: null };
    }

    if (table === "user_companion") {
      if (isUpdateOperation) {
        return mocks.userCompanionUpdateResponses.shift() ?? { data: null, error: null };
      }
      return mocks.userCompanionResponses.shift() ?? { data: companionFixture, error: null };
    }

    return { data: null, error: null };
  };

  const builder = {
    select: vi.fn(() => builder),
    update: vi.fn((payload: Record<string, unknown>) => {
      isUpdateOperation = true;
      if (table === "user_companion") {
        mocks.userCompanionUpdatePayloads.push(payload);
      }
      return builder;
    }),
    eq: vi.fn(() => builder),
    in: vi.fn(() => builder),
    order: vi.fn(() => builder),
    limit: vi.fn(() => builder),
    single: vi.fn(async () => {
      if (table === "user_companion") {
        return mocks.userCompanionResponses.shift() ?? { data: companionFixture, error: null };
      }

      return { data: null, error: null };
    }),
    maybeSingle: vi.fn(async () => {
      if (table === "user_companion") {
        return mocks.userCompanionResponses.shift() ?? { data: companionFixture, error: null };
      }
      if (table === "companion_evolutions") {
        return mocks.companionEvolutionResponses.shift() ?? { data: { id: "evo-0" }, error: null };
      }

      return { data: null, error: null };
    }),
    then: (onFulfilled: (value: unknown) => unknown, onRejected?: (reason: unknown) => unknown) =>
      resolveAwaitResponse().then(onFulfilled, onRejected),
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
    mocks.userCompanionUpdateResponses.length = 0;
    mocks.userCompanionUpdatePayloads.length = 0;
    mocks.companionEvolutionResponses.length = 0;
    mocks.companionEvolutionListResponses.length = 0;
    mocks.userCompanionResponses.push({ data: companionFixture, error: null });

    mocks.fromMock.mockImplementation((table: string) => createQueryBuilder(table));
    mocks.rpcMock.mockResolvedValue({ data: null, error: null });
    mocks.invokeMock.mockResolvedValue({ data: null, error: null });
    mocks.generateWithValidationMock.mockResolvedValue({
      imageUrl: "https://example.com/generated-companion.png",
      imageFocalX: 0.5,
      imageFocalY: 0.5,
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

    expect(mocks.toastErrorMock).toHaveBeenCalledWith(
      "Your companion is not ready to evolve yet.",
      expect.objectContaining({ duration: MAX_TOAST_DURATION_MS }),
    );
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
      expect.objectContaining({ duration: MAX_TOAST_DURATION_MS }),
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

    expect(mocks.toastErrorMock).toHaveBeenCalledWith(
      "XP service is temporarily unavailable. Please try again shortly.",
      expect.objectContaining({ duration: MAX_TOAST_DURATION_MS }),
    );
    expect(mocks.loggerErrorMock).toHaveBeenCalledWith(
      "award_xp_v2 unavailable during XP award",
      expect.objectContaining({
        userId: "user-1",
        eventType: "focus_session",
        error_code: "42883",
      }),
    );
  });

  it("treats newly earned levels as manual evolution readiness instead of auto-claiming them", async () => {
    mocks.rpcMock.mockResolvedValueOnce({
      data: [
        {
          xp_awarded: 6,
          xp_before: 4,
          xp_after: 10,
          should_evolve: true,
          next_threshold: 10,
          cap_applied: false,
          level_before: 0,
          level_after: 1,
          tier_before: "Egg",
          tier_after: "Hatchling",
          earned_level_after: 1,
          earned_tier_after: "Hatchling",
          claimed_stage_after: 0,
          pending_evolution_count: 1,
        },
      ],
      error: null,
    });

    const { result } = await renderUseCompanion();

    await act(async () => {
      await result.current.awardXP.mutateAsync({
        eventType: "focus_session",
        xpAmount: 6,
      });
    });

    expect(mocks.toastSuccessMock).toHaveBeenCalledWith(
      "Ready to evolve to Stage 1.",
      expect.objectContaining({ duration: MAX_TOAST_DURATION_MS }),
    );
    expect(mocks.checkCompanionAchievementsMock).not.toHaveBeenCalled();
  });

  it("falls back to local evolution history when the repair RPC is unavailable", async () => {
    mocks.userCompanionResponses.length = 0;
    const staleAutoAdvancedCompanion = {
      ...companionFixture,
      current_stage: 5,
      current_xp: 103,
      preset_id: "dragon",
      spirit_animal: "Dragon",
      core_element: "fire",
      current_image_url: "https://example.com/stage-5.png",
      initial_image_url: "https://example.com/egg.png",
    };
    mocks.userCompanionResponses.push(
      { data: staleAutoAdvancedCompanion, error: null },
      { data: staleAutoAdvancedCompanion, error: null },
    );
    mocks.rpcMock.mockResolvedValue({
      data: null,
      error: {
        code: "42883",
        message: "function public.repair_auto_advanced_companion_state(uuid) does not exist",
        details: null,
        hint: null,
      },
    });
    mocks.companionEvolutionListResponses.push({
      data: [
        {
          stage: 0,
          image_url: "https://example.com/egg.png",
          xp_at_evolution: 0,
          evolved_at: "2026-04-09T10:00:00.000Z",
        },
        {
          stage: 1,
          image_url: "https://example.com/stage-1.png",
          xp_at_evolution: 10,
          evolved_at: "2026-04-09T10:05:00.000Z",
        },
      ],
      error: null,
    });
    mocks.companionEvolutionListResponses.push({
      data: [
        {
          stage: 0,
          image_url: "https://example.com/egg.png",
          xp_at_evolution: 0,
          evolved_at: "2026-04-09T10:00:00.000Z",
        },
        {
          stage: 1,
          image_url: "https://example.com/stage-1.png",
          xp_at_evolution: 10,
          evolved_at: "2026-04-09T10:05:00.000Z",
        },
      ],
      error: null,
    });

    const { result } = await renderUseCompanion();

    expect(result.current.companion?.current_stage).toBe(1);
    expect(result.current.companion?.current_image_url).toBe("https://example.com/stage-1.png");
    expect(result.current.nextEvolutionXP).toBe(30);
    expect(result.current.canEvolve).toBe(true);
    expect(mocks.loggerWarnMock).toHaveBeenCalledWith(
      "Applied local companion claim fallback",
      expect.objectContaining({
        companionId: companionFixture.id,
        restoredStage: 1,
        reason: "repair_rpc_failed",
      }),
    );
  });

  it("repairs companions that loaded ahead of their actual evolution history", async () => {
    mocks.userCompanionResponses.length = 0;
    mocks.userCompanionResponses.push(
      {
        data: {
          ...companionFixture,
          current_stage: 1,
          current_xp: 14,
          preset_id: "dragon",
          spirit_animal: "Dragon",
          core_element: "fire",
          current_image_url: "https://example.com/stage-1.png",
        },
        error: null,
      },
      {
        data: {
          ...companionFixture,
          current_stage: 0,
          current_xp: 14,
          preset_id: "dragon",
          spirit_animal: "Dragon",
          core_element: "fire",
          current_image_url: "https://example.com/stage-0.png",
        },
        error: null,
      },
    );
    mocks.rpcMock.mockImplementation(async (fnName: string) => {
      if (fnName === "repair_auto_advanced_companion_state") {
        return {
          data: [
            {
              repaired: true,
              current_stage: 0,
              last_real_stage: 0,
              current_image_url: "https://example.com/stage-0.png",
              current_image_focal_x: 0.5,
              current_image_focal_y: 0.5,
            },
          ],
          error: null,
        };
      }

      return { data: null, error: null };
    });

    const { result } = await renderUseCompanion();

    expect(result.current.companion?.current_stage).toBe(0);
    expect(mocks.rpcMock).toHaveBeenCalledWith(
      "repair_auto_advanced_companion_state",
      { p_companion_id: companionFixture.id },
    );
  });

  it("repairs stale preset-backed positive-stage egg images during fetch", async () => {
    mocks.userCompanionResponses.length = 0;
    mocks.userCompanionResponses.push({
      data: {
        ...companionFixture,
        current_stage: 6,
        current_xp: 2200,
        preset_id: "griffin",
        spirit_animal: "Griffin",
        core_element: "fire",
        current_image_url: "/companion-eggs/egg__t0_egg__normal__fire.png",
      },
      error: null,
    });
    mocks.userCompanionUpdateResponses.push({ data: null, error: null });
    mocks.rpcMock.mockImplementation(async (fnName: string) => {
      if (fnName === "repair_auto_advanced_companion_state") {
        return {
          data: [
            {
              repaired: false,
              current_stage: 6,
              last_real_stage: 6,
              current_image_url: "/companion-eggs/egg__t0_egg__normal__fire.png",
              current_image_focal_x: 0.5,
              current_image_focal_y: 0.5,
            },
          ],
          error: null,
        };
      }

      return { data: null, error: null };
    });

    const { result } = await renderUseCompanion();

    expect(mocks.userCompanionUpdatePayloads).toEqual([
      expect.objectContaining({
        current_image_url:
          "https://example.com/storage/v1/object/public/companion-presets/griffin/t2_guardian/normal/griffin__t2_guardian__normal__fire.png",
      }),
    ]);
    expect(result.current.companion?.current_image_url).toBe(
      "https://example.com/storage/v1/object/public/companion-presets/griffin/t2_guardian/normal/griffin__t2_guardian__normal__fire.png",
    );
  });

  it("does not repair stage 0 egg companions forward", async () => {
    mocks.userCompanionResponses.length = 0;
    mocks.userCompanionResponses.push({
      data: {
        ...companionFixture,
        current_stage: 0,
        current_xp: 0,
        preset_id: "griffin",
        spirit_animal: "Griffin",
        core_element: "fire",
        current_image_url: "/companion-eggs/egg__t0_egg__normal__fire.png",
        initial_image_url: "/companion-eggs/egg__t0_egg__normal__fire.png",
      },
      error: null,
    });

    const { result } = await renderUseCompanion();

    expect(result.current.companion?.current_stage).toBe(0);
    expect(mocks.userCompanionUpdatePayloads).toHaveLength(0);
    expect(mocks.rpcMock).not.toHaveBeenCalledWith(
      "repair_auto_advanced_companion_state",
      expect.anything(),
    );
  });

  it("does not rewrite valid non-egg preset image URLs during fetch repair", async () => {
    mocks.userCompanionResponses.length = 0;
    mocks.userCompanionResponses.push({
      data: {
        ...companionFixture,
        current_stage: 6,
        current_xp: 2200,
        preset_id: "griffin",
        spirit_animal: "Griffin",
        core_element: "fire",
        current_image_url: "https://example.com/existing-stage6.png",
      },
      error: null,
    });
    mocks.rpcMock.mockImplementation(async (fnName: string) => {
      if (fnName === "repair_auto_advanced_companion_state") {
        return {
          data: [
            {
              repaired: false,
              current_stage: 6,
              last_real_stage: 6,
              current_image_url: "https://example.com/existing-stage6.png",
              current_image_focal_x: 0.5,
              current_image_focal_y: 0.5,
            },
          ],
          error: null,
        };
      }

      return { data: null, error: null };
    });

    const { result } = await renderUseCompanion();

    expect(result.current.companion?.current_image_url).toBe("https://example.com/existing-stage6.png");
    expect(mocks.userCompanionUpdatePayloads).toHaveLength(0);
  });

  it("keeps later claimed stages ready without auto-advancing them", async () => {
    mocks.userCompanionResponses.length = 0;
    mocks.userCompanionResponses.push({
      data: {
        ...companionFixture,
        current_stage: 2,
        current_xp: 100,
      },
      error: null,
    });

    const { result } = await renderUseCompanion();

    expect(result.current.nextEvolutionXP).toBe(60);
    expect(result.current.progressToNext).toBe(100);
    expect(result.current.canEvolve).toBe(true);
  });

  it("keeps stage 0 eggs hatch-ready without auto-advancing them", async () => {
    mocks.userCompanionResponses.length = 0;
    mocks.userCompanionResponses.push({
      data: {
        ...companionFixture,
        current_stage: 0,
        current_xp: 14,
        preset_id: "dragon",
        spirit_animal: "Dragon",
        core_element: "fire",
        current_image_url: "/companion-eggs/egg__t0_egg__normal__fire.png",
        initial_image_url: "/companion-eggs/egg__t0_egg__normal__fire.png",
      },
      error: null,
    });

    const { result } = await renderUseCompanion();

    expect(result.current.companion?.current_stage).toBe(0);
    expect(result.current.nextEvolutionXP).toBe(10);
    expect(result.current.progressToNext).toBe(100);
    expect(result.current.canEvolve).toBe(true);
  });

  it("treats the tutorial's 10 XP hatch budget as enough for stage 1 but not stage 2", async () => {
    mocks.userCompanionResponses.length = 0;
    mocks.userCompanionResponses.push({
      data: {
        ...companionFixture,
        current_stage: 0,
        current_xp: 10,
        preset_id: "dragon",
        spirit_animal: "Dragon",
        core_element: "fire",
        current_image_url: "/companion-eggs/egg__t0_egg__normal__fire.png",
        initial_image_url: "/companion-eggs/egg__t0_egg__normal__fire.png",
      },
      error: null,
    });

    const eggState = await renderUseCompanion();

    expect(eggState.result.current.canEvolve).toBe(true);
    expect(eggState.result.current.nextEvolutionXP).toBe(10);

    eggState.unmount();

    mocks.userCompanionResponses.length = 0;
    mocks.userCompanionResponses.push({
      data: {
        ...companionFixture,
        current_stage: 1,
        current_xp: 10,
        preset_id: "dragon",
        spirit_animal: "Dragon",
        core_element: "fire",
        current_image_url: "/companion-presets/dragon/t1_youth/normal/dragon__t1_youth__normal__fire.png",
        initial_image_url: "/companion-eggs/egg__t0_egg__normal__fire.png",
      },
      error: null,
    });

    const hatchlingState = await renderUseCompanion();

    expect(hatchlingState.result.current.companion?.current_stage).toBe(1);
    expect(hatchlingState.result.current.nextEvolutionXP).toBe(30);
    expect(hatchlingState.result.current.canEvolve).toBe(false);
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
        presetId: "wolf",
        favoriteColor: "#FF6B35",
        spiritAnimal: "Wolf",
        coreElement: "Fire",
        storyTone: "epic",
      });
    });

    expect(mocks.generateWithValidationMock).not.toHaveBeenCalled();

    expect(mocks.rpcMock).toHaveBeenCalledWith(
      "create_companion_if_not_exists",
      expect.objectContaining({
        p_eye_color: "",
        p_fur_color: "",
        p_preset_id: "wolf",
        p_current_image_url: "/companion-eggs/egg__t0_egg__normal__fire.png",
        p_current_image_focal_x: 0.508798,
        p_current_image_focal_y: 0.458008,
        p_initial_image_url: "/companion-eggs/egg__t0_egg__normal__fire.png",
        p_initial_image_focal_x: 0.508798,
        p_initial_image_focal_y: 0.458008,
      }),
    );
  });

  it("keeps preset-locked eggs at stage 0 after companion creation", async () => {
    mocks.rpcMock.mockResolvedValueOnce({
      data: [
        {
          ...companionFixture,
          preset_id: "wolf",
          spirit_animal: "Wolf",
          core_element: "fire",
          current_stage: 0,
          current_xp: 0,
          current_image_url: "/companion-eggs/egg__t0_egg__normal__fire.png",
          initial_image_url: "/companion-eggs/egg__t0_egg__normal__fire.png",
          is_new: true,
        },
      ],
      error: null,
    });

    const { result } = await renderUseCompanion();

    let createdCompanion: Awaited<ReturnType<typeof result.current.createCompanion.mutateAsync>>;
    await act(async () => {
      createdCompanion = await result.current.createCompanion.mutateAsync({
        presetId: "wolf",
        favoriteColor: "#FF6B35",
        spiritAnimal: "Wolf",
        coreElement: "fire",
        storyTone: "epic_adventure",
      });
    });

    expect(createdCompanion!).toMatchObject({
      preset_id: "wolf",
      current_stage: 0,
      current_image_url: "/companion-eggs/egg__t0_egg__normal__fire.png",
      initial_image_url: "/companion-eggs/egg__t0_egg__normal__fire.png",
    });
  });

  it("creates an egg-first companion without a preset", async () => {
    mocks.rpcMock.mockResolvedValueOnce({
      data: [
        {
          ...companionFixture,
          preset_id: null,
          spirit_animal: "Egg",
          core_element: "void",
          current_image_url: "/companion-eggs/egg__t0_egg__normal__void.png",
          is_new: false,
        },
      ],
      error: null,
    });

    const { result } = await renderUseCompanion();

    await act(async () => {
      await result.current.createCompanion.mutateAsync({
        presetId: null,
        favoriteColor: "#000000",
        spiritAnimal: "Egg",
        coreElement: "void",
        storyTone: "epic_adventure",
      });
    });

    expect(mocks.rpcMock).toHaveBeenCalledWith(
      "create_companion_if_not_exists",
      expect.objectContaining({
        p_preset_id: null,
        p_spirit_animal: "Egg",
        p_core_element: "void",
        p_current_image_url: "/companion-eggs/egg__t0_egg__normal__void.png",
        p_current_image_focal_x: 0.486804,
        p_current_image_focal_y: 0.429688,
        p_initial_image_url: "/companion-eggs/egg__t0_egg__normal__void.png",
        p_initial_image_focal_x: 0.486804,
        p_initial_image_focal_y: 0.429688,
      }),
    );
  });

  it("retries egg-first creation against the preset-aware legacy RPC signature when focal args are unavailable", async () => {
    mocks.rpcMock
      .mockResolvedValueOnce({
        data: null,
        error: {
          code: "42883",
          message: "Could not find the function public.create_companion_if_not_exists(p_user_id, p_preset_id, p_favorite_color, p_spirit_animal, p_core_element, p_story_tone, p_current_image_url, p_initial_image_url, p_eye_color, p_fur_color) in the schema cache",
          details: null,
          hint: null,
        },
      })
      .mockResolvedValueOnce({
        data: [
          {
            ...companionFixture,
            spirit_animal: "Egg",
            core_element: "void",
            current_image_url: "/companion-eggs/egg__t0_egg__normal__void.png",
            initial_image_url: "/companion-eggs/egg__t0_egg__normal__void.png",
            is_new: true,
          },
        ],
        error: null,
      });

    const { result } = await renderUseCompanion();

    let createdCompanion: Awaited<ReturnType<typeof result.current.createCompanion.mutateAsync>>;
    await act(async () => {
      createdCompanion = await result.current.createCompanion.mutateAsync({
        presetId: null,
        favoriteColor: "#000000",
        spiritAnimal: "Egg",
        coreElement: "void",
        storyTone: "epic_adventure",
      });
    });

    expect(createdCompanion!).toMatchObject({
      id: companionFixture.id,
      preset_id: null,
      spirit_animal: "Egg",
    });
    expect(mocks.rpcMock).toHaveBeenCalledTimes(2);
    expect(mocks.rpcMock).toHaveBeenNthCalledWith(
      1,
      "create_companion_if_not_exists",
      expect.objectContaining({
        p_preset_id: null,
        p_spirit_animal: "Egg",
      }),
    );
    expect(mocks.rpcMock).toHaveBeenNthCalledWith(
      2,
      "create_companion_if_not_exists",
      expect.objectContaining({
        p_preset_id: null,
        p_spirit_animal: "Egg",
      }),
    );
    expect(mocks.rpcMock.mock.calls[1]?.[1]).not.toHaveProperty("p_current_image_focal_x");
    expect(mocks.rpcMock.mock.calls[1]?.[1]).not.toHaveProperty("p_current_image_focal_y");
    expect(mocks.rpcMock.mock.calls[1]?.[1]).not.toHaveProperty("p_initial_image_focal_x");
    expect(mocks.rpcMock.mock.calls[1]?.[1]).not.toHaveProperty("p_initial_image_focal_y");
  });

  it("retries egg-first creation against the pre-preset legacy RPC signature when preset-aware creation is unavailable", async () => {
    mocks.rpcMock
      .mockResolvedValueOnce({
        data: null,
        error: {
          code: "42883",
          message: "Could not find the function public.create_companion_if_not_exists(p_user_id, p_preset_id, p_favorite_color, p_spirit_animal, p_core_element, p_story_tone, p_current_image_url, p_current_image_focal_x, p_current_image_focal_y, p_initial_image_url, p_initial_image_focal_x, p_initial_image_focal_y, p_eye_color, p_fur_color) in the schema cache",
          details: null,
          hint: null,
        },
      })
      .mockResolvedValueOnce({
        data: null,
        error: {
          code: "42883",
          message: "Could not find the function public.create_companion_if_not_exists(p_user_id, p_preset_id, p_favorite_color, p_spirit_animal, p_core_element, p_story_tone, p_current_image_url, p_initial_image_url, p_eye_color, p_fur_color) in the schema cache",
          details: null,
          hint: null,
        },
      })
      .mockResolvedValueOnce({
        data: [
          {
            ...companionFixture,
            spirit_animal: "Egg",
            core_element: "void",
            current_image_url: "/companion-eggs/egg__t0_egg__normal__void.png",
            initial_image_url: "/companion-eggs/egg__t0_egg__normal__void.png",
            is_new: true,
          },
        ],
        error: null,
      });

    const { result } = await renderUseCompanion();

    await act(async () => {
      await expect(
        result.current.createCompanion.mutateAsync({
          presetId: null,
          favoriteColor: "#000000",
          spiritAnimal: "Egg",
          coreElement: "void",
          storyTone: "epic_adventure",
        }),
      ).resolves.toMatchObject({
        id: companionFixture.id,
        preset_id: null,
        spirit_animal: "Egg",
      });
    });

    expect(mocks.rpcMock).toHaveBeenCalledTimes(3);
    expect(mocks.rpcMock.mock.calls[1]?.[1]).toHaveProperty("p_preset_id", null);
    expect(mocks.rpcMock.mock.calls[1]?.[1]).not.toHaveProperty("p_current_image_focal_x");
    expect(mocks.rpcMock.mock.calls[1]?.[1]).not.toHaveProperty("p_current_image_focal_y");
    expect(mocks.rpcMock.mock.calls[1]?.[1]).not.toHaveProperty("p_initial_image_focal_x");
    expect(mocks.rpcMock.mock.calls[1]?.[1]).not.toHaveProperty("p_initial_image_focal_y");
    expect(mocks.rpcMock.mock.calls[2]?.[1]).not.toHaveProperty("p_preset_id");
    expect(mocks.rpcMock.mock.calls[2]?.[1]).not.toHaveProperty("p_current_image_focal_x");
    expect(mocks.rpcMock.mock.calls[2]?.[1]).not.toHaveProperty("p_current_image_focal_y");
    expect(mocks.rpcMock.mock.calls[2]?.[1]).not.toHaveProperty("p_initial_image_focal_x");
    expect(mocks.rpcMock.mock.calls[2]?.[1]).not.toHaveProperty("p_initial_image_focal_y");
  });

  it("retries preset-based creation against the preset-aware legacy RPC signature when focal args are unavailable", async () => {
    mocks.rpcMock
      .mockResolvedValueOnce({
        data: null,
        error: {
          code: "42883",
          message: "Could not find the function public.create_companion_if_not_exists(p_user_id, p_preset_id, p_favorite_color, p_spirit_animal, p_core_element, p_story_tone, p_current_image_url, p_current_image_focal_x, p_current_image_focal_y, p_initial_image_url, p_initial_image_focal_x, p_initial_image_focal_y, p_eye_color, p_fur_color) in the schema cache",
          details: null,
          hint: null,
        },
      })
      .mockResolvedValueOnce({
        data: [
          {
            ...companionFixture,
            preset_id: "wolf",
            spirit_animal: "Wolf",
            core_element: "fire",
            current_image_url: "/companion-eggs/egg__t0_egg__normal__fire.png",
            initial_image_url: "/companion-eggs/egg__t0_egg__normal__fire.png",
            is_new: true,
          },
        ],
        error: null,
      });

    const { result } = await renderUseCompanion();

    await act(async () => {
      await expect(
        result.current.createCompanion.mutateAsync({
          presetId: "wolf",
          favoriteColor: "#FF6B35",
          spiritAnimal: "Wolf",
          coreElement: "fire",
          storyTone: "epic_adventure",
        }),
      ).resolves.toMatchObject({
        id: companionFixture.id,
        preset_id: "wolf",
        spirit_animal: "Wolf",
      });
    });

    expect(mocks.rpcMock).toHaveBeenCalledTimes(2);
    expect(mocks.rpcMock.mock.calls[1]?.[1]).toHaveProperty("p_preset_id", "wolf");
    expect(mocks.rpcMock.mock.calls[1]?.[1]).not.toHaveProperty("p_current_image_focal_x");
    expect(mocks.rpcMock.mock.calls[1]?.[1]).not.toHaveProperty("p_current_image_focal_y");
    expect(mocks.rpcMock.mock.calls[1]?.[1]).not.toHaveProperty("p_initial_image_focal_x");
    expect(mocks.rpcMock.mock.calls[1]?.[1]).not.toHaveProperty("p_initial_image_focal_y");
  });

  it("does not retry preset-based creation against the pre-preset legacy RPC signature", async () => {
    mocks.rpcMock
      .mockResolvedValueOnce({
        data: null,
        error: {
          code: "42883",
          message: "Could not find the function public.create_companion_if_not_exists(p_user_id, p_preset_id, p_favorite_color, p_spirit_animal, p_core_element, p_story_tone, p_current_image_url, p_current_image_focal_x, p_current_image_focal_y, p_initial_image_url, p_initial_image_focal_x, p_initial_image_focal_y, p_eye_color, p_fur_color) in the schema cache",
          details: null,
          hint: null,
        },
      })
      .mockResolvedValueOnce({
        data: null,
        error: {
          code: "42883",
          message: "Could not find the function public.create_companion_if_not_exists(p_user_id, p_preset_id, p_favorite_color, p_spirit_animal, p_core_element, p_story_tone, p_current_image_url, p_initial_image_url, p_eye_color, p_fur_color) in the schema cache",
          details: null,
          hint: null,
        },
      });

    const { result } = await renderUseCompanion();

    await act(async () => {
      await expect(
        result.current.createCompanion.mutateAsync({
          presetId: "wolf",
          favoriteColor: "#FF6B35",
          spiritAnimal: "Wolf",
          coreElement: "fire",
          storyTone: "epic_adventure",
        }),
      ).rejects.toThrow("Companion setup is still syncing. Please try again in a moment.");
    });

    expect(mocks.rpcMock).toHaveBeenCalledTimes(2);
    expect(mocks.rpcMock.mock.calls[1]?.[1]).toHaveProperty("p_preset_id", "wolf");
    expect(mocks.rpcMock.mock.calls[1]?.[1]).not.toHaveProperty("p_current_image_focal_x");
    expect(mocks.rpcMock.mock.calls[1]?.[1]).not.toHaveProperty("p_current_image_focal_y");
    expect(mocks.rpcMock.mock.calls[1]?.[1]).not.toHaveProperty("p_initial_image_focal_x");
    expect(mocks.rpcMock.mock.calls[1]?.[1]).not.toHaveProperty("p_initial_image_focal_y");
  });

  it("does not fail onboarding when stage 0 evolution is not readable yet", async () => {
    mocks.rpcMock.mockResolvedValueOnce({
      data: [
        {
          ...companionFixture,
          preset_id: null,
          spirit_animal: "Egg",
          core_element: "void",
          current_image_url: "/companion-eggs/egg__t0_egg__normal__void.png",
          initial_image_url: "/companion-eggs/egg__t0_egg__normal__void.png",
          is_new: true,
        },
      ],
      error: null,
    });
    mocks.companionEvolutionResponses.push({ data: null, error: null });

    const { result } = await renderUseCompanion();

    let createdCompanion: Awaited<ReturnType<typeof result.current.createCompanion.mutateAsync>>;
    await act(async () => {
      createdCompanion = await result.current.createCompanion.mutateAsync({
        presetId: null,
        favoriteColor: "#000000",
        spiritAnimal: "Egg",
        coreElement: "void",
        storyTone: "epic_adventure",
      });
    });

    expect(createdCompanion!).toMatchObject({
      id: companionFixture.id,
      preset_id: null,
      spirit_animal: "Egg",
    });
    expect(mocks.loggerWarnMock).toHaveBeenCalledWith(
      "Stage 0 evolution missing after companion creation",
      expect.objectContaining({
        companionId: companionFixture.id,
      }),
    );
  });

  it("holds manual evolution until hatch selection is completed", async () => {
    const { result } = await renderUseCompanion();

    expect(result.current.requiresHatchSelection).toBe(true);

    act(() => {
      result.current.triggerManualEvolution();
    });

    expect(mocks.invokeMock).not.toHaveBeenCalledWith("generate-companion-evolution", expect.anything());
    expect(mocks.setIsEvolvingLoadingMock).not.toHaveBeenCalled();
  });

  it("directly hatches preset-backed eggs once they are ready", async () => {
    mocks.userCompanionResponses.length = 0;
    mocks.userCompanionResponses.push(
      {
        data: {
          ...companionFixture,
          preset_id: "dragon",
          spirit_animal: "Dragon",
          core_element: "fire",
          current_image_url: "/companion-eggs/egg__t0_egg__normal__fire.png",
          initial_image_url: "/companion-eggs/egg__t0_egg__normal__fire.png",
        },
        error: null,
      },
      {
        data: {
          ...companionFixture,
          preset_id: "dragon",
          spirit_animal: "Dragon",
          core_element: "fire",
          current_image_url: "/companion-eggs/egg__t0_egg__normal__fire.png",
          initial_image_url: "/companion-eggs/egg__t0_egg__normal__fire.png",
        },
        error: null,
      },
    );
    mocks.rpcMock.mockImplementation(async (fnName: string) => {
      if (fnName === "hatch_companion_with_preset") {
        return {
          data: [
            {
              id: companionFixture.id,
              preset_id: "dragon",
              spirit_animal: "Dragon",
              favorite_color: "#FF6B35",
              core_element: "fire",
              story_tone: "epic_adventure",
              current_stage: 1,
              current_image_url: "/companion-presets/dragon/t1_youth/normal/dragon__t1_youth__normal__fire.png",
              initial_image_url: "/companion-eggs/egg__t0_egg__normal__fire.png",
              evolution_id: "evo-1",
            },
          ],
          error: null,
        };
      }

      return { data: null, error: null };
    });

    const { result } = await renderUseCompanion();

    expect(result.current.requiresHatchSelection).toBe(false);
    expect(result.current.canEvolve).toBe(true);

    act(() => {
      result.current.triggerManualEvolution();
    });

    await waitFor(() => {
      expect(mocks.rpcMock).toHaveBeenCalledWith(
        "hatch_companion_with_preset",
        expect.objectContaining({
          p_companion_id: companionFixture.id,
          p_preset_id: "dragon",
        }),
      );
    });

    expect(mocks.setIsEvolvingLoadingMock).toHaveBeenCalledWith(true);
  });

  it("emits a local hatch-start event before invalidating companion queries", async () => {
    const dispatchSpy = vi.spyOn(window, "dispatchEvent");
    mocks.invokeMock.mockImplementation((fnName: string) => {
      if (fnName === "generate-evolution-card" || fnName === "generate-companion-story") {
        return new Promise(() => {});
      }

      return Promise.resolve({ data: null, error: null });
    });
    mocks.rpcMock.mockResolvedValueOnce({
      data: [
        {
          id: companionFixture.id,
          preset_id: "dragon",
          spirit_animal: "Dragon",
          favorite_color: "#FF6B35",
          core_element: "fire",
          story_tone: "epic_adventure",
          current_stage: 1,
          current_image_url: "/companion-presets/dragon/t1_youth/normal/dragon__t1_youth__normal__fire.png",
          initial_image_url: companionFixture.current_image_url,
          evolution_id: "evo-1",
        },
      ],
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

    await act(async () => {
      await result.current.hatchCompanion.mutateAsync({
        presetId: "dragon",
      });
    });

    const hatchEventIndex = dispatchSpy.mock.calls.findIndex(([event]) =>
      event instanceof CustomEvent && event.type === COMPANION_HATCH_STARTED_EVENT,
    );
    const companionInvalidateIndex = invalidateSpy.mock.calls.findIndex(
      ([options]) => Array.isArray(options.queryKey) && options.queryKey[0] === "companion",
    );

    expect(hatchEventIndex).toBeGreaterThanOrEqual(0);
    expect(companionInvalidateIndex).toBeGreaterThanOrEqual(0);

    const hatchEvent = dispatchSpy.mock.calls[hatchEventIndex]?.[0];
    expect(hatchEvent).toEqual(expect.objectContaining({
      type: COMPANION_HATCH_STARTED_EVENT,
      detail: expect.objectContaining({
        companionId: companionFixture.id,
        previousStage: 0,
        newStage: 1,
        previousImageUrl: companionFixture.current_image_url,
        newImageUrl: "/companion-presets/dragon/t1_youth/normal/dragon__t1_youth__normal__fire.png",
        element: "fire",
      }),
    }));

    expect(dispatchSpy.mock.invocationCallOrder[hatchEventIndex]).toBeLessThan(
      invalidateSpy.mock.invocationCallOrder[companionInvalidateIndex],
    );
  });

  it("re-syncs stale stage 1 cache back to a hatchable egg before triggering the first hatch", async () => {
    mocks.userCompanionResponses.length = 0;
    mocks.userCompanionResponses.push(
      {
        data: {
          ...companionFixture,
          current_stage: 1,
          current_xp: 14,
          preset_id: "dragon",
          spirit_animal: "Dragon",
          current_image_url: "/companion-presets/dragon/t1_youth/normal/dragon__t1_youth__normal__fire.png",
        },
        error: null,
      },
      {
        data: {
          ...companionFixture,
          current_stage: 0,
          current_xp: 14,
          preset_id: "dragon",
          spirit_animal: "Dragon",
          current_image_url: "/companion-eggs/egg__t0_egg__normal__fire.png",
          initial_image_url: "/companion-eggs/egg__t0_egg__normal__fire.png",
        },
        error: null,
      },
    );
    mocks.rpcMock.mockImplementation(async (fnName: string) => {
      if (fnName === "repair_auto_advanced_companion_state") {
        return {
          data: [
            {
              repaired: false,
              current_stage: 1,
              last_real_stage: 1,
              current_image_url: "/companion-presets/dragon/t1_youth/normal/dragon__t1_youth__normal__fire.png",
              current_image_focal_x: null,
              current_image_focal_y: null,
            },
          ],
          error: null,
        };
      }

      if (fnName === "hatch_companion_with_preset") {
        return {
          data: [
            {
              id: companionFixture.id,
              preset_id: "dragon",
              spirit_animal: "Dragon",
              favorite_color: "#FF6B35",
              core_element: "fire",
              story_tone: "epic_adventure",
              current_stage: 1,
              current_image_url: "/companion-presets/dragon/t1_youth/normal/dragon__t1_youth__normal__fire.png",
              initial_image_url: "/companion-eggs/egg__t0_egg__normal__fire.png",
              evolution_id: "evo-1",
            },
          ],
          error: null,
        };
      }

      return { data: null, error: null };
    });

    const { result } = await renderUseCompanion();

    await act(async () => {
      await result.current.triggerManualEvolution();
    });

    await waitFor(() => {
      expect(mocks.rpcMock).toHaveBeenCalledWith(
        "hatch_companion_with_preset",
        expect.objectContaining({
          p_companion_id: companionFixture.id,
          p_preset_id: "dragon",
        }),
      );
    });
  });

  it("treats a freshly synced stage 1 companion as already hatched instead of rehatching", async () => {
    const dispatchSpy = vi.spyOn(window, "dispatchEvent");

    mocks.userCompanionResponses.length = 0;
    mocks.userCompanionResponses.push(
      {
        data: {
          ...companionFixture,
          current_stage: 0,
          current_xp: 14,
          preset_id: "dragon",
          spirit_animal: "Dragon",
          current_image_url: "/companion-eggs/egg__t0_egg__normal__fire.png",
          initial_image_url: "/companion-eggs/egg__t0_egg__normal__fire.png",
        },
        error: null,
      },
      {
        data: {
          ...companionFixture,
          current_stage: 1,
          current_xp: 14,
          preset_id: "dragon",
          spirit_animal: "Dragon",
          current_image_url: "/companion-presets/dragon/t1_youth/normal/dragon__t1_youth__normal__fire.png",
          initial_image_url: "/companion-eggs/egg__t0_egg__normal__fire.png",
        },
        error: null,
      },
    );
    mocks.rpcMock.mockResolvedValueOnce({
      data: [
        {
          repaired: false,
          current_stage: 1,
          last_real_stage: 1,
          current_image_url: "/companion-presets/dragon/t1_youth/normal/dragon__t1_youth__normal__fire.png",
          current_image_focal_x: null,
          current_image_focal_y: null,
        },
      ],
      error: null,
    });

    const { result } = await renderUseCompanion();

    await act(async () => {
      await result.current.triggerManualEvolution();
    });

    expect(mocks.rpcMock).not.toHaveBeenCalledWith(
      "hatch_companion_with_preset",
      expect.anything(),
    );
    expect(mocks.invokeMock).not.toHaveBeenCalledWith(
      "generate-companion-evolution",
      expect.anything(),
    );
    expect(dispatchSpy).toHaveBeenCalledWith(expect.objectContaining({ type: "companion-evolved" }));
  });

  it("starts the hatch animation when the visible egg refreshes to stage 1", async () => {
    const dispatchSpy = vi.spyOn(window, "dispatchEvent");

    mocks.userCompanionResponses.length = 0;
    mocks.userCompanionResponses.push(
      {
        data: {
          ...companionFixture,
          current_stage: 0,
          current_xp: 14,
          preset_id: "dragon",
          spirit_animal: "Dragon",
          current_image_url: "/companion-eggs/egg__t0_egg__normal__fire.png",
          initial_image_url: "/companion-eggs/egg__t0_egg__normal__fire.png",
        },
        error: null,
      },
      {
        data: {
          ...companionFixture,
          current_stage: 1,
          current_xp: 14,
          preset_id: "dragon",
          spirit_animal: "Dragon",
          current_image_url: "/companion-presets/dragon/t1_youth/normal/dragon__t1_youth__normal__fire.png",
          initial_image_url: "/companion-eggs/egg__t0_egg__normal__fire.png",
        },
        error: null,
      },
    );
    mocks.rpcMock.mockResolvedValueOnce({
      data: [
        {
          repaired: false,
          current_stage: 1,
          last_real_stage: 1,
          current_image_url: "/companion-presets/dragon/t1_youth/normal/dragon__t1_youth__normal__fire.png",
          current_image_focal_x: null,
          current_image_focal_y: null,
        },
      ],
      error: null,
    });

    const { result } = await renderUseCompanion();

    await act(async () => {
      await result.current.triggerManualEvolution({
        hatchAnimationSnapshot: {
          previousImageUrl: "/companion-eggs/egg__t0_egg__normal__fire.png",
          element: "fire",
        },
      });
    });

    expect(mocks.rpcMock).not.toHaveBeenCalledWith(
      "hatch_companion_with_preset",
      expect.anything(),
    );
    expect(dispatchSpy).toHaveBeenCalledWith(expect.objectContaining({ type: "evolution-loading-start" }));
    expect(dispatchSpy).toHaveBeenCalledWith(expect.objectContaining({
      type: COMPANION_HATCH_STARTED_EVENT,
      detail: expect.objectContaining({
        companionId: "companion-1",
        previousStage: 0,
        newStage: 1,
        previousImageUrl: "/companion-eggs/egg__t0_egg__normal__fire.png",
        newImageUrl: "/companion-presets/dragon/t1_youth/normal/dragon__t1_youth__normal__fire.png",
        element: "Fire",
      }),
    }));
    expect(dispatchSpy).not.toHaveBeenCalledWith(expect.objectContaining({ type: "companion-evolved" }));
  });

  it("rejects hatch requests that conflict with a preset-locked egg", async () => {
    mocks.userCompanionResponses.length = 0;
    mocks.userCompanionResponses.push({
      data: {
        ...companionFixture,
        preset_id: "dragon",
        spirit_animal: "Dragon",
        core_element: "fire",
      },
      error: null,
    });

    const { result } = await renderUseCompanion();

    await act(async () => {
      await expect(
        result.current.hatchCompanion.mutateAsync({
          presetId: "wolf",
        }),
      ).rejects.toThrow("This egg is already bound to another companion form.");
    });

    expect(mocks.rpcMock).not.toHaveBeenCalledWith(
      "hatch_companion_with_preset",
      expect.anything(),
    );
  });

  it("hatches an egg into the selected preset and preserves the original egg image", async () => {
    mocks.rpcMock.mockResolvedValueOnce({
      data: [
        {
          id: companionFixture.id,
          preset_id: "dragon",
          spirit_animal: "Dragon",
          favorite_color: "#FF6B35",
          core_element: "fire",
          story_tone: "epic_adventure",
          current_stage: 1,
          current_image_url: "/companion-presets/dragon/t1_youth/normal/dragon__t1_youth__normal__fire.png",
          initial_image_url: companionFixture.current_image_url,
          evolution_id: "evo-1",
        },
      ],
      error: null,
    });

    const { result } = await renderUseCompanion();

    await act(async () => {
      await result.current.hatchCompanion.mutateAsync({
        presetId: "dragon",
      });
    });

    expect(mocks.rpcMock).toHaveBeenCalledWith(
      "hatch_companion_with_preset",
      expect.objectContaining({
        p_companion_id: companionFixture.id,
        p_preset_id: "dragon",
        p_initial_image_url: companionFixture.current_image_url,
        p_initial_image_focal_x: null,
        p_initial_image_focal_y: null,
        p_current_image_url: "/companion-presets/dragon/t1_youth/normal/dragon__t1_youth__normal__fire.png",
        p_current_image_focal_x: expect.any(Number),
        p_current_image_focal_y: expect.any(Number),
        p_xp_at_evolution: 14,
      }),
    );

    await waitFor(() => {
      expect(mocks.invokeMock).toHaveBeenCalledWith(
        "generate-evolution-card",
        expect.objectContaining({
          body: expect.objectContaining({
            companionId: companionFixture.id,
            evolutionId: "evo-1",
            stage: 1,
            species: "Dragon",
          }),
        }),
      );
      expect(mocks.invokeMock).toHaveBeenCalledWith(
        "generate-companion-story",
        expect.objectContaining({
          body: expect.objectContaining({
            companionId: companionFixture.id,
            stage: 1,
          }),
        }),
      );
    });
  });
});
