import { beforeEach, describe, expect, it, vi } from "vitest";

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

vi.mock("@/utils/storage", () => ({
  safeLocalStorage: storageMocks.safeLocalStorage,
}));

vi.mock("@/utils/guidedTutorial", () => ({
  getGuidedTutorialLocalProgressKey: (userId: string) => `guided_tutorial_progress_${userId}`,
}));

import {
  clearUserAccountLocalState,
  getMorningCheckInDraftStorageKey,
  getQuestDraftStorageKey,
} from "@/utils/accountLocalState";
import { safeLocalStorage } from "@/utils/storage";

const localStorageShim: Record<string, unknown> = {
  getItem: (key: string) => storageMocks.storage.get(key) ?? null,
  setItem: (key: string, value: string) => {
    storageMocks.storage.set(key, value);
    localStorageShim[key] = value;
  },
  removeItem: (key: string) => {
    storageMocks.storage.delete(key);
    delete localStorageShim[key];
  },
  clear: () => {
    for (const key of Array.from(storageMocks.storage.keys())) {
      delete localStorageShim[key];
    }
    storageMocks.storage.clear();
  },
  key: (index: number) => Array.from(storageMocks.storage.keys())[index] ?? null,
};

Object.defineProperty(localStorageShim, "length", {
  configurable: true,
  get: () => storageMocks.storage.size,
});

Object.defineProperty(globalThis, "localStorage", {
  configurable: true,
  value: localStorageShim,
});

describe("accountLocalState", () => {
  beforeEach(() => {
    localStorage.clear();
    safeLocalStorage.clear();
  });

  it("removes persisted drafts for the signed-out user only", () => {
    localStorage.setItem(getQuestDraftStorageKey("user-1"), "quest-1");
    localStorage.setItem(getMorningCheckInDraftStorageKey("user-1"), "checkin-1");
    localStorage.setItem(getQuestDraftStorageKey("user-2"), "quest-2");
    localStorage.setItem(getMorningCheckInDraftStorageKey("user-2"), "checkin-2");

    clearUserAccountLocalState("user-1");

    expect(safeLocalStorage.getItem(getQuestDraftStorageKey("user-1"))).toBeNull();
    expect(safeLocalStorage.getItem(getMorningCheckInDraftStorageKey("user-1"))).toBeNull();
    expect(safeLocalStorage.getItem(getQuestDraftStorageKey("user-2"))).toBe("quest-2");
    expect(safeLocalStorage.getItem(getMorningCheckInDraftStorageKey("user-2"))).toBe("checkin-2");
  });
});
