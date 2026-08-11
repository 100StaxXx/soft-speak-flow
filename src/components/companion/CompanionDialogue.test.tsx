import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const getPublicUrlMock = vi.hoisted(() =>
  vi.fn((assetPath: string) => ({
    data: {
      publicUrl: `https://example.supabase.co/storage/v1/object/public/companion-presets/${assetPath}`,
    },
  })),
);

const mocks = vi.hoisted(() => ({
  dialogue: {
    greeting: "Primary greeting",
    bondDialogue: "Secondary bond line",
    shimmerType: "none" as ("none" | "green" | "blue" | "purple" | "red" | "gold"),
    microTitle: null as string | null,
    outcomeTag: "basic_checkin" as ("basic_checkin" | "momentum_boost" | "clarity_prompt" | "mystery_event" | "reset_flow" | "turning_point"),
    tonePack: "soft" as ("soft" | "playful" | "witty_sassy"),
    bucketKey: "base_greetings" as ("base_greetings" | "growth_moments" | "clarity_moments" | "mystery_moments" | "repair_moments" | "legendary_moments" | "recovery_moments" | "critical_gentle_moments"),
    lineId: "soft.base_greetings.01",
    dialogueMood: "content" as const,
    isLoading: false,
  },
  companion: {
    id: "companion-1",
    current_stage: 4,
    current_image_url: null as string | null,
    dormant_image_url: null as string | null,
    neglected_image_url: null as string | null,
    neglected_image_focal_x: null as number | null,
    neglected_image_focal_y: null as number | null,
    dormant_image_focal_x: null as number | null,
    dormant_image_focal_y: null as number | null,
    current_image_focal_x: 0.5 as number | null,
    current_image_focal_y: 0.5 as number | null,
    preset_id: null as string | null,
    core_element: "fire",
    cached_creature_name: "Wolf" as string | null,
    spirit_animal: "Wolf",
    progressToNext: 50,
    canEvolve: false,
  },
  health: {
    moodState: "happy" as const,
    hunger: 0,
    happiness: 100,
    isAlive: true,
    recoveryProgress: 0,
    isNeglected: false,
    neglectedImageUrl: null as string | null,
    neglectedImageFocalX: null as number | null,
    neglectedImageFocalY: null as number | null,
  },
  isDormant: false,
  expressionState: {
    mood: "calm" as "calm" | "happy" | "excited",
    variant: 2,
    reason: "stable",
    isEventDriven: false,
  },
  talkPopup: {
    dismiss: vi.fn(),
    show: vi.fn(),
  },
}));

vi.mock("@/hooks/useCompanionDialogue", () => ({
  useCompanionDialogue: () => ({
    greeting: mocks.dialogue.greeting,
    bondDialogue: mocks.dialogue.bondDialogue,
    shimmerType: mocks.dialogue.shimmerType,
    microTitle: mocks.dialogue.microTitle,
    outcomeTag: mocks.dialogue.outcomeTag,
    tonePack: mocks.dialogue.tonePack,
    bucketKey: mocks.dialogue.bucketKey,
    lineId: mocks.dialogue.lineId,
    dialogueMood: mocks.dialogue.dialogueMood,
    isLoading: mocks.dialogue.isLoading,
  }),
}));

vi.mock("@/hooks/useCompanion", () => ({
  useCompanion: () => ({
    companion: {
      id: mocks.companion.id,
      current_stage: mocks.companion.current_stage,
      current_image_url: mocks.companion.current_image_url,
      dormant_image_url: mocks.companion.dormant_image_url,
      neglected_image_url: mocks.companion.neglected_image_url,
      neglected_image_focal_x: mocks.companion.neglected_image_focal_x,
      neglected_image_focal_y: mocks.companion.neglected_image_focal_y,
      dormant_image_focal_x: mocks.companion.dormant_image_focal_x,
      dormant_image_focal_y: mocks.companion.dormant_image_focal_y,
      current_image_focal_x: mocks.companion.current_image_focal_x,
      current_image_focal_y: mocks.companion.current_image_focal_y,
      preset_id: mocks.companion.preset_id,
      core_element: mocks.companion.core_element,
      cached_creature_name: mocks.companion.cached_creature_name,
      spirit_animal: mocks.companion.spirit_animal,
    },
    progressToNext: mocks.companion.progressToNext,
    canEvolve: mocks.companion.canEvolve,
  }),
}));

