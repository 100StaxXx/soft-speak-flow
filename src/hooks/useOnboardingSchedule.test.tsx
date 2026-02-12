import { beforeEach, describe, expect, it, vi } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import React from "react";

type Scenario = {
  deleteError: Error | null;
};

const ONBOARDING_TASK_CLEANUP_VERSION = 1;
const cleanupKey = (userId: string) =>
  `onboarding_task_cleanup_version_${ONBOARDING_TASK_CLEANUP_VERSION}_${userId}`;

const mocks = vi.hoisted(() => {
  const scenario: Scenario = {
    deleteError: null,
  };

  const deleteCallMock = vi.fn();

  const createDeleteBuilder = () => {
    const filters: Record<string, unknown> = {};

    const builder: {
      eq: (field: string, value: unknown) => typeof builder;
      then: (
        resolve: (value: { data: null; error: Error | null }) => unknown,
        reject?: (reason: unknown) => unknown,
      ) => Promise<unknown>;
    } = {
      eq: (field: string, value: unknown) => {
        filters[field] = value;
        return builder;
      },
      then: (resolve, reject) => {
        deleteCallMock(filters);
        return Promise.resolve({ data: null, error: scenario.deleteError }).then(resolve, reject);
      },
    };

    return builder;
  };

  const fromMock = vi.fn((_table: string) => ({
    delete: () => createDeleteBuilder(),
  }));

  return {
    scenario,
    deleteCallMock,
    fromMock,
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
    mocks.scenario.deleteError = null;
  });

  it("does not persist cleanup key when delete fails", async () => {
    const userId = "user-sync-fail";
    mocks.scenario.deleteError = new Error("cleanup delete failed");

    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

    renderHook(() => useOnboardingSchedule(userId, true, false), {
      wrapper: createWrapper(queryClient),
    });

    await waitFor(() => expect(mocks.deleteCallMock).toHaveBeenCalledTimes(1));

    expect(storageMocks.safeLocalStorage.getItem(cleanupKey(userId))).toBeNull();
    expect(invalidateSpy).not.toHaveBeenCalledWith({ queryKey: ["daily-tasks"] });
    expect(invalidateSpy).not.toHaveBeenCalledWith({ queryKey: ["calendar-tasks"] });
  });

  it("persists cleanup key and invalidates task queries after successful cleanup", async () => {
    const userId = "user-cleanup-success";

    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

    renderHook(() => useOnboardingSchedule(userId, true, false), {
      wrapper: createWrapper(queryClient),
    });

    await waitFor(() => expect(mocks.deleteCallMock).toHaveBeenCalledTimes(1));
    await waitFor(() =>
      expect(storageMocks.safeLocalStorage.getItem(cleanupKey(userId))).toBe("true"),
    );

    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["daily-tasks"] });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["calendar-tasks"] });
  });

  it("keeps legacy compatibility exports empty", () => {
    expect(ONBOARDING_TASKS).toEqual([]);
    expect(ONBOARDING_TASK_TEXTS).toEqual([]);
  });
});
