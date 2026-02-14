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

const DEFAULT_STATE: MotionProfileState = {
  profile: "balanced",
  capabilities: {
    allowParallax: true,
    maxParticles: 24,
    allowBackgroundAnimation: true,
    enableTabTransitions: false,
    hapticsMode: "web",
  },
  signals: {
    prefersReducedMotion: false,
    isLowPowerMode: false,
    isBackgrounded: false,
  },
};

export const useMotionProfile = (): MotionProfileState => DEFAULT_STATE;