vi.mock("@/hooks/useCompanionHealth", () => ({
  useCompanionHealth: () => ({
    health: mocks.health,
    needsWelcomeBack: false,
  }),
}));

vi.mock("@/hooks/useCompanionVisualState", () => ({
  useCompanionVisualState: () => ({
    cssStyles: {},
    animationClass: "",
    care: {
      dormancy: {
        isDormant: mocks.isDormant,
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

vi.mock("@/hooks/useCompanionExpressionState", () => ({
  useCompanionExpressionState: () => mocks.expressionState,
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    storage: {
      from: () => ({
        getPublicUrl: getPublicUrlMock,
      }),
    },
  },
}));

vi.mock("@/contexts/TalkPopupContext", () => ({
  useTalkPopupContextSafe: () => ({
    dismiss: mocks.talkPopup.dismiss,
    show: mocks.talkPopup.show,
    isVisible: false,
  }),
}));

import { CompanionDialogue } from "./CompanionDialogue";

const setReducedMotion = (enabled: boolean) => {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: (query: string) => ({
      matches: query.includes("prefers-reduced-motion") ? enabled : false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }),
  });
};

const installMockImageLoader = (shouldError: (src: string) => boolean) => {
  const originalImage = window.Image;

  class MockImage extends EventTarget {
    complete = false;
    naturalWidth = 0;
    private currentSrc = "";

    set src(value: string) {
      this.currentSrc = value;
      this.complete = false;
      this.naturalWidth = 0;

      window.setTimeout(() => {
        if (this.currentSrc !== value) return;
        if (shouldError(value)) {
          this.dispatchEvent(new Event("error"));
          return;
        }

        this.complete = true;
        this.naturalWidth = 128;
        this.dispatchEvent(new Event("load"));
      }, 0);
    }

    get src() {
      return this.currentSrc;
    }
  }

  Object.defineProperty(window, "Image", {
    configurable: true,
    writable: true,
    value: MockImage as unknown as typeof Image,
  });

  return () => {
    Object.defineProperty(window, "Image", {
      configurable: true,
      writable: true,
      value: originalImage,
    });
  };
};

describe("CompanionDialogue", () => {
  beforeEach(() => {
    mocks.dialogue.greeting = "Primary greeting";
    mocks.dialogue.bondDialogue = "Secondary bond line";
    mocks.dialogue.shimmerType = "none";
    mocks.dialogue.microTitle = null;
    mocks.dialogue.outcomeTag = "basic_checkin";
    mocks.dialogue.tonePack = "soft";
    mocks.dialogue.bucketKey = "base_greetings";
    mocks.dialogue.lineId = "soft.base_greetings.01";
    mocks.dialogue.dialogueMood = "content";
    mocks.dialogue.isLoading = false;
    mocks.companion.id = "companion-1";
    mocks.companion.current_stage = 4;
    mocks.companion.current_image_url = null;
    mocks.companion.dormant_image_url = null;
    mocks.companion.neglected_image_url = null;
    mocks.companion.neglected_image_focal_x = null;
    mocks.companion.neglected_image_focal_y = null;
    mocks.companion.dormant_image_focal_x = null;
    mocks.companion.dormant_image_focal_y = null;
    mocks.companion.current_image_focal_x = 0.5;
    mocks.companion.current_image_focal_y = 0.5;
    mocks.companion.preset_id = null;
    mocks.companion.core_element = "fire";
    mocks.companion.cached_creature_name = "Wolf";
    mocks.companion.spirit_animal = "Wolf";
    mocks.companion.progressToNext = 50;
    mocks.companion.canEvolve = false;
    mocks.health = {
      moodState: "happy",
      hunger: 0,
      happiness: 100,
      isAlive: true,
      recoveryProgress: 0,
      isNeglected: false,
      neglectedImageUrl: null,
      neglectedImageFocalX: null,
      neglectedImageFocalY: null,
    };
    mocks.isDormant = false;
    mocks.expressionState = {
      mood: "calm",
      variant: 2,
      reason: "stable",
      isEventDriven: false,
    };
    mocks.talkPopup.dismiss.mockClear();
    mocks.talkPopup.show.mockClear();
    getPublicUrlMock.mockClear();
    setReducedMotion(false);
  });

  it("opens the centered dialogue popup when the card is clicked", () => {
    render(<CompanionDialogue />);

    fireEvent.click(screen.getByRole("button", { name: /open wolf dialogue/i }));

    const dialog = screen.getByRole("dialog", { name: "Wolf" });
    expect(dialog).toBeInTheDocument();
    expect(within(dialog).getByText(/Primary greeting/)).toBeInTheDocument();
    expect(within(dialog).getByText(/Secondary bond line/)).toBeInTheDocument();
  });

  it("uses provided companionName instead of species labels", () => {
    render(<CompanionDialogue companionName="Cindarion" />);

    fireEvent.click(screen.getByRole("button", { name: /open cindarion dialogue/i }));

    const dialog = screen.getByRole("dialog", { name: "Cindarion" });
    expect(dialog).toBeInTheDocument();
    expect(screen.queryByRole("dialog", { name: "Wolf" })).not.toBeInTheDocument();
  });

  it("opens from keyboard with Enter and Space", async () => {
    render(<CompanionDialogue />);
    const trigger = screen.getByRole("button", { name: /open wolf dialogue/i });

    trigger.focus();
    fireEvent.keyDown(trigger, { key: "Enter" });
    expect(screen.getByRole("dialog", { name: "Wolf" })).toBeInTheDocument();

    fireEvent.keyDown(document, { key: "Escape" });
    await waitFor(() => {
      expect(screen.queryByRole("dialog", { name: "Wolf" })).not.toBeInTheDocument();
    });

    trigger.focus();
    fireEvent.keyDown(trigger, { key: " ", code: "Space" });
    expect(screen.getByRole("dialog", { name: "Wolf" })).toBeInTheDocument();
  });

  it("closes the popup with Escape key", async () => {
    render(<CompanionDialogue />);

    fireEvent.click(screen.getByRole("button", { name: /open wolf dialogue/i }));
    expect(screen.getByRole("dialog", { name: "Wolf" })).toBeInTheDocument();

    fireEvent.keyDown(document, { key: "Escape" });

    await waitFor(() => {
      expect(screen.queryByRole("dialog", { name: "Wolf" })).not.toBeInTheDocument();
    });
  });

  it("closes the popup with the close button", async () => {
    render(<CompanionDialogue />);

    fireEvent.click(screen.getByRole("button", { name: /open wolf dialogue/i }));
    fireEvent.click(screen.getByRole("button", { name: "Close" }));

    await waitFor(() => {
      expect(screen.queryByRole("dialog", { name: "Wolf" })).not.toBeInTheDocument();
    });
  });

  it("renders avatar fallback inside popup when image URL is missing", () => {
    mocks.companion.current_image_url = null;
    render(<CompanionDialogue />);

    fireEvent.click(screen.getByRole("button", { name: /open wolf dialogue/i }));
    const dialog = screen.getByRole("dialog", { name: "Wolf" });

    expect(within(dialog).queryByRole("img", { name: "Wolf" })).not.toBeInTheDocument();
    expect(within(dialog).getByText("W")).toBeInTheDocument();
  });

  it("centers generated scene companion art in trigger and modal avatars", async () => {
    const restoreImage = installMockImageLoader(() => false);
    mocks.companion.current_image_url = "https://assets.example.com/generated-companion.png";
    mocks.companion.current_image_focal_x = 0.32;
    mocks.companion.current_image_focal_y = 0.68;

    try {
      render(<CompanionDialogue />);

      await waitFor(() => {
        expect(screen.getByRole("img", { name: "Wolf" })).toHaveAttribute(
          "data-companion-image-fit",
          "contain",
        );
      });

      fireEvent.click(screen.getByRole("button", { name: /open wolf dialogue/i }));

      await waitFor(() => {
        expect(within(screen.getByRole("dialog", { name: "Wolf" })).getByRole("img", { name: "Wolf" }))
          .toHaveAttribute("data-companion-image-fit", "contain");
      });
    } finally {
      restoreImage();
    }
  });

  it("keeps stage 0 dialogue art on the fixed elemental egg when neglected", async () => {
    const restoreImage = installMockImageLoader(() => false);
    mocks.companion.current_stage = 0;
    mocks.companion.current_image_url = "https://assets.example.com/generated-stage-0-egg.png";
    mocks.companion.neglected_image_url = "https://assets.example.com/generated-stage-0-neglected.png";
    mocks.companion.core_element = "light";
    mocks.health = {
      ...mocks.health,
      isNeglected: true,
      neglectedImageUrl: "https://assets.example.com/live-health-neglected-stage-0.png",
    };

    try {
      render(<CompanionDialogue companionName="Light Egg" />);

      await waitFor(() => {
        expect(screen.getByRole("img", { name: "Light Egg" })).toHaveAttribute(
          "src",
          expect.stringContaining("/companion-eggs/v2/egg__t0_egg__normal__light.webp"),
        );
      });
      expect(screen.getByRole("img", { name: "Light Egg" })).not.toHaveAttribute(
        "src",
        expect.stringContaining("live-health-neglected-stage-0"),
      );
    } finally {
      restoreImage();
    }
  });

  it("falls back to bundled youth preset art when expressive portraits are not available for the current tier", () => {
    mocks.companion.current_stage = 21;
    mocks.companion.current_image_url = "/companion-eggs/egg__t0_egg__normal__fire.png";
    mocks.companion.preset_id = "griffin";
    mocks.companion.core_element = "fire";
    mocks.companion.cached_creature_name = "Griffin";
    mocks.companion.spirit_animal = "Griffin";

    const { container } = render(<CompanionDialogue />);

    expect(container.innerHTML).toContain(
      "griffin/t1_youth/normal/griffin__t1_youth__normal__fire.png",
    );
    expect(container.innerHTML).not.toContain("/companion-eggs/egg__t0_egg__normal__fire.png");

    fireEvent.click(screen.getByRole("button", { name: /open griffin dialogue/i }));
    const dialog = screen.getByRole("dialog", { name: "Griffin" });
    expect(dialog.innerHTML).toContain(
      "griffin/t1_youth/normal/griffin__t1_youth__normal__fire.png",
    );
  });

  it("uses expressive portraits for the dialogue avatar when the active tier supports them", () => {
    mocks.companion.current_stage = 6;
    mocks.companion.current_image_url = "/companion-eggs/egg__t0_egg__normal__fire.png";
    mocks.companion.preset_id = "griffin";
    mocks.companion.core_element = "fire";
    mocks.companion.cached_creature_name = "Griffin";
    mocks.companion.spirit_animal = "Griffin";
    mocks.expressionState = {
      mood: "happy",
      variant: 4,
      reason: "positive-mood",
      isEventDriven: false,
    };

    const { container } = render(<CompanionDialogue />);

    expect(screen.getByTestId("companion-dialogue-trigger")).toHaveAttribute(
      "data-companion-expression-mood",
      "happy",
    );
    expect(screen.getByTestId("companion-dialogue-trigger")).toHaveAttribute(
      "data-companion-expression-variant",
      "4",
    );
    expect(container.innerHTML).toContain(
      "griffin/t2_guardian/happy/griffin__t2_guardian__happy__v4__fire.png",
    );
  });

  it("falls back to the normal portrait when the expressive avatar URL fails to load", async () => {
    const restoreImage = installMockImageLoader((src) => src.includes("/calm/"));
    mocks.companion.current_stage = 6;
    mocks.companion.current_image_url = "/companion-eggs/egg__t0_egg__normal__ice.png";
    mocks.companion.preset_id = "phoenix";
    mocks.companion.core_element = "ice";
    mocks.companion.cached_creature_name = "Phoenix";
    mocks.companion.spirit_animal = "Phoenix";
    mocks.expressionState = {
      mood: "calm",
      variant: 1,
      reason: "default-calm",
      isEventDriven: false,
    };

    try {
      const { container } = render(<CompanionDialogue />);

      await waitFor(() => {
        expect(container.innerHTML).toContain(
          "phoenix/t2_guardian/normal/phoenix__t2_guardian__normal__ice.png",
        );
        expect(container.innerHTML).not.toContain(
          "phoenix/t2_guardian/calm/phoenix__t2_guardian__calm__v1__ice.png",
        );
      });
    } finally {
      restoreImage();
    }
  });

  it("ignores stale dormant overrides and keeps the companion expressive", () => {
    mocks.companion.current_stage = 6;
    mocks.companion.current_image_url = "https://example.com/current.png";
    mocks.companion.dormant_image_url = "/companion-presets/griffin/t2_guardian/dormant/griffin__t2_guardian__dormant__fire.png";
    mocks.companion.preset_id = "griffin";
    mocks.companion.core_element = "fire";
    mocks.companion.cached_creature_name = "Griffin";
    mocks.companion.spirit_animal = "Griffin";
    mocks.isDormant = true;
    mocks.expressionState = {
      mood: "excited",
      variant: 5,
      reason: "recent-reward-event",
      isEventDriven: true,
    };

    const { container } = render(<CompanionDialogue />);

    expect(container.innerHTML).toContain(
      "griffin/t2_guardian/excited/griffin__t2_guardian__excited__v5__fire.png",
    );
    expect(container.innerHTML).not.toContain(
      "/companion-presets/griffin/t2_guardian/dormant/griffin__t2_guardian__dormant__fire.png",
    );
  });

  it("renders loading skeleton and prevents opening while loading", () => {
    mocks.dialogue.isLoading = true;

    const { container } = render(<CompanionDialogue className="custom-class" />);
    const skeleton = container.firstElementChild;

    expect(skeleton).toBeInTheDocument();
    expect(skeleton).toHaveClass("h-16");
    expect(skeleton).toHaveClass("custom-class");
    expect(screen.queryByRole("button", { name: /open/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("dismisses floating talk popup when opening modal", () => {
    render(<CompanionDialogue />);

    fireEvent.click(screen.getByRole("button", { name: /open wolf dialogue/i }));

    expect(mocks.talkPopup.dismiss).toHaveBeenCalledTimes(1);
  });

  it("does not trigger talk popup show or reward-like side effects on open and close", async () => {
    render(<CompanionDialogue />);

    fireEvent.click(screen.getByRole("button", { name: /open wolf dialogue/i }));
    fireEvent.click(screen.getByRole("button", { name: "Close" }));

    await waitFor(() => {
      expect(screen.queryByRole("dialog", { name: "Wolf" })).not.toBeInTheDocument();
    });

    expect(mocks.talkPopup.dismiss).toHaveBeenCalledTimes(1);
    expect(mocks.talkPopup.show).not.toHaveBeenCalled();
  });

  it("shows event header from micro-title when shimmer is active", () => {
    mocks.dialogue.shimmerType = "green";
    mocks.dialogue.microTitle = "Momentum Boost";

    render(<CompanionDialogue />);

    expect(screen.getByText("Momentum Boost")).toBeInTheDocument();
  });

  it("falls back to Companion Event when micro-title is absent", () => {
    mocks.dialogue.shimmerType = "none";
    mocks.dialogue.microTitle = null;

    render(<CompanionDialogue />);

    expect(screen.getByText("Companion Event")).toBeInTheDocument();
    expect(screen.queryByText("Momentum Boost")).not.toBeInTheDocument();
  });

  it("uses the same event header in modal description", () => {
    mocks.dialogue.shimmerType = "green";
    mocks.dialogue.microTitle = "Momentum Boost";

    render(<CompanionDialogue />);
    fireEvent.click(screen.getByRole("button", { name: /open wolf dialogue/i }));

    const dialog = screen.getByRole("dialog", { name: "Wolf" });
    expect(within(dialog).getByText("Momentum Boost")).toBeInTheDocument();
  });

  it("does not duplicate event header inside the modal body", () => {
    mocks.dialogue.shimmerType = "green";
    mocks.dialogue.microTitle = "Momentum Boost";

    render(<CompanionDialogue />);
    fireEvent.click(screen.getByRole("button", { name: /open wolf dialogue/i }));

    const dialog = screen.getByRole("dialog", { name: "Wolf" });
    expect(within(dialog).getAllByText("Momentum Boost")).toHaveLength(1);
  });

  it("applies shimmer accent styling based on shimmer type", () => {
    mocks.dialogue.shimmerType = "red";
    mocks.dialogue.microTitle = "Reset Moment";

    render(<CompanionDialogue />);

    const trigger = screen.getByTestId("companion-dialogue-trigger");
    const accent = screen.getByTestId("companion-dialogue-accent");

    expect(trigger).toHaveAttribute("data-shimmer-type", "red");
    expect(trigger).toHaveClass("border-rose-300/45");
    expect(accent).toHaveClass("bg-rose-300/10");
  });

  it("disables shimmer animation for reduced-motion users", () => {
    setReducedMotion(true);
    mocks.dialogue.shimmerType = "purple";
    mocks.dialogue.microTitle = "Surprise Support";

    render(<CompanionDialogue />);

    expect(screen.getByTestId("companion-dialogue-accent")).not.toHaveClass("animate-pulse");

    fireEvent.click(screen.getByRole("button", { name: /open wolf dialogue/i }));
    expect(screen.getByTestId("companion-dialogue-modal-accent")).not.toHaveClass("animate-pulse");
  });

  it("falls back to Companion when both explicit and cached names are empty", () => {
    mocks.companion.cached_creature_name = null;

    render(<CompanionDialogue companionName="   " />);

    fireEvent.click(screen.getByRole("button", { name: /open companion dialogue/i }));
    expect(screen.getByRole("dialog", { name: "Companion" })).toBeInTheDocument();
  });

  it("shows near-evolution companion line at 97% and mirrors it in modal", () => {
    mocks.companion.progressToNext = 97;
    mocks.companion.canEvolve = false;

    render(<CompanionDialogue />);

    const nearLine = screen.getByTestId("companion-near-evolution-line");
    expect(nearLine).toBeInTheDocument();
    expect(nearLine.textContent?.length ?? 0).toBeGreaterThan(5);

    fireEvent.click(screen.getByRole("button", { name: /open wolf dialogue/i }));
    const modalNearLine = screen.getByTestId("companion-near-evolution-line-modal");
    expect(modalNearLine).toBeInTheDocument();
    expect(modalNearLine.textContent).toEqual(nearLine.textContent);
  });

  it("hides near-evolution line below threshold", () => {
    mocks.companion.progressToNext = 96;
    mocks.companion.canEvolve = false;

    render(<CompanionDialogue />);

    expect(screen.queryByTestId("companion-near-evolution-line")).not.toBeInTheDocument();
  });

  it("hides near-evolution line when already evolvable", () => {
    mocks.companion.progressToNext = 100;
    mocks.companion.canEvolve = true;

    render(<CompanionDialogue />);

    expect(screen.queryByTestId("companion-near-evolution-line")).not.toBeInTheDocument();
  });
});
