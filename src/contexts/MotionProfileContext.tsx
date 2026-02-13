import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  detectMotionSignals,
  deriveMotionCapabilities,
  resolveMotionProfile,
  type MotionCapabilities,
  type MotionProfile,
  type MotionSignals,
} from "@/utils/motionCapabilities";

interface MotionProfileContextValue {
  profile: MotionProfile;
  capabilities: MotionCapabilities;
  signals: MotionSignals;
}

const defaultSignals = detectMotionSignals(false);

const defaultValue: MotionProfileContextValue = {
  profile: "balanced",
  capabilities: deriveMotionCapabilities("balanced", defaultSignals),
  signals: defaultSignals,
};

const MotionProfileContext = createContext<MotionProfileContextValue>(defaultValue);

export const MotionProfileProvider = ({ children }: { children: ReactNode }) => {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
  const [visibilityTick, setVisibilityTick] = useState(0);

  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;

    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    setPrefersReducedMotion(mediaQuery.matches);
    const handleChange = (event: MediaQueryListEvent) => {
      setPrefersReducedMotion(event.matches);
    };
    mediaQuery.addEventListener("change", handleChange);
    return () => {
      mediaQuery.removeEventListener("change", handleChange);
    };
  }, []);

  useEffect(() => {
    const handleVisibility = () => setVisibilityTick((current) => current + 1);
    document.addEventListener("visibilitychange", handleVisibility);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, []);

  const signals = useMemo(
    () => detectMotionSignals(prefersReducedMotion),
    [prefersReducedMotion, visibilityTick],
  );
  const profile = useMemo(() => resolveMotionProfile(signals), [signals]);
  const capabilities = useMemo(
    () => deriveMotionCapabilities(profile, signals),
    [profile, signals],
  );

  const value = useMemo(
    () => ({
      profile,
      capabilities,
      signals,
    }),
    [profile, capabilities, signals],
  );

  return <MotionProfileContext.Provider value={value}>{children}</MotionProfileContext.Provider>;
};

export const useMotionProfileContext = () => useContext(MotionProfileContext);
