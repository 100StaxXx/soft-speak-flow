import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  companion: {
    id: "companion-1",
    current_xp: 180,
    current_stage: 8,
    current_image_url: "/companion-presets/phoenix/t2_guardian/normal/phoenix__t2_guardian__normal__fire.png",
    current_image_focal_x: null as number | null,
    current_image_focal_y: null as number | null,
    initial_image_url: null as string | null,
    preset_id: "phoenix",
    spirit_animal: "phoenix",
    core_element: "fire",
    favorite_color: "#FF6B35",
    vitality: 420,
    eye_color: "#FFFFFF",
    fur_color: "#AA5522",
    image_regenerations_used: 1,
    story_tone: "epic_adventure",
    cached_creature_name: "Nova",
    launcher_image_url: null as string | null,
    launcher_image_source_url: null as string | null,
    launcher_image_focal_x: null as number | null,
    launcher_image_focal_y: null as number | null,
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
  isDormant: true,
  guidedStep: null as string | null,
  isPreHatchCompanionStep: false,
  isEvolvingLoading: false,
  pendingEvolutionReveal: null as null | {
    status: "preparing" | "ready";
    companionId: string;
    evolutionId?: string | null;
    previousStage: number;
    newStage: number;
    previousImageUrl: string;
    newImageUrl: string;
    animationVideoUrl?: string | null;
    presetId?: string | null;
    element?: string | null;
  },
  expressionState: {
    mood: "calm" as "calm" | "happy" | "excited",
    variant: 2,
    reason: "stable",
    isEventDriven: false,
  },
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
    isDormant: mocks.isDormant,
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
    pendingEvolutionReveal: mocks.pendingEvolutionReveal,
    setPendingEvolutionReveal: vi.fn(),
    onEvolutionComplete: null,
    setOnEvolutionComplete: vi.fn(),
  }),
}));

