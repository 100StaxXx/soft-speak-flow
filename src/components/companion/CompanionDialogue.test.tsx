import { render, screen } from "@testing-library/react";
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

import { CompanionDialogue } from "./CompanionDialogue";

describe("CompanionDialogue", () => {
  beforeEach(() => {
    mocks.dialogue.greeting = "Primary greeting";
    mocks.dialogue.bondDialogue = "Secondary bond line";
    mocks.dialogue.dialogueMood = "content";
    mocks.dialogue.isLoading = false;
    mocks.companion.current_image_url = null;
    mocks.companion.spirit_animal = "Wolf";
  });

  it("renders only the primary greeting statement even when bond dialogue exists", () => {
    render(<CompanionDialogue />);

    expect(screen.getByText(/Primary greeting/)).toBeInTheDocument();
    expect(screen.queryByText(/Secondary bond line/)).not.toBeInTheDocument();
  });

  it("renders the loading skeleton while dialogue is loading", () => {
    mocks.dialogue.isLoading = true;

    const { container } = render(<CompanionDialogue className="custom-class" />);
    const skeleton = container.firstElementChild;

    expect(skeleton).toBeInTheDocument();
    expect(skeleton).toHaveClass("h-16");
    expect(skeleton).toHaveClass("custom-class");
  });
});
