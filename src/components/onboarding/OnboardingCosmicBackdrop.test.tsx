import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  OnboardingCosmicBackdrop,
  resolveOnboardingBackdropPreset,
} from "./OnboardingCosmicBackdrop";
import { useMotionProfile } from "@/hooks/useMotionProfile";

vi.mock("@/hooks/useMotionProfile", () => ({
  useMotionProfile: vi.fn(),
}));

const mockedUseMotionProfile = vi.mocked(useMotionProfile);

const defaultMotionProfile = {
  profile: "enhanced" as const,
  capabilities: {
    allowParallax: true,
    maxParticles: 24,
    allowBackgroundAnimation: true,
    enableTabTransitions: true,
    hapticsMode: "web" as const,
  },
  signals: {
    prefersReducedMotion: false,
    isLowPowerMode: false,
    isBackgrounded: false,
  },
};

describe("OnboardingCosmicBackdrop", () => {
  beforeEach(() => {
    mockedUseMotionProfile.mockReturnValue(defaultMotionProfile);
  });

  it("resolves stage presets to abstract cosmic backdrop values", () => {
    expect(resolveOnboardingBackdropPreset("prologue")).toMatchObject({
      ringScale: 0.92,
      particleDensity: 12,
      accentStrength: 0.2,
    });
    expect(resolveOnboardingBackdropPreset("calculating")).toMatchObject({
      ringScale: 1.16,
      ringOpacity: 0.34,
      particleDensity: 16,
    });
    expect(resolveOnboardingBackdropPreset("journey-begins")).toMatchObject({
      ringScale: 1.1,
      ringSpread: 0.22,
      vignetteOpacity: 0.54,
    });
  });

  it("renders faction tint only when a faction is provided", () => {
    const { rerender } = render(<OnboardingCosmicBackdrop stage="questionnaire" />);
    expect(screen.queryByTestId("onb-faction-tint")).not.toBeInTheDocument();

    rerender(<OnboardingCosmicBackdrop stage="questionnaire" faction="starfall" />);
    expect(screen.getByTestId("onb-faction-tint")).toBeInTheDocument();
  });

  it("removes animated classes when reduced motion is active", () => {
    mockedUseMotionProfile.mockReturnValue({
      ...defaultMotionProfile,
      profile: "reduced",
      capabilities: {
        ...defaultMotionProfile.capabilities,
        allowBackgroundAnimation: false,
      },
      signals: {
        ...defaultMotionProfile.signals,
        prefersReducedMotion: true,
      },
    });

    const { container } = render(<OnboardingCosmicBackdrop stage="calculating" />);
    expect(screen.queryByTestId("onb-photo-backdrop")).not.toBeInTheDocument();
    expect(container.querySelectorAll(".onb-animated")).toHaveLength(0);
  });

  it("renders the abstract ring layers instead of a photo backdrop", () => {
    render(<OnboardingCosmicBackdrop stage="journey-begins" />);

    expect(screen.queryByTestId("onb-photo-backdrop")).not.toBeInTheDocument();
    expect(document.querySelectorAll(".onb-cosmic-ring")).toHaveLength(4);
    expect(document.querySelectorAll(".onb-cosmic-particle").length).toBeGreaterThan(0);
  });
});
