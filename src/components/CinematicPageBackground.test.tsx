import { fireEvent, render, screen } from "@testing-library/react";
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
  currentDateReady: true,
  reportWallpaperRenderError: vi.fn(),
  wallpaper: null as null | {
    source: "remote";
    imageUrl: string;
    background: { src: string; src2x: string };
    mobileObjectPosition: string;
    desktopObjectPosition: string;
  },
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

vi.mock("@/contexts/WallpaperManifestContext", () => ({
  useResolvedWallpaper: () => mocks.wallpaper,
  useWallpaperManifest: () => ({
    currentDateKey: "2026-04-08",
    currentDateReady: mocks.currentDateReady,
    reportWallpaperRenderError: mocks.reportWallpaperRenderError,
    error: null,
    manifestByDate: {},
    isRefreshing: false,
    nextDateKey: "2026-04-09",
    refresh: vi.fn(),
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
    mocks.currentDateReady = true;
    mocks.wallpaper = null;
    mocks.reportWallpaperRenderError.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it.each([
    "guide",
    "quests",
    "campaigns",
    "companion",
    "profile",
  ] as CinematicPageBackgroundKey[])("renders the %s wallpaper preset", (preset) => {
    render(<CinematicPageBackground preset={preset} />);

    expect(screen.getByTestId("cinematic-background")).toHaveAttribute("data-cinematic-background", preset);
  });

  it("renders the cinematic gradient state when no live wallpaper is available", () => {
    render(<CinematicPageBackground preset="campaigns" />);

    expect(screen.getByTestId("cinematic-background")).toHaveAttribute("data-cinematic-source", "none");
    expect(screen.queryByTestId("cinematic-background-image-mobile")).not.toBeInTheDocument();
    expect(screen.queryByTestId("cinematic-background-image-desktop")).not.toBeInTheDocument();
  });

  it("uses the configured mobile and desktop focal points", () => {
    mocks.wallpaper = {
      source: "remote",
      imageUrl: "https://example.com/focal-wallpaper.png",
      background: {
        src: "https://example.com/focal-wallpaper.png",
        src2x: "https://example.com/focal-wallpaper.png",
      },
      mobileObjectPosition: cinematicPageBackgrounds.campaigns.mobileObjectPosition,
      desktopObjectPosition: cinematicPageBackgrounds.campaigns.desktopObjectPosition,
    };

    render(<CinematicPageBackground preset="campaigns" />);

    expect(screen.getByTestId("cinematic-background-image-mobile")).toHaveStyle({
      objectPosition: cinematicPageBackgrounds.campaigns.mobileObjectPosition,
    });
    expect(screen.getByTestId("cinematic-background-image-desktop")).toHaveStyle({
      objectPosition: cinematicPageBackgrounds.campaigns.desktopObjectPosition,
    });
  });

  it("uses the preset scrim recipe instead of a shared derived overlay", () => {
    render(<CinematicPageBackground preset="guide" />);

    const scrim = cinematicPageBackgrounds.guide.scrim;
    const background = screen.getByTestId("cinematic-background");
    const topScrim = background.querySelector('[data-cinematic-scrim="top"]') as HTMLElement | null;
    const centerScrim = background.querySelector('[data-cinematic-scrim="center"]') as HTMLElement | null;

    expect(topScrim).not.toBeNull();
    expect(centerScrim).not.toBeNull();

    expect(topScrim).toHaveStyle({
      background: `linear-gradient(180deg, hsl(var(--background) / ${scrim.topGradientTopAlpha}) 0%, hsl(var(--background) / ${scrim.topGradientMiddleAlpha}) 28%, hsl(var(--background) / ${scrim.topGradientBottomAlpha}) 100%)`,
    });
    expect(centerScrim).toHaveStyle({
      background: `radial-gradient(circle at ${scrim.centerAnchor}, transparent 0%, transparent ${scrim.centerClearStop}%, hsl(var(--background) / ${scrim.centerMidAlpha}) ${scrim.centerMidStop}%, hsl(var(--background) / ${scrim.centerEdgeAlpha}) 100%)`,
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

  it("uses a remote live wallpaper when one is available", () => {
    mocks.wallpaper = {
      source: "remote",
      imageUrl: "https://example.com/wallpaper.png",
      background: {
        src: "https://example.com/wallpaper.png",
        src2x: "https://example.com/wallpaper.png",
      },
      mobileObjectPosition: "41% 27%",
      desktopObjectPosition: "45% 31%",
    };

    render(<CinematicPageBackground preset="campaigns" />);

    expect(screen.getByTestId("cinematic-background")).toHaveAttribute("data-cinematic-source", "remote");
    expect(screen.getByTestId("cinematic-background-image-mobile")).toHaveAttribute(
      "src",
      "https://example.com/wallpaper.png",
    );
    expect(screen.getByTestId("cinematic-background-image-mobile")).toHaveStyle({
      objectPosition: "41% 27%",
    });
  });

  it("reports remote render failures back to the wallpaper provider", () => {
    mocks.wallpaper = {
      source: "remote",
      imageUrl: "https://example.com/broken-wallpaper.png",
      background: {
        src: "https://example.com/broken-wallpaper.png",
        src2x: "https://example.com/broken-wallpaper.png",
      },
      mobileObjectPosition: "41% 27%",
      desktopObjectPosition: "45% 31%",
    };

    render(<CinematicPageBackground preset="campaigns" />);

    fireEvent.error(screen.getByTestId("cinematic-background-image-mobile"));

    expect(mocks.reportWallpaperRenderError).toHaveBeenCalledWith(
      "campaigns",
      "https://example.com/broken-wallpaper.png",
    );
  });
});
