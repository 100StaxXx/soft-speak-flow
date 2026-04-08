import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  cinematicPageBackgrounds,
  type CinematicPageBackgroundKey,
} from "@/assets/backgrounds";

const mocks = vi.hoisted(() => ({
  isTabActive: true,
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
    colors: {
      primary: "hsl(230, 70%, 55%)",
      accent: "hsl(195, 90%, 55%)",
    },
  }),
}));

import { CinematicPageBackground } from "@/components/CinematicPageBackground";

describe("CinematicPageBackground", () => {
  beforeEach(() => {
    mocks.isTabActive = true;
    mocks.allowParallax = true;
    mocks.allowBackgroundAnimation = true;
    mocks.maxParticles = 24;
    mocks.isBackgrounded = false;
    mocks.prefersReducedMotion = false;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it.each([
    "quests",
    "campaigns",
    "companion",
    "profile",
  ] as CinematicPageBackgroundKey[])("renders the %s wallpaper preset", (preset) => {
    render(<CinematicPageBackground preset={preset} />);

    expect(screen.getByTestId("cinematic-background")).toHaveAttribute("data-cinematic-background", preset);
  });

  it("uses the configured mobile and desktop focal points", () => {
    render(<CinematicPageBackground preset="campaigns" />);

    expect(screen.getByTestId("cinematic-background-image-mobile")).toHaveStyle({
      objectPosition: cinematicPageBackgrounds.campaigns.mobileObjectPosition,
    });
    expect(screen.getByTestId("cinematic-background-image-desktop")).toHaveStyle({
      objectPosition: cinematicPageBackgrounds.campaigns.desktopObjectPosition,
    });
  });

  it("omits the cosmic polish layer for quieter presets", () => {
    render(<CinematicPageBackground preset="profile" />);

    expect(
      screen.getByTestId("cinematic-background").querySelector('[data-cinematic-stars="true"]'),
    ).toBeNull();
  });

  it("falls back to static motion when background animation is disabled", () => {
    mocks.allowBackgroundAnimation = false;

    render(<CinematicPageBackground preset="quests" />);

    expect(screen.getByTestId("cinematic-background")).toHaveAttribute("data-cinematic-motion", "static");
  });
});
