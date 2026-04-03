import { render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  profile: "balanced" as "reduced" | "balanced" | "enhanced",
  maxParticles: 8,
  prefersReducedMotion: false,
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
      prefersReducedMotion: mocks.prefersReducedMotion,
      isLowPowerMode: false,
      isBackgrounded: false,
    },
  }),
}));

import { CompanionMotionLayer } from "./CompanionMotionLayer";

const createEvent = (type: "xp_gain" | "quest_complete" | "streak" | "wake") => ({
  id: `event-${type}`,
  type,
  intensity: "heroic" as const,
  durationMs: 1200,
  createdAt: Date.now(),
  element: "light",
  stage: 10,
  reason: type,
});

describe("CompanionMotionLayer", () => {
  beforeEach(() => {
    mocks.profile = "balanced";
    mocks.maxParticles = 8;
    mocks.prefersReducedMotion = false;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("scales particle counts down in balanced mode", () => {
    const { container } = render(
      <CompanionMotionLayer
        variant="companion"
        plane="foreground"
        stage={8}
        element="fire"
      />,
    );

    expect(container.querySelectorAll('[data-overlay-layer="particle"]')).toHaveLength(2);
    expect(container.querySelector('[data-motion-plane="foreground"]')).toHaveAttribute(
      "data-motion-animated",
      "true",
    );
  });

  it("disables particle motion cleanly in reduced mode", () => {
    mocks.profile = "reduced";
    mocks.prefersReducedMotion = true;

    const { container } = render(
      <CompanionMotionLayer
        variant="companion"
        plane="foreground"
        stage={8}
        element="fire"
      />,
    );

    expect(container.querySelectorAll('[data-overlay-layer="particle"]')).toHaveLength(0);
    expect(container.querySelector('[data-motion-plane="foreground"]')).toHaveAttribute(
      "data-motion-animated",
      "false",
    );
  });

  it.each([
    ["xp_gain", "foreground", "light", '[data-overlay-layer="event-secondary-ring"]'],
    ["quest_complete", "backdrop", "fire", '[data-overlay-layer="event-swirl"]'],
    ["streak", "foreground", "light", '[data-overlay-layer="event-rays"]'],
    ["wake", "foreground", "light", '[data-overlay-layer="event-beam"]'],
  ] as const)(
    "renders the expected %s burst on the companion card overlay",
    (type, plane, element, selector) => {
      const { container } = render(
        <CompanionMotionLayer
          variant="companion"
          plane={plane}
          stage={10}
          element={element}
          event={createEvent(type)}
        />,
      );

      expect(container.querySelector(`[data-motion-element="${element}"]`)).not.toBeNull();
      expect(container.querySelector(selector)).not.toBeNull();
    },
  );
});
