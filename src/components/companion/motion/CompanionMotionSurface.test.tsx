import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  profile: "balanced" as "reduced" | "balanced" | "enhanced",
  maxParticles: 8,
}));

vi.mock("@/hooks/useMotionProfile", () => ({
  useMotionProfile: () => ({
    profile: mocks.profile,
    capabilities: {
      allowParallax: true,
      maxParticles: mocks.maxParticles,
      allowBackgroundAnimation: true,
      enableTabTransitions: true,
      hapticsMode: "web",
    },
    signals: {
      prefersReducedMotion: false,
      isLowPowerMode: false,
      isBackgrounded: false,
    },
  }),
}));

import { CompanionMotionSurface } from "./CompanionMotionSurface";

describe("CompanionMotionSurface", () => {
  it("omits unnecessary visual effects in clean portrait mode", () => {
    render(<CompanionMotionSurface showEffects={false} variant="companion" stage={1} element="storm"><div>Animal</div></CompanionMotionSurface>);
    const surface = screen.getByTestId("companion-motion-surface");
    expect(surface.children).toHaveLength(1);
    expect(screen.getByText("Animal")).toBeInTheDocument();
    expect(surface.querySelector('[data-motion-plane]')).toBeNull();
  });
  beforeEach(() => {
    mocks.profile = "balanced";
    mocks.maxParticles = 8;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders backdrop plane, content, then foreground plane in order", () => {
    render(
      <CompanionMotionSurface variant="companion" stage={8} element="fire" className="h-40 w-40">
        <div>Companion art</div>
      </CompanionMotionSurface>,
    );

    const surface = screen.getByTestId("companion-motion-surface");
    const content = screen.getByTestId("companion-motion-surface-content");

    expect(surface.children[0]).toHaveAttribute("data-motion-plane", "backdrop");
    expect(surface.children[1]).toBe(content);
    expect(surface.children[2]).toHaveAttribute("data-motion-plane", "foreground");
    expect(surface.children[0]).toHaveClass("pointer-events-none");
    expect(surface.children[2]).toHaveClass("pointer-events-none");
  });
});
