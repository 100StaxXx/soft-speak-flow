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
  canEvolve: false,
  requiresHatchSelection: false,
  isRegenerating: true,
  guidedStep: null as string | null,
  isEvolvingLoading: false,
}));

vi.mock("@/hooks/useCompanion", () => ({
  useCompanion: () => ({
    companion: mocks.companion,
    nextEvolutionXP: 240,
    progressToNext: 75,
    isLoading: false,
    canEvolve: mocks.canEvolve,
    triggerManualEvolution: mocks.triggerManualEvolution,
    isEvolutionBusy: false,
    requiresHatchSelection: mocks.requiresHatchSelection,
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
  useEvolution: () => ({
    isEvolvingLoading: mocks.isEvolvingLoading,
    setIsEvolvingLoading: vi.fn(),
    onEvolutionComplete: null,
    setOnEvolutionComplete: vi.fn(),
  }),
}));

vi.mock("@/hooks/usePostOnboardingMentorGuidance", () => ({
  usePostOnboardingMentorGuidance: () => ({
    currentStep: mocks.guidedStep,
  }),
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

vi.mock("@/components/ui/dialog", () => ({
  Dialog: ({ open, children }: { open?: boolean; children: React.ReactNode }) =>
    open ? <>{children}</> : null,
  DialogContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogTitle: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock("@/components/companion/EvolveButton", () => ({
  EvolveButton: ({
    onEvolve,
    actionLabel = "EVOLVE",
    isEvolving,
  }: {
    onEvolve: () => void;
    actionLabel?: string;
    isEvolving: boolean;
  }) => (
    <button type="button" onClick={onEvolve} disabled={isEvolving}>
      {actionLabel}
    </button>
  ),
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
  CompanionPersonalization: ({ mode }: { mode?: string }) =>
    mode === "hatch" ? <div>Hatch chooser</div> : null,
}));

vi.mock("@/lib/companionName", () => ({
  resolveCompanionName: vi.fn().mockResolvedValue("Nova"),
}));

vi.mock("@/lib/companionAssetResolver", () => ({
  resolveCompanionVisualAssetUrl: vi.fn().mockImplementation((companion: {
    current_stage?: number | null;
    core_element?: string | null;
    current_image_url?: string | null;
  }) => (
    (companion.current_stage ?? 0) <= 0
      ? `/companion-eggs/egg__t0_egg__normal__${String(companion.core_element ?? "fire").toLowerCase()}.png`
      : (companion.current_image_url ?? "/companion.png")
  )),
}));

import { CompanionDisplay } from "./CompanionDisplay";

describe("CompanionDisplay overlay stack", () => {
  beforeEach(() => {
    window.history.pushState({}, "", "/companion");
    mocks.resetProgress.mockClear();
    mocks.regenerate.mockClear();
    mocks.triggerManualEvolution.mockClear();
    mocks.hatchCompanion.mutateAsync.mockClear();
    mocks.canEvolve = false;
    mocks.requiresHatchSelection = false;
    mocks.isRegenerating = true;
    mocks.guidedStep = null;
    mocks.isEvolvingLoading = false;
    mocks.companion = {
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
    };
  });

  afterEach(() => {
    window.history.pushState({}, "", "/");
    vi.clearAllMocks();
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

  it("shows a direct HATCH action for preset-backed stage 0 eggs", async () => {
    mocks.canEvolve = true;
    mocks.companion = {
      ...mocks.companion,
      current_stage: 0,
      current_xp: 14,
      preset_id: "dragon",
      spirit_animal: "Dragon",
      cached_creature_name: null,
    };

    render(<CompanionDisplay />);

    fireEvent.click(screen.getByRole("button", { name: "HATCH" }));

    expect(mocks.triggerManualEvolution).toHaveBeenCalledTimes(1);
    expect(screen.queryByText("Hatch chooser")).not.toBeInTheDocument();
  });

  it("keeps the hatch chooser for legacy presetless eggs", async () => {
    mocks.canEvolve = true;
    mocks.requiresHatchSelection = true;
    mocks.companion = {
      ...mocks.companion,
      current_stage: 0,
      current_xp: 14,
      preset_id: null,
      spirit_animal: "Egg",
      cached_creature_name: null,
    };

    render(<CompanionDisplay />);

    fireEvent.click(screen.getByRole("button", { name: "HATCH" }));

    expect(mocks.triggerManualEvolution).not.toHaveBeenCalled();
    expect(screen.getByText("Hatch chooser")).toBeInTheDocument();
  });

  it("renders the tutorial hatch step as a stage 0 egg even when live companion data is already stage 1", async () => {
    mocks.guidedStep = "evolve_companion";
    mocks.canEvolve = false;
    mocks.companion = {
      ...mocks.companion,
      current_stage: 1,
      current_xp: 14,
      core_element: "fire",
      current_image_url: "/companion-presets/fox/t1_youth/normal/fox__t1_youth__normal__fire.png",
      initial_image_url: "/companion-eggs/egg__t0_egg__normal__fire.png",
      preset_id: "fox",
      spirit_animal: "Fox",
      cached_creature_name: "Ignisyl",
    };

    render(<CompanionDisplay />);

    expect(screen.getByText("Fire Egg")).toBeInTheDocument();
    expect(screen.queryByText("Ignisyl")).not.toBeInTheDocument();
    expect(screen.getAllByText("Ready to evolve to Level 1").length).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: "HATCH" })).toBeInTheDocument();

    const image = screen.getByAltText(/egg companion at level 0/i);
    expect(image).toHaveAttribute(
      "src",
      expect.stringContaining("/companion-eggs/egg__t0_egg__normal__fire.png"),
    );
  });

  it("returns to the normal stage 1 reveal after the tutorial advances past the hatch prompt", async () => {
    mocks.guidedStep = "post_evolution_companion_intro";
    mocks.companion = {
      ...mocks.companion,
      current_stage: 1,
      current_xp: 14,
      core_element: "fire",
      current_image_url: "/companion-presets/fox/t1_youth/normal/fox__t1_youth__normal__fire.png",
      preset_id: "fox",
      spirit_animal: "Fox",
      cached_creature_name: "Nova",
    };

    render(<CompanionDisplay />);

    expect(await screen.findByText("Nova")).toBeInTheDocument();
    expect(screen.queryByText("Fire Egg")).not.toBeInTheDocument();
    const image = screen.getByAltText(/hatchling companion at level 1/i);
    expect(image).toBeInTheDocument();
    expect(image).toHaveAttribute("data-companion-image-fit", "portrait");
  });
});