vi.mock("@/hooks/usePostOnboardingMentorGuidance", () => ({
  usePostOnboardingMentorGuidance: () => ({
    currentStep: mocks.guidedStep,
    isPreHatchCompanionStep: mocks.isPreHatchCompanionStep,
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

vi.mock("@/hooks/useCompanionExpressionState", () => ({
  useCompanionExpressionState: () => ({
    mood: mocks.expressionState.mood,
    variant: mocks.expressionState.variant,
    reason: mocks.expressionState.reason,
    isEventDriven: mocks.expressionState.isEventDriven,
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
    loadingLabel = "EVOLVING...",
    isEvolving,
  }: {
    onEvolve: () => void;
    actionLabel?: string;
    loadingLabel?: string;
    isEvolving: boolean;
  }) => (
    <button type="button" onClick={onEvolve} disabled={isEvolving}>
      {isEvolving ? loadingLabel : actionLabel}
    </button>
  ),
}));

vi.mock("@/components/companion/EvolutionPathBadge", () => ({
  EvolutionPathBadge: () => null,
}));

vi.mock("@/components/companion/CompanionDialogue", () => ({
  CompanionDialogue: () => <div>Dialogue Panel</div>,
}));

vi.mock("@/components/companion/WakeUpCelebration", () => ({
  WakeUpCelebration: () => null,
}));

vi.mock("@/components/CompanionAttributes", () => ({
  CompanionAttributes: () => <div data-testid="companion-attributes">Attributes</div>,
}));

vi.mock("@/components/CompanionStatAnalysisSurface", () => ({
  CompanionStatAnalysisSurface: ({
    open,
  }: {
    open: boolean;
  }) => (open ? <div data-testid="companion-stats-analysis-surface">Stats Analysis Surface</div> : null),
}));

vi.mock("@/components/CompanionPersonalization", () => ({
  CompanionPersonalization: ({ mode }: { mode?: string }) =>
    mode === "hatch" ? <div>Hatch chooser</div> : null,
}));

vi.mock("@/lib/companionName", () => ({
  getStoredCompanionCustomName: vi.fn().mockReturnValue(null),
  resolveCompanionName: vi.fn().mockResolvedValue("Nova"),
}));

vi.mock("@/lib/companionAssetResolver", () => ({
  getUniversalEggAssetUrl: vi.fn().mockImplementation((element: string) => (
    `/companion-eggs/v2/egg__t0_egg__normal__${String(element ?? "fire").toLowerCase()}.webp`
  )),
  resolveCompanionExpressiveAssetUrl: vi.fn().mockImplementation((companion: {
    current_stage?: number | null;
    core_element?: string | null;
  }, options: { mood: string; variant: number }) => (
    (companion.current_stage ?? 0) <= 0
      ? null
      : `/companion-presets/phoenix/t2_guardian/${options.mood}/phoenix__t2_guardian__${options.mood}__v${options.variant}__${String(companion.core_element ?? "fire").toLowerCase()}.png`
  )),
  resolveCompanionVisualAssetUrl: vi.fn().mockImplementation((companion: {
    current_stage?: number | null;
    core_element?: string | null;
    current_image_url?: string | null;
  }) => (
    (companion.current_stage ?? 0) <= 0
      ? `/companion-eggs/v2/egg__t0_egg__normal__${String(companion.core_element ?? "fire").toLowerCase()}.webp`
      : (companion.current_image_url ?? "/companion.png")
  )),
}));

import { CompanionDisplay } from "./CompanionDisplay";
import { resolveCompanionExpressiveAssetUrl } from "@/lib/companionAssetResolver";
import { COMPANION_EVOLUTION_REVEAL_REQUESTED_EVENT } from "@/lib/companionEvolutionEvents";
import { resolveCompanionName } from "@/lib/companionName";

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
    mocks.isDormant = true;
    mocks.guidedStep = null;
    mocks.isPreHatchCompanionStep = false;
    mocks.isEvolvingLoading = false;
    mocks.pendingEvolutionReveal = null;
    mocks.companion = {
      id: "companion-1",
      current_xp: 180,
      current_stage: 8,
      current_image_url: "/companion-presets/phoenix/t2_guardian/normal/phoenix__t2_guardian__normal__fire.png",
      current_image_focal_x: null,
      current_image_focal_y: null,
      initial_image_url: null,
      preset_id: "phoenix",
      spirit_animal: "phoenix",
      core_element: "fire",
      favorite_color: "#FF6B35",
      vitality: 420,
      eye_color: "#FFFFFF",
      fur_color: "#AA5522",
      image_regenerations_used: 1,
      story_tone: "epic_adventure",
      cached_creature_name: "Nova",
      launcher_image_url: null,
      launcher_image_source_url: null,
      launcher_image_focal_x: null,
      launcher_image_focal_y: null,
    };
    mocks.expressionState = {
      mood: "calm",
      variant: 2,
      reason: "stable",
      isEventDriven: false,
    };
  });

  afterEach(() => {
    window.history.pushState({}, "", "/");
    vi.clearAllMocks();
  });

  it("keeps backdrop and foreground motion planes active alongside regeneration and dormant overlays", async () => {
    render(<CompanionDisplay />);

    const surface = screen.getByTestId("companion-motion-surface");
    const outerShell = screen.getByTestId("companion-outer-shell");
    expect(await screen.findByText("Nova")).toBeInTheDocument();
    expect(screen.getByTestId("companion-visual-stage")).toHaveTextContent("Stage 2 • Initiate");
    expect(screen.getByTestId("companion-level-chip")).toHaveTextContent("Level 8");
    expect(screen.getByText("Bond")).toBeInTheDocument();
    expect(screen.getByText("Dialogue Panel")).toBeInTheDocument();
    expect(outerShell.className).toContain("bg-white/[0.03]");
    expect(outerShell.className).toContain("backdrop-blur-none");
    expect(outerShell.className).toContain("border-white/10");
    expect(outerShell.className).toContain("shadow-none");
    expect(screen.getByTestId("companion-shell-gradient-overlay").className).toContain("opacity-[0.08]");
    expect(screen.getByTestId("companion-shell-radial-top").className).toContain("opacity-[0.04]");
    expect(screen.getByTestId("companion-shell-radial-bottom").className).toContain("opacity-[0.04]");
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

  it("renders the current companion page image instead of launcher-only FAB art", async () => {
    mocks.isDormant = false;
    mocks.isRegenerating = false;
    mocks.companion = {
      ...mocks.companion,
      preset_id: null,
      current_image_url: "https://assets.example.com/scene-backed-companion.png",
      current_image_focal_x: 0.32,
      current_image_focal_y: 0.68,
      launcher_image_url: "https://assets.example.com/launcher-cutout-source.png",
      launcher_image_source_url: "https://assets.example.com/scene-backed-companion.png",
      launcher_image_focal_x: 0.5,
      launcher_image_focal_y: 0.5,
    };
    vi.mocked(resolveCompanionExpressiveAssetUrl).mockReturnValueOnce(null);

    render(<CompanionDisplay />);

    await screen.findByText("Nova");

    const image = screen.getByAltText(/companion at level 8/i);
    expect(image).toHaveAttribute("src", "https://assets.example.com/scene-backed-companion.png");
    expect(image).not.toHaveAttribute("src", "https://assets.example.com/launcher-cutout-source.png");
    expect(image).toHaveStyle({ objectPosition: "32% 68%" });
    expect(image.style.transform).toBe("");
  });

  it("renders the stats analysis trigger directly below the stat grid", async () => {
    render(<CompanionDisplay />);

    await screen.findByText("Nova");

    const attributes = screen.getByTestId("companion-attributes");
    const trigger = screen.getByTestId("companion-stats-analysis-trigger");

    expect(attributes.compareDocumentPosition(trigger) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(trigger).toHaveTextContent("Analyze My Stats");
  });

  it("opens the stats analysis surface from the companion card", async () => {
    render(<CompanionDisplay />);

    await screen.findByText("Nova");
    fireEvent.click(screen.getByTestId("companion-stats-analysis-trigger"));

    expect(screen.getByTestId("companion-stats-analysis-surface")).toBeInTheDocument();
  });

  it("starts subtle idle drift once the companion art has loaded", async () => {
    mocks.isRegenerating = false;
    mocks.isDormant = false;

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

  it("uses expressive portraits when available and exposes the active expression metadata", async () => {
    mocks.isRegenerating = false;
    mocks.isDormant = false;
    mocks.expressionState = {
      mood: "happy",
      variant: 4,
      reason: "positive-mood",
      isEventDriven: false,
    };

    render(<CompanionDisplay />);
    await screen.findByText("Nova");

    const shell = screen.getByTestId("companion-image-shell");

    expect(shell).toHaveAttribute("data-companion-expression-mood", "happy");
    expect(shell).toHaveAttribute("data-companion-expression-variant", "4");
    expect(shell).toHaveAttribute("data-companion-expression-reason", "positive-mood");
    expect(vi.mocked(resolveCompanionExpressiveAssetUrl)).toHaveBeenCalledWith(
      expect.objectContaining({
        current_stage: 8,
        preset_id: "phoenix",
      }),
      {
        mood: "happy",
        variant: 4,
      },
    );
  });

  it("falls back to the normal portrait when an expressive portrait is missing", async () => {
    mocks.isRegenerating = false;
    mocks.isDormant = false;
    mocks.expressionState = {
      mood: "excited",
      variant: 3,
      reason: "recent-reward-event",
      isEventDriven: true,
    };

    render(<CompanionDisplay />);
    await screen.findByText("Nova");

    const image = screen.getByAltText(/companion at level 8/i);

    fireEvent.error(image);

    await waitFor(() => {
      expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    });
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
    expect(mocks.triggerManualEvolution).toHaveBeenCalledWith(
      expect.objectContaining({
        hatchAnimationSnapshot: expect.objectContaining({
          previousImageUrl: expect.any(String),
          element: "fire",
        }),
      }),
    );
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
      current_image_url: null,
      initial_image_url: null,
      cached_creature_name: null,
    };

    render(<CompanionDisplay />);

    fireEvent.click(screen.getByRole("button", { name: "HATCH" }));

    expect(mocks.triggerManualEvolution).not.toHaveBeenCalled();
    expect(screen.getByText("Hatch chooser")).toBeInTheDocument();
  });

  it("forces stale stage 1 companion data back to a stage 0 egg during the companion intro step", async () => {
    mocks.guidedStep = "companion_tab_intro";
    mocks.isPreHatchCompanionStep = true;
    mocks.companion = {
      ...mocks.companion,
      current_stage: 1,
      current_xp: 14,
      core_element: "fire",
      current_image_url: "/companion-presets/fox/t1_youth/normal/fox__t1_youth__normal__fire.png",
      initial_image_url: "/companion-eggs/egg__t0_egg__normal__fire.png",
      preset_id: "fox",
      spirit_animal: "Fox",
      cached_creature_name: "Nova",
    };

    render(<CompanionDisplay />);

    expect(screen.getByText("Ember Egg")).toBeInTheDocument();
    expect(screen.queryByText("Nova")).not.toBeInTheDocument();
    expect(screen.getAllByText("Ready to evolve to Level 1").length).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: "HATCH" })).toBeInTheDocument();
    expect(screen.getByTestId("companion-visual-stage")).toHaveTextContent("Stage 0 • Egg");
    expect(screen.getByTestId("companion-level-chip")).toHaveTextContent("Level 0");

    const image = screen.getByAltText(/egg companion at level 0/i);
    expect(image).toHaveAttribute(
      "src",
      expect.stringContaining("/companion-eggs/v2/egg__t0_egg__normal__fire.webp"),
    );
  });

  it("keeps the evolve tutorial step visually pre-hatch until hatch actually starts", async () => {
    mocks.guidedStep = "evolve_companion";
    mocks.isPreHatchCompanionStep = true;
    mocks.companion = {
      ...mocks.companion,
      current_stage: 1,
      current_xp: 14,
      core_element: "fire",
      current_image_url: "/companion-presets/fox/t1_youth/normal/fox__t1_youth__normal__fire.png",
      initial_image_url: "/companion-eggs/egg__t0_egg__normal__fire.png",
      preset_id: "fox",
      spirit_animal: "Fox",
      cached_creature_name: "Nova",
    };

    render(<CompanionDisplay />);

    expect(screen.getByText("Ember Egg")).toBeInTheDocument();
    expect(screen.queryByText("Nova")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "HATCH" })).toBeInTheDocument();
  });

  it("renders the normal stage 1 reveal after hatch succeeds", async () => {
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
    expect(screen.queryByText("Ember Egg")).not.toBeInTheDocument();
    expect(screen.getByTestId("companion-visual-stage")).toHaveTextContent("Stage 1 • Hatchling");
    expect(screen.getByTestId("companion-level-chip")).toHaveTextContent("Level 1");
    expect(screen.getByText(/XP to Level 2/)).toBeInTheDocument();
    const image = screen.getByAltText(/hatchling companion at level 1/i);
    expect(image).toBeInTheDocument();
    expect(image).toHaveAttribute("data-companion-image-fit", "portrait");
  });

  it("holds the previous companion look while a claimed evolution reveal is preparing", async () => {
    mocks.isRegenerating = false;
    mocks.isDormant = false;
    mocks.companion = {
      ...mocks.companion,
      current_stage: 5,
      current_xp: 260,
      current_image_url: "https://example.com/stage-5.png",
      cached_creature_name: "Astra",
    };
    mocks.pendingEvolutionReveal = {
      status: "preparing",
      companionId: "companion-1",
      evolutionId: "evo-5",
      previousStage: 4,
      newStage: 5,
      previousImageUrl: "https://example.com/stage-4.png",
      newImageUrl: "https://example.com/stage-5.png",
      animationVideoUrl: null,
      presetId: "phoenix",
      element: "fire",
    };
    vi.mocked(resolveCompanionExpressiveAssetUrl).mockReturnValueOnce(null);

    render(<CompanionDisplay />);

    expect(await screen.findByTestId("companion-level-chip")).toHaveTextContent("Level 4");
    const image = screen.getByAltText(/companion at level 4/i);
    expect(image).toHaveAttribute("src", "https://example.com/stage-4.png");
    expect(screen.getByRole("button", { name: "PREPARING..." })).toBeDisabled();
    expect(resolveCompanionName).not.toHaveBeenCalled();
  });

  it("dispatches a reveal request when the held evolution is ready", async () => {
    mocks.isRegenerating = false;
    mocks.isDormant = false;
    mocks.companion = {
      ...mocks.companion,
      current_stage: 5,
      current_xp: 260,
      current_image_url: "https://example.com/stage-5.png",
    };
    mocks.pendingEvolutionReveal = {
      status: "ready",
      companionId: "companion-1",
      evolutionId: "evo-5",
      previousStage: 4,
      newStage: 5,
      previousImageUrl: "https://example.com/stage-4.png",
      newImageUrl: "https://example.com/stage-5.png",
      animationVideoUrl: "https://example.com/evolution.mp4",
      presetId: "phoenix",
      element: "fire",
    };
    vi.mocked(resolveCompanionExpressiveAssetUrl).mockReturnValueOnce(null);
    const dispatchSpy = vi.spyOn(window, "dispatchEvent");

    render(<CompanionDisplay />);

    fireEvent.click(await screen.findByRole("button", { name: "REVEAL" }));

    expect(dispatchSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        type: COMPANION_EVOLUTION_REVEAL_REQUESTED_EVENT,
        detail: {
          companionId: "companion-1",
          stage: 5,
        },
      }),
    );
    dispatchSpy.mockRestore();
  });

  it("shows max-level progression and final visual stage consistently", async () => {
    mocks.companion = {
      ...mocks.companion,
      current_stage: 100,
      current_xp: 38000,
    };

    render(<CompanionDisplay />);

    expect(await screen.findByText("Nova")).toBeInTheDocument();
    expect(screen.getByTestId("companion-visual-stage")).toHaveTextContent("Stage 7 • Ascended");
    expect(screen.getByTestId("companion-level-chip")).toHaveTextContent("Level 100");
    expect(screen.getByText("Level 100 maxed")).toBeInTheDocument();
  });
});
