import { beforeEach, describe, expect, it, vi } from "vitest";

interface LoadHapticsOptions {
  isNative: boolean;
  rejectNative?: boolean;
  vibrateImpl?: ((pattern: number | number[]) => boolean) | undefined;
}

const setVibrate = (vibrateImpl?: (pattern: number | number[]) => boolean) => {
  Object.defineProperty(navigator, "vibrate", {
    configurable: true,
    writable: true,
    value: vibrateImpl,
  });
};

const loadHapticsModule = async ({
  isNative,
  rejectNative = false,
  vibrateImpl,
}: LoadHapticsOptions) => {
  vi.resetModules();
  setVibrate(vibrateImpl);

  const impactMock = rejectNative
    ? vi.fn().mockRejectedValue(new Error("native impact failed"))
    : vi.fn().mockResolvedValue(undefined);
  const notificationMock = rejectNative
    ? vi.fn().mockRejectedValue(new Error("native notification failed"))
    : vi.fn().mockResolvedValue(undefined);

  vi.doMock("@capacitor/core", () => ({
    Capacitor: {
      isNativePlatform: () => isNative,
    },
  }));

  vi.doMock("@capacitor/haptics", () => ({
    Haptics: {
      impact: impactMock,
      notification: notificationMock,
    },
    ImpactStyle: {
      Light: "LIGHT",
      Medium: "MEDIUM",
      Heavy: "HEAVY",
    },
    NotificationType: {
      Success: "SUCCESS",
      Error: "ERROR",
    },
  }));

  const module = await import("./haptics");

  return {
    haptics: module.haptics,
    impactMock,
    notificationMock,
  };
};

describe("haptics utility", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it("uses native haptics first on native platforms", async () => {
    const vibrateSpy = vi.fn().mockReturnValue(true);
    const { haptics, impactMock } = await loadHapticsModule({
      isNative: true,
      vibrateImpl: vibrateSpy,
    });

    haptics.light();

    expect(impactMock).toHaveBeenCalledTimes(1);
    expect(vibrateSpy).not.toHaveBeenCalled();
  });

  it("falls back to web vibration when native calls fail", async () => {
    const vibrateSpy = vi.fn().mockReturnValue(true);
    const { haptics, notificationMock } = await loadHapticsModule({
      isNative: true,
      rejectNative: true,
      vibrateImpl: vibrateSpy,
    });

    haptics.success();
    await Promise.resolve();

    expect(notificationMock).toHaveBeenCalledTimes(1);
    expect(vibrateSpy).toHaveBeenCalledWith([10, 50, 10]);
  });

  it("is a safe no-op when neither native nor vibration is available", async () => {
    const { haptics } = await loadHapticsModule({
      isNative: false,
      vibrateImpl: undefined,
    });

    expect(() => {
      haptics.light();
      haptics.medium();
      haptics.heavy();
      haptics.success();
      haptics.error();
    }).not.toThrow();
  });
});
