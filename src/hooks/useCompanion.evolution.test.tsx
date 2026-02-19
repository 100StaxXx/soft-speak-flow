import { act, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { safeLocalStorage } from "@/utils/storage";

const mocks = vi.hoisted(() => {
  const rpcMock = vi.fn();
  const invokeMock = vi.fn();
  const fromMock = vi.fn();
  const setIsEvolvingLoadingMock = vi.fn();
  const toastErrorMock = vi.fn();
  const toastSuccessMock = vi.fn();
  const checkCompanionAchievementsMock = vi.fn();
  const userCompanionResponses: Array<{ data: unknown; error: unknown }> = [];
  const evolutionJobResponses: Array<{ data: unknown; error: unknown }> = [];

  return {
    rpcMock,
    invokeMock,
    fromMock,
    setIsEvolvingLoadingMock,
    toastErrorMock,
    toastSuccessMock,
    checkCompanionAchievementsMock,
    userCompanionResponses,
    evolutionJobResponses,
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

import { useCompanion } from "./useCompanion";

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

const createQueryBuilder = (table: string) => {
  const builder = {
    select: vi.fn(() => builder),
    eq: vi.fn(() => builder),
    in: vi.fn(() => builder),
    order: vi.fn(() => builder),
    limit: vi.fn(() => builder),
    maybeSingle: vi.fn(async () => {
      if (table === "user_companion") {
        return mocks.userCompanionResponses.shift() ?? { data: null, error: null };
      }

      if (table === "companion_evolution_jobs") {
        return mocks.evolutionJobResponses.shift() ?? { data: null, error: null };
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
    safeLocalStorage.removeItem("companion:evolution:active-job:user-1");
    safeLocalStorage.removeItem("companion:evolution:ready:user-1");

    mocks.userCompanionResponses.length = 0;
    mocks.evolutionJobResponses.length = 0;

    mocks.userCompanionResponses.push({ data: companionFixture, error: null });
    mocks.evolutionJobResponses.push({ data: null, error: null });

    mocks.fromMock.mockImplementation((table: string) => createQueryBuilder(table));
    mocks.invokeMock.mockResolvedValue({ data: null, error: null });
  });

  it("requests an async evolution job with a true no-arg RPC call", async () => {
    mocks.rpcMock.mockResolvedValue({
      data: [{ job_id: "job-1", status: "queued", requested_stage: 1 }],
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

    expect(mutationResult!).toEqual({ path: "job", jobId: "job-1" });
    expect(mocks.rpcMock).toHaveBeenCalledWith("request_companion_evolution_job");
    expect(mocks.rpcMock.mock.calls[0]).toHaveLength(1);
    expect(mocks.invokeMock).toHaveBeenCalledWith("process-companion-evolution-job", {
      body: { jobId: "job-1" },
    });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["companion-evolution-job", "user-1"] });
  });

  it("falls back to direct evolution when no async job can be established", async () => {
    mocks.rpcMock.mockResolvedValue({ data: null, error: null });
    mocks.evolutionJobResponses.push({ data: null, error: null });
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

    expect(mutationResult!).toEqual({ path: "direct", newStage: 1 });
    expect(mocks.invokeMock).toHaveBeenCalledWith("generate-companion-evolution", { body: {} });
    expect(mocks.setIsEvolvingLoadingMock).toHaveBeenCalledWith(false);
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["companion"] });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["companion-stories-all"] });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["evolution-cards"] });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["current-evolution-card"] });
  });

  it("shows a specific message when direct fallback reports not enough XP", async () => {
    mocks.rpcMock.mockResolvedValue({ data: null, error: null });
    mocks.evolutionJobResponses.push({ data: null, error: null });
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
  });

  it("maps auth request errors without attempting direct fallback", async () => {
    mocks.rpcMock.mockResolvedValue({
      data: null,
      error: { message: "not_authenticated" },
    });

    const { result } = await renderUseCompanion();

    await act(async () => {
      await expect(
        result.current.evolveCompanion.mutateAsync({
          newStage: 1,
          currentXP: 14,
        }),
      ).rejects.toThrow("Your session has expired. Please sign in again and try evolving.");
    });

    expect(mocks.invokeMock).not.toHaveBeenCalledWith("generate-companion-evolution", { body: {} });
    expect(mocks.toastErrorMock).toHaveBeenCalledWith(
      "Your session has expired. Please sign in again and try evolving.",
    );
  });
});
