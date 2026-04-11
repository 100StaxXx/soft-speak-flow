import { describe, expect, it, beforeEach, vi } from "vitest";

import {
  PENDING_REFERRAL_CODE_STORAGE_KEY,
  clearPendingReferralCode,
  getReferralCodeFromSearch,
  normalizeReferralCode,
  readPendingReferralCode,
  storePendingReferralCode,
} from "@/utils/referralAttribution";

const localStorageState = vi.hoisted(() => ({
  store: new Map<string, string>(),
}));

Object.defineProperty(globalThis, "localStorage", {
  configurable: true,
  value: {
    getItem: (key: string) => localStorageState.store.get(key) ?? null,
    setItem: (key: string, value: string) => {
      localStorageState.store.set(key, value);
    },
    removeItem: (key: string) => {
      localStorageState.store.delete(key);
    },
    clear: () => {
      localStorageState.store.clear();
    },
    key: (index: number) => Array.from(localStorageState.store.keys())[index] ?? null,
    get length() {
      return localStorageState.store.size;
    },
  },
});

describe("referralAttribution", () => {
  beforeEach(() => {
    localStorageState.store.clear();
    vi.restoreAllMocks();
  });

  it("normalizes valid referral codes", () => {
    expect(normalizeReferralCode(" cosmiq-test42 ")).toBe("COSMIQ-TEST42");
  });

  it("rejects invalid referral codes", () => {
    expect(normalizeReferralCode("bad code")).toBeNull();
    expect(normalizeReferralCode("")).toBeNull();
    expect(normalizeReferralCode(null)).toBeNull();
  });

  it("reads and writes pending referral codes", () => {
    expect(storePendingReferralCode("creator-42")).toBe(true);
    expect(globalThis.localStorage.getItem(PENDING_REFERRAL_CODE_STORAGE_KEY)).toBe("CREATOR-42");
    expect(readPendingReferralCode()).toBe("CREATOR-42");

    expect(clearPendingReferralCode()).toBe(true);
    expect(readPendingReferralCode()).toBeNull();
  });

  it("extracts referral codes from the URL querystring", () => {
    expect(getReferralCodeFromSearch("?ref=creator-42")).toBe("CREATOR-42");
    expect(getReferralCodeFromSearch("?utm_source=tiktok&ref=creator-42")).toBe("CREATOR-42");
    expect(getReferralCodeFromSearch("?ref=bad%20code")).toBeNull();
  });
});
