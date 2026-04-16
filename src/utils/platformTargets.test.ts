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

import {
  isMacSession,
  isMacDesignedForIPadIOSApp,
  isNativeIOS,
  isNativeIOSHandheld,
} from "@/utils/platformTargets";

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

describe("platformTargets", () => {
  beforeEach(() => {
    capacitorMocks.isNativePlatform.mockReset();
    capacitorMocks.getPlatform.mockReset();
    capacitorMocks.isNativePlatform.mockReturnValue(false);
    capacitorMocks.getPlatform.mockReturnValue("web");
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

  it("treats macOS web as a blocked Mac session without marking it as native iOS", () => {
    setNavigatorValues("Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0)", 0);

    expect(isNativeIOS()).toBe(false);
    expect(isMacDesignedForIPadIOSApp()).toBe(false);
    expect(isNativeIOSHandheld()).toBe(false);
    expect(isMacSession()).toBe(true);
  });

  it("treats iPhone/iPad native as handheld iOS", () => {
    capacitorMocks.isNativePlatform.mockReturnValue(true);
    capacitorMocks.getPlatform.mockReturnValue("ios");
    setNavigatorValues("Mozilla/5.0 (iPad; CPU OS 18_0 like Mac OS X)", 5);

    expect(isNativeIOS()).toBe(true);
    expect(isMacDesignedForIPadIOSApp()).toBe(false);
    expect(isNativeIOSHandheld()).toBe(true);
    expect(isMacSession()).toBe(false);
  });

  it("does not misclassify touch-capable native iPad sessions that report a Macintosh-style user agent", () => {
    capacitorMocks.isNativePlatform.mockReturnValue(true);
    capacitorMocks.getPlatform.mockReturnValue("ios");
    setNavigatorValues("Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0)", 5);

    expect(isNativeIOS()).toBe(true);
    expect(isMacDesignedForIPadIOSApp()).toBe(false);
    expect(isNativeIOSHandheld()).toBe(true);
    expect(isMacSession()).toBe(false);
  });

  it("detects Mac-hosted iOS app and excludes it from handheld target", () => {
    capacitorMocks.isNativePlatform.mockReturnValue(true);
    capacitorMocks.getPlatform.mockReturnValue("ios");
    setNavigatorValues("Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0)", 0);

    expect(isNativeIOS()).toBe(true);
    expect(isMacDesignedForIPadIOSApp()).toBe(true);
    expect(isNativeIOSHandheld()).toBe(false);
    expect(isMacSession()).toBe(true);
  });
});
