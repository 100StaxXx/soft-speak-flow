import { beforeEach, describe, expect, it, vi } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import React from "react";

type Scenario = {
  deleteErrors: Array<Error | null>;
};

const ONBOARDING_TASK_CLEANUP_VERSION = 2;
const cleanupKey = (userId: string) =>
  `onboarding_task_cleanup_version_${ONBOARDING_TASK_CLEANUP_VERSION}_${userId}`;
const legacyCleanupKey = (userId: string) => `onboarding_task_cleanup_version_1_${userId}`;

const mocks = vi.hoisted(() => {
  const scenario: Scenario = {
    deleteErrors: [],
  };

  const deleteCallMock = vi.fn();
  let deleteCallCount = 0;

  const createDeleteBuilder = (table: string) => {
    const filters: Record<string, unknown> = {};

    const builder: {
      eq: (field: string, value: unknown) => typeof builder;
      in: (field: string, values: unknown[]) => typeof builder;
      then: (
        resolve: (value: { data: null; error: Error | null }) => unknown,
        reject?: (reason: unknown) => unknown,
      ) => Promise<unknown>;
    } = {
      eq: (field: string, value: unknown) => {
        filters[field] = value;
        return builder;
      },
      in: (field: string, values: unknown[]) => {
        filters[field] = values;
        return builder;
      },
      then: (resolve, reject) => {
        const callIndex = deleteCallCount;
        const error = scenario.deleteErrors[callIndex] ?? null;
        deleteCallMock({
          callIndex,
          table,
          filters: { ...filters },
        });
        deleteCallCount += 1;
        return Promise.resolve({ data: null, error }).then(resolve, reject);
      },
    };

    return builder;
  };

  const fromMock = vi.fn((table: string) => ({
    delete: () => createDeleteBuilder(table),
  }));

  const reset = () => {
    scenario.deleteErrors = [];
    deleteCallCount = 0;
  };

  return {
    scenario,
    deleteCallMock,
    fromMock,
    reset,
  };
});

const storageMocks = vi.hoisted(() => {
  const store = new Map<string, string>();

  return {
    safeLocalStorage: {
      getItem: vi.fn((key: string) => store.get(key) ?? null),
      setItem: vi.fn((key: string, value: string) => {
        store.set(key, value);
        return true;
      }),
      removeItem: vi.fn((key: string) => {
        store.delete(key);
        return true;
      }),
      clear: vi.fn(() => {
        store.clear();
        return true;
      }),
    },
    reset: () => {
      store.clear();
    },
  };
});

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: mocks.fromMock,
  },
}));

vi.mock("@/utils/storage", () => ({
  safeLocalStorage: storageMocks.safeLocalStorage,
}));

import { ONBOARDING_TASKS, ONBOARDING_TASK_TEXTS, useOnboardingSchedule } from "./useOnboardingSchedule";

const createWrapper = (queryClient: QueryClient) => {
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
};

describe("useOnboardingSchedule (cleanup compatibility wrapper)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    storageMocks.reset();
    mocks.reset();
  });

  it("does not persist cleanup key when first delete pass fails", async () => {
    const userId = "user-first-pass-fail";
    mocks.scenario.deleteErrors = [new Error("source cleanup failed")];

    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

    renderHook(() => useOnboardingSchedule(userId, true, false), {
      wrapper: createWrapper(queryClient),
    });

    await waitFor(() => expect(mocks.deleteCallMock).toHaveBeenCalledTimes(1));

    expect(mocks.deleteCallMock.mock.calls[0]?.[0]).toMatchObject({
      table: "daily_tasks",
      filters: {
        user_id: userId,
        source: "onboarding",
      },
    });
    expect(storageMocks.safeLocalStorage.getItem(cleanupKey(userId))).toBeNull();
    expect(invalidateSpy).not.toHaveBeenCalledWith({ queryKey: ["daily-tasks"] });
    expect(invalidateSpy).not.toHaveBeenCalledWith({ queryKey: ["calendar-tasks"] });
  });

  it("does not persist cleanup key when second delete pass fails", async () => {
    const userId = "user-second-pass-fail";
    mocks.scenario.deleteErrors = [null, new Error("title cleanup failed")];

    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

    renderHook(() => useOnboardingSchedule(userId, true, false), {
      wrapper: createWrapper(queryClient),
    });

    await waitFor(() => expect(mocks.deleteCallMock).toHaveBeenCalledTimes(2));

    expect(mocks.deleteCallMock.mock.calls[1]?.[0]).toMatchObject({
      table: "daily_tasks",
      filters: {
        user_id: userId,
        difficulty: "easy",
        is_main_quest: false,
      },
    });
    expect(storageMocks.safeLocalStorage.getItem(cleanupKey(userId))).toBeNull();
    expect(invalidateSpy).not.toHaveBeenCalledWith({ queryKey: ["daily-tasks"] });
    expect(invalidateSpy).not.toHaveBeenCalledWith({ queryKey: ["calendar-tasks"] });
  });

  it("runs both cleanup passes and persists version 2 cleanup key", async () => {
    const userId = "user-cleanup-success";

    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

    renderHook(() => useOnboardingSchedule(userId, true, false), {
      wrapper: createWrapper(queryClient),
    });

    await waitFor(() => expect(mocks.deleteCallMock).toHaveBeenCalledTimes(2));
    await waitFor(() =>
      expect(storageMocks.safeLocalStorage.getItem(cleanupKey(userId))).toBe("true"),
    );

    const secondPassFilters = mocks.deleteCallMock.mock.calls[1]?.[0]?.filters as
      | Record<string, unknown>
      | undefined;
    expect(Array.isArray(secondPassFilters?.task_text)).toBe(true);
    expect((secondPassFilters?.task_text as unknown[]).length).toBe(12);
    expect(secondPassFilters?.xp_reward).toEqual([2, 3, 4]);

    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["daily-tasks"] });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["calendar-tasks"] });
  });

  it("does not run cleanup when cleanup eligibility is false", async () => {
    const userId = "user-ineligible";
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    renderHook(() => useOnboardingSchedule(userId, false, false), {
      wrapper: createWrapper(queryClient),
    });

    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(mocks.deleteCallMock).not.toHaveBeenCalled();
    expect(storageMocks.safeLocalStorage.getItem(cleanupKey(userId))).toBeNull();
  });

  it("reruns cleanup with version 2 key even when legacy version 1 key exists", async () => {
    const userId = "user-version-migration";
    storageMocks.safeLocalStorage.setItem(legacyCleanupKey(userId), "true");

    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    renderHook(() => useOnboardingSchedule(userId, true, false), {
      wrapper: createWrapper(queryClient),
    });

    await waitFor(() => expect(mocks.deleteCallMock).toHaveBeenCalledTimes(2));
    await waitFor(() =>
      expect(storageMocks.safeLocalStorage.getItem(cleanupKey(userId))).toBe("true"),
    );
  });

  it("keeps legacy compatibility exports empty", () => {
    expect(ONBOARDING_TASKS).toEqual([]);
    expect(ONBOARDING_TASK_TEXTS).toEqual([]);
  });
});
