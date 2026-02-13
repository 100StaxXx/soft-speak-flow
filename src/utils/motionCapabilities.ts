export type MotionProfile = "reduced" | "balanced" | "enhanced";

export interface MotionCapabilities {
  allowParallax: boolean;
  maxParticles: number;
  allowBackgroundAnimation: boolean;
  enableTabTransitions: boolean;
  hapticsMode: "off" | "web" | "native";
}

export interface MotionSignals {
  prefersReducedMotion: boolean;
  hardwareConcurrency: number | null;
  deviceMemory: number | null;
  isNative: boolean;
  platform: string;
  isVisible: boolean;
  hasVibration: boolean;
}

const getNavigator = () => (typeof navigator !== "undefined" ? navigator : null);

const detectNativePlatform = (): { isNative: boolean; platform: string } => {
  if (typeof window === "undefined") {
    return { isNative: false, platform: "web" };
  }

  const capacitor = (window as Window & {
    Capacitor?: {
      isNativePlatform?: () => boolean;
      getPlatform?: () => string;
    };
  }).Capacitor;

  return {
    isNative: Boolean(capacitor?.isNativePlatform?.()),
    platform: capacitor?.getPlatform?.() ?? "web",
  };
};

export const detectMotionSignals = (prefersReducedMotion: boolean): MotionSignals => {
  const nav = getNavigator();
  const { isNative, platform } = detectNativePlatform();

  return {
    prefersReducedMotion,
    hardwareConcurrency: nav?.hardwareConcurrency ?? null,
    deviceMemory: (nav as Navigator & { deviceMemory?: number } | null)?.deviceMemory ?? null,
    isNative,
    platform,
    isVisible: typeof document === "undefined" ? true : document.visibilityState === "visible",
    hasVibration: Boolean(nav && "vibrate" in nav && typeof nav.vibrate === "function"),
  };
};

export const resolveMotionProfile = (signals: MotionSignals): MotionProfile => {
  if (signals.prefersReducedMotion) return "reduced";

  const lowMemory = signals.deviceMemory !== null && signals.deviceMemory <= 4;
  const veryLowMemory = signals.deviceMemory !== null && signals.deviceMemory <= 2;
  const lowCores = signals.hardwareConcurrency !== null && signals.hardwareConcurrency <= 4;
  const veryLowCores = signals.hardwareConcurrency !== null && signals.hardwareConcurrency <= 2;

  if (veryLowMemory || veryLowCores) return "reduced";
  if (lowMemory || lowCores) return "balanced";

  // Native iOS gets balanced by default to preserve battery and thermal headroom.
  if (signals.isNative && signals.platform === "ios") return "balanced";

  const highEnd = (signals.deviceMemory ?? 0) >= 8 || (signals.hardwareConcurrency ?? 0) >= 8;
  return highEnd ? "enhanced" : "balanced";
};

export const getHapticsMode = (signals: MotionSignals): MotionCapabilities["hapticsMode"] => {
  if (signals.isNative) return "native";
  if (signals.hasVibration) return "web";
  return "off";
};

export const deriveMotionCapabilities = (
  profile: MotionProfile,
  signals: MotionSignals,
): MotionCapabilities => {
  if (profile === "reduced") {
    return {
      allowParallax: false,
      maxParticles: 0,
      allowBackgroundAnimation: false,
      enableTabTransitions: false,
      hapticsMode: getHapticsMode(signals),
    };
  }

  if (profile === "enhanced") {
    return {
      allowParallax: signals.isVisible,
      maxParticles: signals.isNative ? 52 : 72,
      allowBackgroundAnimation: signals.isVisible,
      enableTabTransitions: true,
      hapticsMode: getHapticsMode(signals),
    };
  }

  return {
    allowParallax: signals.isVisible,
    maxParticles: signals.isNative ? 28 : 42,
    allowBackgroundAnimation: signals.isVisible,
    enableTabTransitions: signals.isVisible,
    hapticsMode: getHapticsMode(signals),
  };
};
