import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

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
    current_image_url: null as string | null,
    cached_creature_name: "Wolf" as string | null,
    spirit_animal: "Wolf",
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
    companion: mocks.companion,
  }),
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
    mocks.companion.current_image_url = null;
    mocks.companion.cached_creature_name = "Wolf";
    mocks.companion.spirit_animal = "Wolf";
    mocks.talkPopup.dismiss.mockClear();
    mocks.talkPopup.show.mockClear();
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
});
