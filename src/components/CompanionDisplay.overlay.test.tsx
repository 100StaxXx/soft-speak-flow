import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  companion: {
    id: "companion-1",
    current_xp: 180,
    current_stage: 8,
    spirit_animal: "phoenix",
    core_element: "fire",
    favorite_color: "#FF6B35",
    vitality: 420,
    eye_color: "#FFFFFF",
    fur_color: "#AA5522",
    image_regenerations_used: 1,
    story_tone: "epic_adventure",
    cached_creature_name: "Nova",
  },
  activeEvent: {
    id: "wake-1",
    type: "wake" as const,
    intensity: "heroic" as const,
    durationMs: 2200,
    createdAt: Date.now(),
    element: "fire",
    stage: 8,
    reason: "Wake up",
  },
  resetProgress: vi.fn(),
  regenerate: vi.fn(),
  triggerManualEvolution: vi.fn(),
  hatchCompanion: {
    mutateAsync: vi.fn(),
  },
  isRegenerating: true,
}));

vi.mock("@/hooks/useCompanion", () => ({
  useCompanion: () => ({
    companion: mocks.companion,
    nextEvolutionXP: 240,
    progressToNext: 75,
    isLoading: false,
    canEvolve: false,
    triggerManualEvolution: mocks.triggerManualEvolution,
    isEvolutionBusy: false,
    requiresHatchSelection: false,
    hatchCompanion: mocks.hatchCompanion,
  }),
}));

vi.mock("@/hooks/useReferrals", () => ({
  useReferrals: () => ({
    unlockedSkins: [],
  }),
}));

vi.mock("@/hooks/useCompanionHealth", () => ({
  useCompanionHealth: () => ({
    health: {
      moodState: "happy",
      hunger: 0,
      happiness: 100,
      isAlive: true,
      recoveryProgress: 0,
      isNeglected: false,
      neglectedImageUrl: null,
    },
    needsWelcomeBack: false,
  }),
}));

vi.mock("@/hooks/useCompanionVisualState", () => ({
  useCompanionVisualState: () => ({
    cssStyles: {},
    animationClass: "",
    care: {
      dormancy: {
        isDormant: true,
        recoveryDays: 2,
        daysUntilWake: 3,
        daysUntilDormancy: 1,
      },
    },
    evolutionPath: {
      path: null,
      isLocked: false,
    },
    isDormant: true,
    hasDormancyWarning: false,
  }),
}));

vi.mock("@/hooks/useCompanionRegenerate", () => ({
  useCompanionRegenerate: () => ({
    regenerate: mocks.regenerate,
    isRegenerating: mocks.isRegenerating,
    maxRegenerations: 3,
    generationPhase: "idle",
    retryCount: 0,
    resetProgress: mocks.resetProgress,
  }),
}));

vi.mock("@/hooks/useCompanionWakeUp", () => ({
  useCompanionWakeUp: () => ({
    showCelebration: false,
    dismissCelebration: vi.fn(),
    companionName: null,
    companionImageUrl: null,
    dormantImageUrl: null,
    bondLevel: 0,
  }),
}));

vi.mock("@/hooks/useEpicRewards", () => ({
  useEpicRewards: () => ({
    equippedRewards: {},
  }),
}));

vi.mock("@/contexts/EvolutionContext", () => ({
  useEvolution: () => undefined,
}));

vi.mock("@/hooks/useMotionProfile", () => ({
  useMotionProfile: () => ({
    profile: "balanced" as const,
    capabilities: {
      allowParallax: true,
      maxParticles: 8,
      allowBackgroundAnimation: true,
      enableTabTransitions: true,
      hapticsMode: "web" as const,
    },
    signals: {
      prefersReducedMotion: false,
      isLowPowerMode: false,
      isBackgrounded: false,
    },
  }),
}));

vi.mock("@/contexts/CompanionMotionContext", () => ({
  useCompanionMotionSafe: () => ({
    activeEvent: mocks.activeEvent,
    triggerEvent: vi.fn(),
    clearEvent: vi.fn(),
  }),
}));

vi.mock("@/components/CompanionSkeleton", () => ({
  CompanionSkeleton: () => <div>Loading companion</div>,
}));

vi.mock("@/components/AttributeTooltip", () => ({
  AttributeTooltip: () => null,
}));

vi.mock("@/components/CompanionBadge", () => ({
  CompanionBadge: () => <div>Badge</div>,
}));

vi.mock("@/components/companion/CompanionBondBadge", () => ({
  CompanionBondBadge: () => <div>Bond</div>,
}));

vi.mock("@/components/WelcomeBackModal", () => ({
  WelcomeBackModal: () => null,
}));

vi.mock("@/components/CompanionRegenerateDialog", () => ({
  CompanionRegenerateDialog: () => null,
}));

vi.mock("@/components/companion/EvolveButton", () => ({
  EvolveButton: () => null,
}));

vi.mock("@/components/companion/EvolutionPathBadge", () => ({
  EvolutionPathBadge: () => null,
}));

vi.mock("@/components/companion/CompanionDialogue", () => ({
  CompanionDialogue: () => <div>Dialogue</div>,
}));

vi.mock("@/components/companion/WakeUpCelebration", () => ({
  WakeUpCelebration: () => null,
}));

vi.mock("@/components/CompanionAttributes", () => ({
  CompanionAttributes: () => <div>Attributes</div>,
}));

vi.mock("@/components/CompanionPersonalization", () => ({
  CompanionPersonalization: () => null,
}));

vi.mock("@/lib/companionName", () => ({
  resolveCompanionName: vi.fn().mockResolvedValue("Nova"),
}));

vi.mock("@/lib/companionAssetResolver", () => ({
  resolveCompanionVisualAssetUrl: vi.fn().mockReturnValue("/companion.png"),
}));

import { CompanionDisplay } from "./CompanionDisplay";

describe("CompanionDisplay overlay stack", () => {
  beforeEach(() => {
    mocks.resetProgress.mockClear();
    mocks.regenerate.mockClear();
    mocks.triggerManualEvolution.mockClear();
    mocks.hatchCompanion.mutateAsync.mockClear();
    mocks.isRegenerating = true;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("keeps backdrop and foreground motion planes active alongside regeneration and dormant overlays", async () => {
    render(<CompanionDisplay />);

    const surface = screen.getByTestId("companion-motion-surface");
    expect(await screen.findByText("Nova")).toBeInTheDocument();
    expect(within(surface).getByTestId("companion-motion-surface-content")).toBeInTheDocument();
    expect(surface.querySelector('[data-motion-plane="backdrop"]')).not.toBeNull();
    expect(surface.querySelector('[data-motion-plane="foreground"]')).not.toBeNull();
    expect(surface.querySelector('[data-overlay-layer="event-beam"]')).not.toBeNull();

    expect(screen.getByLabelText("Refreshing companion look")).toBeInTheDocument();
    expect(screen.getByText("Dormant")).toBeInTheDocument();
    expect(
      screen.getByText("Your companion has fallen into a deep sleep"),
    ).toBeInTheDocument();
  });

  it("starts subtle idle drift once the companion art has loaded", async () => {
    mocks.isRegenerating = false;

    render(<CompanionDisplay />);

    const shell = screen.getByTestId("companion-image-shell");
    const image = screen.getByAltText(/companion at level 8/i);

    expect(shell).toHaveAttribute("data-companion-idle-motion", "inactive");

    fireEvent.load(image);

    await waitFor(() => {
      expect(shell).toHaveAttribute("data-companion-idle-motion", "active");
    });

    expect(shell).toHaveClass("animate-companion-idle-drift");
  });
});
