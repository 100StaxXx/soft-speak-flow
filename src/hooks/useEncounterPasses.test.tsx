import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

let activeUserId: string | null = "user-1";
const storageMocks = vi.hoisted(() => {
  const storage = new Map<string, string>();

  return {
    storage,
    safeLocalStorage: {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => {
        storage.set(key, value);
        return true;
      },
      removeItem: (key: string) => {
        storage.delete(key);
        return true;
      },
      clear: () => {
        storage.clear();
        return true;
      },
    },
  };
});

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({
    user: activeUserId ? { id: activeUserId } : null,
  }),
}));

vi.mock("@/utils/storage", () => ({
  safeLocalStorage: storageMocks.safeLocalStorage,
}));

import { useEncounterPasses } from "./useEncounterPasses";
import { ENCOUNTER_PASSES_LEGACY_KEY, getEncounterPassesStorageKey } from "@/utils/accountLocalState";
import { safeLocalStorage } from "@/utils/storage";

const getTodayKey = () => new Date().toISOString().split("T")[0];

describe("useEncounterPasses", () => {
  beforeEach(() => {
    activeUserId = "user-1";
    safeLocalStorage.clear();
  });

  it("migrates legacy global pass data into a user-scoped key once", async () => {
    safeLocalStorage.setItem(
      ENCOUNTER_PASSES_LEGACY_KEY,
      JSON.stringify({ date: getTodayKey(), count: 2 }),
    );

    const { result } = renderHook(() => useEncounterPasses());

    await waitFor(() => {
      expect(result.current.passCount).toBe(2);
    });

    expect(safeLocalStorage.getItem(ENCOUNTER_PASSES_LEGACY_KEY)).toBeNull();
    expect(safeLocalStorage.getItem(getEncounterPassesStorageKey("user-1"))).toBe(
      JSON.stringify({ date: getTodayKey(), count: 2 }),
    );
  });

  it("keeps encounter passes isolated across same-device user switches", async () => {
    const { result, rerender } = renderHook(() => useEncounterPasses());

    await waitFor(() => {
      expect(result.current.passCount).toBe(0);
    });

    act(() => {
      result.current.recordPass();
    });

    expect(safeLocalStorage.getItem(getEncounterPassesStorageKey("user-1"))).toBe(
      JSON.stringify({ date: getTodayKey(), count: 1 }),
    );

    activeUserId = "user-2";
    rerender();

    await waitFor(() => {
      expect(result.current.passCount).toBe(0);
    });

    expect(safeLocalStorage.getItem(getEncounterPassesStorageKey("user-2"))).toBe(
      JSON.stringify({ date: getTodayKey(), count: 0 }),
    );
  });
});
