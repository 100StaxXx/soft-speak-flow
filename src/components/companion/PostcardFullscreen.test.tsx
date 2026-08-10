import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CompanionPostcard } from "@/hooks/useCompanionPostcards";

const mocks = vi.hoisted(() => ({
  onClose: vi.fn(),
  checkChapter: vi.fn(),
  checkFullStoryline: vi.fn(),
}));

vi.mock("@/hooks/useAchievements", () => ({
  useAchievements: () => ({
    checkStoryChapterAchievement: mocks.checkChapter,
    checkFullStorylineAchievement: mocks.checkFullStoryline,
  }),
}));

vi.mock("@/hooks/useCosmicLibrary", () => ({
  useNarrativeEpic: () => ({ epic: null }),
}));

vi.mock("@/hooks/useCompanion", () => ({
  useCompanion: () => ({
    companion: {
      companion_name: "Nova",
      cached_creature_name: null,
      spirit_animal: "Frostynia",
    },
  }),
}));

vi.mock("@capacitor/core", () => ({
  Capacitor: { isNativePlatform: () => false },
}));

vi.mock("@capacitor/share", () => ({
  Share: { share: vi.fn() },
}));

vi.mock("./LivingNarrativeChoiceCard", () => ({
  LivingNarrativeChoiceCard: () => <div>Living narrative question</div>,
}));

import { PostcardFullscreen } from "./PostcardFullscreen";

const postcard: CompanionPostcard = {
  id: "postcard-1",
  user_id: "user-1",
  companion_id: "companion-1",
  epic_id: "epic-1",
  milestone_percent: 50,
  location_name: "Mirror Sea",
  location_description: "A silver ocean reflecting a field of stars.",
  image_url: "https://assets.example.com/mirror-sea.png",
  caption: "The water remembered our names.",
  generated_at: "2026-08-09T12:00:00.000Z",
  created_at: "2026-08-09T12:00:00.000Z",
  chapter_number: 2,
  chapter_title: "The Water That Answered",
  story_content: "Nova crossed the reflected constellations without breaking them.",
  clue_text: "One constellation moved against the tide.",
  prophecy_line: "The quiet map opens for those who notice.",
  characters_featured: ["Nova"],
  seeds_planted: ["moving constellation"],
  is_finale: false,
  location_revealed: true,
};

describe("PostcardFullscreen", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.checkChapter.mockResolvedValue(undefined);
    mocks.checkFullStoryline.mockResolvedValue(undefined);
  });

  it("reveals visual discoveries and flips to the companion's note", async () => {
    render(<PostcardFullscreen postcard={postcard} onClose={mocks.onClose} />);

    fireEvent.click(screen.getByRole("button", { name: "Reveal mystery clue" }));
    expect(screen.getByText("One constellation moved against the tide.")).toBeInTheDocument();
    expect(screen.getByText("Companion discovery")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Flip postcard" }));
    expect(await screen.findByText("A note from Nova")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Reveal mystery clue" })).not.toBeInTheDocument();
  });

  it("closes once from the close control and supports Escape", () => {
    render(<PostcardFullscreen postcard={postcard} onClose={mocks.onClose} />);

    const closeButton = screen.getByRole("button", { name: "Close postcard" });
    expect(closeButton).toHaveFocus();
    fireEvent.click(closeButton);
    expect(mocks.onClose).toHaveBeenCalledTimes(1);

    fireEvent.keyDown(document, { key: "Escape" });
    expect(mocks.onClose).toHaveBeenCalledTimes(2);
  });
});
