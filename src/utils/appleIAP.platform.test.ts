import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const capacitorMocks = vi.hoisted(() => ({
  isNativePlatform: vi.fn(),
  getPlatform: vi.fn(),
}));

vi.mock("@capacitor/core", () => ({
  Capacitor: {
    isNativePlatform: capacitorMocks.isNativePlatform,
    getPlatform: capacitorMocks.getPlatform,
  },
}));

vi.mock("@capgo/native-purchases", () => ({
  NativePurchases: {},
  PURCHASE_TYPE: {
    SUBS: "subs",
  },
}));

import { isIAPAvailable } from "@/utils/appleIAP";

const originalUserAgentDescriptor = Object.getOwnPropertyDescriptor(navigator, "userAgent");
const originalMaxTouchPointsDescriptor = Object.getOwnPropertyDescriptor(navigator, "maxTouchPoints");

const setNavigatorValues = (userAgent: string, maxTouchPoints: number) => {
  Object.defineProperty(navigator, "userAgent", {
    configurable: true,
    value: userAgent,
  });

  Object.defineProperty(navigator, "maxTouchPoints", {
    configurable: true,
    value: maxTouchPoints,
  });
};

describe("isIAPAvailable", () => {
  beforeEach(() => {
    capacitorMocks.isNativePlatform.mockReset();
    capacitorMocks.getPlatform.mockReset();
    capacitorMocks.isNativePlatform.mockReturnValue(true);
    capacitorMocks.getPlatform.mockReturnValue("ios");
  });

  afterEach(() => {
    if (originalUserAgentDescriptor) {
      Object.defineProperty(navigator, "userAgent", originalUserAgentDescriptor);
    } else {
      delete (navigator as Navigator & { userAgent?: string }).userAgent;
    }

    if (originalMaxTouchPointsDescriptor) {
      Object.defineProperty(navigator, "maxTouchPoints", originalMaxTouchPointsDescriptor);
    } else {
      delete (navigator as Navigator & { maxTouchPoints?: number }).maxTouchPoints;
    }
  });

  it("returns false on Mac-hosted iOS app", () => {
    setNavigatorValues("Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0)", 0);

    expect(isIAPAvailable()).toBe(false);
  });

  it("returns true on handheld iOS", () => {
    setNavigatorValues("Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)", 5);

    expect(isIAPAvailable()).toBe(true);
  });
});
