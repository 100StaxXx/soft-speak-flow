import { render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  isTabActive: true,
  profile: "enhanced" as "reduced" | "balanced" | "enhanced",
  allowParallax: true,
  allowBackgroundAnimation: true,
  maxParticles: 24,
  isBackgrounded: false,
  prefersReducedMotion: false,
}));

vi.mock("@/contexts/MainTabVisibilityContext", () => ({
  useMainTabVisibility: () => ({
    isTabActive: mocks.isTabActive,
  }),
}));

vi.mock("@/hooks/useMotionProfile", () => ({
  useMotionProfile: () => ({
    profile: mocks.profile,
    capabilities: {
      allowParallax: mocks.allowParallax,
      maxParticles: mocks.maxParticles,
      allowBackgroundAnimation: mocks.allowBackgroundAnimation,
      enableTabTransitions: true,
      hapticsMode: "web",
    },
    signals: {
      prefersReducedMotion: mocks.prefersReducedMotion,
      isLowPowerMode: false,
      isBackgrounded: mocks.isBackgrounded,
    },
  }),
}));

vi.mock("@/hooks/useDeviceOrientation", () => ({
  useDeviceOrientation: () => ({
    gamma: 0,
    beta: 0,
    permitted: false,
  }),
}));

vi.mock("@/hooks/useTimeColors", () => ({
  useTimeColors: () => ({
    period: "night",
    colors: {
      primary: "hsl(230, 70%, 55%)",
      accent: "hsl(195, 90%, 55%)",
      nebula1: "hsl(240, 60%, 45%)",
      nebula2: "hsl(200, 75%, 50%)",
      nebula3: "hsl(270, 55%, 45%)",
    },
    rotationHue: 0,
    starDistribution: {
      white: 1,
      blue: 0,
      pink: 0,
      gold: 0,
      teal: 0,
      orange: 0,
    },
    getStarHSL: () => "hsl(0, 0%, 100%)",
    getStarGlow: () => "0 0 8px hsla(0, 0%, 100%, 0.4)",
  }),
}));

vi.mock("@/contexts/CompanionPresenceContext", () => ({
  useCompanionPresence: () => ({
    presence: { mood: "neutral" },
  }),
}));

import { StarfieldBackground } from "@/components/StarfieldBackground";

describe("StarfieldBackground", () => {
  beforeEach(() => {
    mocks.isTabActive = true;
    mocks.profile = "enhanced";
    mocks.allowParallax = true;
    mocks.allowBackgroundAnimation = true;
    mocks.maxParticles = 24;
    mocks.isBackgrounded = false;
    mocks.prefersReducedMotion = false;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("does not attach mousemove listeners when tab is inactive", () => {
    mocks.isTabActive = false;
    const addEventListenerSpy = vi.spyOn(window, "addEventListener");
    const { container } = render(<StarfieldBackground />);

    const mousemoveRegistrations = addEventListenerSpy.mock.calls.filter(
      ([eventName]) => eventName === "mousemove",
    );

    expect(mousemoveRegistrations).toHaveLength(0);
    expect(container.firstElementChild).toHaveAttribute("data-starfield-mode", "inactive");
  });

  it("attaches mousemove listeners in active enhanced mode", () => {
    const addEventListenerSpy = vi.spyOn(window, "addEventListener");
    const { container } = render(<StarfieldBackground />);

    const mousemoveRegistrations = addEventListenerSpy.mock.calls.filter(
      ([eventName]) => eventName === "mousemove",
    );

    expect(mousemoveRegistrations.length).toBeGreaterThan(0);
    expect(container.firstElementChild).toHaveAttribute("data-starfield-mode", "full");
  });
});
