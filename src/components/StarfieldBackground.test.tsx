import { render } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  profile: "balanced" as "reduced" | "balanced" | "enhanced",
  capabilities: {
    allowParallax: true,
    maxParticles: 120,
    allowBackgroundAnimation: true,
    enableTabTransitions: true,
    hapticsMode: "web" as const,
  },
  isTabActive: true,
}));

vi.mock("@/hooks/useDeviceOrientation", () => ({
  useDeviceOrientation: () => ({
    gamma: 0,
    beta: 45,
    permitted: false,
  }),
}));

vi.mock("@/hooks/useTimeColors", () => ({
  useTimeColors: () => ({
    period: "night",
    colors: {
      primary: "hsl(240, 70%, 65%)",
      accent: "hsl(205, 80%, 66%)",
      nebula1: "hsl(265, 72%, 58%)",
      nebula2: "hsl(224, 68%, 56%)",
      nebula3: "hsl(286, 60%, 62%)",
    },
    rotationHue: 0,
    starDistribution: {
      white: 0.5,
      blue: 0.25,
      pink: 0.15,
      gold: 0.05,
      teal: 0.05,
      orange: 0,
    },
    getStarHSL: () => "hsl(0, 0%, 100%)",
    getStarGlow: () => "0 0 4px rgba(255,255,255,0.6)",
  }),
}));

vi.mock("@/contexts/CompanionPresenceContext", () => ({
  useCompanionPresence: () => ({
    presence: { mood: "content" },
  }),
}));

vi.mock("@/hooks/useMotionProfile", () => ({
  useMotionProfile: () => ({
    profile: mocks.profile,
    capabilities: mocks.capabilities,
  }),
}));

vi.mock("@/contexts/MainTabVisibilityContext", () => ({
  useMainTabVisibility: () => ({
    isTabActive: mocks.isTabActive,
  }),
}));

import { StarfieldBackground } from "./StarfieldBackground";

describe("StarfieldBackground motion quality", () => {
  beforeEach(() => {
    mocks.profile = "balanced";
    mocks.capabilities = {
      allowParallax: true,
      maxParticles: 120,
      allowBackgroundAnimation: true,
      enableTabTransitions: true,
      hapticsMode: "web",
    };
    mocks.isTabActive = true;
  });

  it("uses lite quality to reduce layers and disable shooting stars", () => {
    const { container, rerender } = render(
      <StarfieldBackground quality="lite" intensity="medium" parallax="off" />,
    );

    const root = container.querySelector("[data-starfield-active]");
    expect(root).toHaveAttribute("data-starfield-quality", "lite");
    expect(container.querySelectorAll("[data-star-layer='shooting-star']")).toHaveLength(0);

    const liteBackgroundStars = container.querySelectorAll("[data-star-layer='background-star']").length;
    const liteBrightStars = container.querySelectorAll("[data-star-layer='bright-star']").length;

    rerender(<StarfieldBackground quality="full" intensity="medium" parallax="off" />);

    expect(container.querySelector("[data-starfield-active]")).toHaveAttribute("data-starfield-quality", "full");
    expect(container.querySelectorAll("[data-star-layer='background-star']").length).toBeGreaterThan(liteBackgroundStars);
    expect(container.querySelectorAll("[data-star-layer='bright-star']").length).toBeGreaterThan(liteBrightStars);
    expect(container.querySelectorAll("[data-star-layer='shooting-star']").length).toBeGreaterThan(0);
  });

  it("turns off expensive effects for reduced profile", () => {
    mocks.profile = "reduced";
    mocks.capabilities = {
      allowParallax: false,
      maxParticles: 0,
      allowBackgroundAnimation: false,
      enableTabTransitions: false,
      hapticsMode: "off",
    };

    const { container } = render(<StarfieldBackground quality="auto" intensity="high" parallax="pointer" />);

    const root = container.querySelector("[data-starfield-active]");
    expect(root).toHaveAttribute("data-starfield-quality", "lite");
    expect(root).toHaveAttribute("data-starfield-parallax", "off");
    expect(root).toHaveAttribute("data-starfield-animated", "false");
    expect(document.querySelectorAll("[data-star-layer]").length).toBe(0);
  });
});
