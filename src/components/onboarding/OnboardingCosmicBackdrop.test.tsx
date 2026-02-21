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

  it("resolves stage presets with stronger calculating rings than destiny", () => {
    const destiny = resolveOnboardingBackdropPreset("destiny");
    const calculating = resolveOnboardingBackdropPreset("calculating");

    expect(calculating.ringOpacity).toBeGreaterThan(destiny.ringOpacity);
    expect(calculating.ringScale).toBeGreaterThan(destiny.ringScale);
    expect(calculating.particleDensity).toBeGreaterThan(destiny.particleDensity);
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
    expect(container.querySelectorAll(".onb-cosmic-ring").length).toBeGreaterThan(0);
    expect(container.querySelectorAll(".onb-animated")).toHaveLength(0);
  });
});
