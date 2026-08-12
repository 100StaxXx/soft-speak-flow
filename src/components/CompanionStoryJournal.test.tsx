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
    companion_name: "Nova",
    cached_creature_name: null as string | null,
  },
  generateStory: {
    mutate: vi.fn(),
    isPending: false,
  },
  story: null as null | {
    id: string;
    stage: number;
    chapter_title: string;
    intro_line: string;
    main_story: string;
    bond_moment: string;
    life_lesson: string;
    lore_expansion: string[];
    next_hook: string;
  },
  refetch: vi.fn(),
}));

vi.mock("@/hooks/useCompanion", () => ({
  useCompanion: () => ({
    companion: mocks.companion,
    isLoading: false,
  }),
}));

vi.mock("@/hooks/useCompanionStory", () => ({
  useCompanionStory: () => ({
    story: mocks.story,
    allStories: [],
    isLoading: false,
    error: null,
    refetch: mocks.refetch,
    generateStory: mocks.generateStory,
  }),
}));

vi.mock("@/hooks/useDailyMissionThread", () => ({
  useDailyAdventureHistory: () => ({ data: [], isLoading: false, error: null }),
}));

vi.mock("@/hooks/useLivingNarrativeChoice", () => ({
  useLivingNarrativeChoice: () => ({
    choice: null,
    isLoading: false,
    error: null,
    recordChoice: { isPending: false, mutateAsync: vi.fn() },
    updateSideQuest: { isPending: false, mutateAsync: vi.fn() },
  }),
}));

vi.mock("@/hooks/useCompanionNarrativeMemories", () => ({
  useCompanionNarrativeMemories: () => ({
    data: [],
    isLoading: false,
    error: null,
  }),
}));

vi.mock("@/hooks/useTaskMutations", () => ({
  useTaskMutations: () => ({ addTask: vi.fn() }),
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
    mocks.story = null;
    mocks.refetch.mockClear();
  });

  it("contains generated landscape checkpoint art to match video framing", async () => {
    renderWithQueryClient(<CompanionStoryJournal />);

    fireEvent.click(screen.getByRole("button", { name: /next/i }));

    const image = await screen.findByRole("img", {
      name: "Frostynia at Level 1 • Hatchling",
    });

    await waitFor(() => {
      expect(image).toHaveAttribute("src", "https://assets.example.com/frostynia-stage-1.png");
    });

    Object.defineProperty(image, "naturalWidth", { configurable: true, value: 1536 });
    Object.defineProperty(image, "naturalHeight", { configurable: true, value: 1024 });

    fireEvent.load(image);

    await waitFor(() => {
      expect(image).toHaveAttribute("data-companion-image-fit", "contain");
      expect(image).toHaveStyle({ objectPosition: "center center" });
    });
  });

  it("shows generated lore and the next chapter hook", async () => {
    mocks.story = {
      id: "story-1",
      stage: 0,
      chapter_title: "The Glass Signal",
      intro_line: "A bell rang beneath the ice.",
      main_story: "Frostynia followed the sound and uncovered a sleeping observatory.",
      bond_moment: "The signal matched their shared heartbeat.",
      life_lesson: "Attention turns uncertainty into a path.",
      lore_expansion: [
        "World Truth: Starlight can be stored in winter glass.",
        "Historical Reference: The first keepers mapped the northern bells.",
        "Foreshadowing Seed: One bell is still missing.",
      ],
      next_hook: "At dawn, a fourth note answered from beyond the ridge.",
    };

    renderWithQueryClient(<CompanionStoryJournal />);

    expect(await screen.findByText("Lore Discovered")).toBeInTheDocument();
    expect(screen.getByText(/Starlight can be stored/)).toBeInTheDocument();
    expect(screen.getByText("Next Chapter")).toBeInTheDocument();
    expect(screen.getAllByText(/a fourth note answered/)).toHaveLength(2);
    expect(screen.getByText("What should Nova carry forward from this chapter?")).toBeInTheDocument();
  });
});

import { CompanionStoryJournal } from "./CompanionStoryJournal";
