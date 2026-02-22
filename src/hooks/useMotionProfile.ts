import { useEffect, useMemo, useRef, useState } from "react";
import { logger } from "@/utils/logger";
import { Capacitor } from "@capacitor/core";

export type MotionProfile = "reduced" | "balanced" | "enhanced";

export interface MotionCapabilities {
  allowParallax: boolean;
  maxParticles: number;
  allowBackgroundAnimation: boolean;
  enableTabTransitions: boolean;
  hapticsMode: "none" | "web";
}

export interface MotionSignals {
  prefersReducedMotion: boolean;
  isLowPowerMode: boolean;
  isBackgrounded: boolean;
}

interface MotionProfileState {
  profile: MotionProfile;
  capabilities: MotionCapabilities;
  signals: MotionSignals;
}

const getNativeIOS = () => {
  if (typeof window === "undefined") return false;
  return Capacitor.isNativePlatform() && Capacitor.getPlatform() === "ios";
};

const readReducedMotionPreference = () => {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
};

const readSaveDataPreference = () => {
  if (typeof navigator === "undefined") return false;
  const connection = (navigator as Navigator & {
    connection?: { saveData?: boolean };
  }).connection;
  return Boolean(connection?.saveData);
};

export const useMotionProfile = (): MotionProfileState => {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(readReducedMotionPreference);
  const [isBackgrounded, setIsBackgrounded] = useState(() =>
    typeof document !== "undefined" ? document.visibilityState !== "visible" : false,
  );
  const [isLowPowerMode, setIsLowPowerMode] = useState(readSaveDataPreference);
  const isNativeIOS = useMemo(() => getNativeIOS(), []);
  const lastLoggedProfileRef = useRef<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const handleChange = () => setPrefersReducedMotion(mediaQuery.matches);
    mediaQuery.addEventListener("change", handleChange);
    return () => mediaQuery.removeEventListener("change", handleChange);
  }, []);

  useEffect(() => {
    if (typeof document === "undefined") return;
    const handleVisibilityChange = () => {
      setIsBackgrounded(document.visibilityState !== "visible");
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, []);

  useEffect(() => {
    if (typeof navigator === "undefined") return;
    const connection = (navigator as Navigator & {
      connection?: EventTarget & { saveData?: boolean };
    }).connection;
    if (!connection || typeof connection.addEventListener !== "function") return;

    const handleConnectionChange = () => setIsLowPowerMode(Boolean(connection.saveData));
    handleConnectionChange();
    connection.addEventListener("change", handleConnectionChange);
    return () => connection.removeEventListener("change", handleConnectionChange);
  }, []);

  const signals: MotionSignals = useMemo(
    () => ({
      prefersReducedMotion,
      isLowPowerMode,
      isBackgrounded,
    }),
    [isBackgrounded, isLowPowerMode, prefersReducedMotion],
  );

  const profile: MotionProfile = useMemo(() => {
    if (signals.prefersReducedMotion || signals.isBackgrounded) {
      return "reduced";
    }
    if (signals.isLowPowerMode || isNativeIOS) {
      return "balanced";
    }
    return "enhanced";
  }, [isNativeIOS, signals.isBackgrounded, signals.isLowPowerMode, signals.prefersReducedMotion]);

  const capabilities: MotionCapabilities = useMemo(() => {
    if (profile === "reduced") {
      return {
        allowParallax: false,
        maxParticles: 4,
        allowBackgroundAnimation: false,
        enableTabTransitions: false,
        hapticsMode: "none",
      };
    }

    if (profile === "balanced") {
      return {
        allowParallax: !isNativeIOS,
        maxParticles: isNativeIOS ? 8 : 16,
        allowBackgroundAnimation: !isNativeIOS,
        enableTabTransitions: !isNativeIOS,
        hapticsMode: "web",
      };
    }

    return {
      allowParallax: true,
      maxParticles: 24,
      allowBackgroundAnimation: true,
      enableTabTransitions: true,
      hapticsMode: "web",
    };
  }, [isNativeIOS, profile]);

  useEffect(() => {
    if (!import.meta.env.DEV) return;

    const payload = JSON.stringify({
      profile,
      prefersReducedMotion: signals.prefersReducedMotion,
      isBackgrounded: signals.isBackgrounded,
      isLowPowerMode: signals.isLowPowerMode,
      isNativeIOS,
    });

    if (payload === lastLoggedProfileRef.current) return;
    lastLoggedProfileRef.current = payload;

    logger.debug("Motion profile updated", JSON.parse(payload) as Record<string, unknown>);
  }, [isNativeIOS, profile, signals.isBackgrounded, signals.isLowPowerMode, signals.prefersReducedMotion]);

  return useMemo(
    () => ({
      profile,
      capabilities,
      signals,
    }),
    [capabilities, profile, signals],
  );
};
