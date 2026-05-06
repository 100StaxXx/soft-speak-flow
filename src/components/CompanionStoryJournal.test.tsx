import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  companion: {
    id: "companion-1",
    current_stage: 1,
    current_xp: 38,
    current_image_url: "https://assets.example.com/frostynia-stage-1.png",
    current_image_focal_x: 0.32 as number | null,
    current_image_focal_y: 0.68 as number | null,
    initial_image_url: null as string | null,
    initial_image_focal_x: null as number | null,
    initial_image_focal_y: null as number | null,
    preset_id: null as string | null,
    spirit_animal: "Frostynia",
    core_element: "ice",
  },
  generateStory: {
    mutate: vi.fn(),
    isPending: false,
  },
}));

vi.mock("@/hooks/useCompanion", () => ({
  useCompanion: () => ({
    companion: mocks.companion,
    isLoading: false,
  }),
}));

vi.mock("@/hooks/useCompanionStory", () => ({
  useCompanionStory: () => ({
    story: null,
    allStories: [],
    isLoading: false,
    generateStory: mocks.generateStory,
  }),
}));

vi.mock("@/lib/companionAssetResolver", () => ({
  getPresetCompanionAssetUrl: vi.fn(() => null),
  getUniversalEggAssetUrl: vi.fn((element: string) => (
    `/companion-eggs/v2/egg__t0_egg__normal__${String(element ?? "fire").toLowerCase()}.webp`
  )),
}));

vi.mock("./StoryJournalInfoTooltip", () => ({
  StoryJournalInfoTooltip: () => null,
}));

const renderWithQueryClient = (children: ReactNode) => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>,
  );
};

describe("CompanionStoryJournal", () => {
  beforeEach(() => {
    mocks.generateStory.mutate.mockClear();
  });

  it("centers generated landscape checkpoint art after measuring its natural dimensions", async () => {
    renderWithQueryClient(<CompanionStoryJournal />);

    fireEvent.click(screen.getByRole("button", { name: /next/i }));

    const image = await screen.findByRole("img", {
      name: "Frostynia at Stage 1 • Hatchling",
    });

    await waitFor(() => {
      expect(image).toHaveAttribute("src", "https://assets.example.com/frostynia-stage-1.png");
    });

    Object.defineProperty(image, "naturalWidth", { configurable: true, value: 1536 });
    Object.defineProperty(image, "naturalHeight", { configurable: true, value: 1024 });

    fireEvent.load(image);

    await waitFor(() => {
      expect(image).toHaveStyle({ objectPosition: "0% 50%" });
    });
  });
});

import { CompanionStoryJournal } from "./CompanionStoryJournal";
