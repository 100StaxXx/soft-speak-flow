import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  dialogue: {
    greeting: "Primary greeting",
    bondDialogue: "Secondary bond line",
    dialogueMood: "content" as const,
    isLoading: false,
  },
  companion: {
    current_image_url: null as string | null,
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

describe("CompanionDialogue", () => {
  beforeEach(() => {
    mocks.dialogue.greeting = "Primary greeting";
    mocks.dialogue.bondDialogue = "Secondary bond line";
    mocks.dialogue.dialogueMood = "content";
    mocks.dialogue.isLoading = false;
    mocks.companion.current_image_url = null;
    mocks.companion.spirit_animal = "Wolf";
    mocks.talkPopup.dismiss.mockClear();
    mocks.talkPopup.show.mockClear();
  });

  it("opens the centered dialogue popup when the card is clicked", () => {
    render(<CompanionDialogue />);

    fireEvent.click(screen.getByRole("button", { name: /open wolf dialogue/i }));

    const dialog = screen.getByRole("dialog", { name: "Wolf" });
    expect(dialog).toBeInTheDocument();
    expect(within(dialog).getByText(/Primary greeting/)).toBeInTheDocument();
    expect(within(dialog).getByText(/Secondary bond line/)).toBeInTheDocument();
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
});
