import { fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  reducedMotion: false,
  motionProfile: "balanced" as "reduced" | "balanced" | "enhanced",
  motionCapabilities: {
    allowParallax: true,
    maxParticles: 24,
    allowBackgroundAnimation: true,
    enableTabTransitions: true,
    hapticsMode: "web" as const,
  },
  companion: {
    current_image_url: null as string | null,
    spirit_animal: "Fox",
  },
  habitat: {
    biome: "cosmic_nest",
    ambiance: "serene",
    qualityTier: "medium" as const,
    decorSlots: {
      foreground: null as string | null,
      midground: null as string | null,
      background: null as string | null,
    },
    unlockedThemes: ["cosmic_nest", "starlit_valley"],
    lastSceneState: {},
  },
  habitatItems: [] as Array<{
    id: string;
    itemKey: string;
    itemName: string;
    slot: string;
    rarity: string;
    isEquipped: boolean;
    unlockSource: string | null;
    metadata: Record<string, unknown>;
  }>,
  snapshots: [] as Array<{
    id: string;
    headline: string;
    publishedAt: string;
    snapshotPayload?: {
      companion?: {
        mood?: string;
        emotionalArc?: string;
        bondLevel?: number;
        stage?: number;
      };
      habitat?: {
        biome?: string;
        ambiance?: string;
      };
      campaign?: {
        current_chapter?: number;
      };
    };
  }>,
  publishSnapshot: { mutate: vi.fn(), isPending: false },
  setHabitatAppearance: { mutate: vi.fn(), isPending: false },
  seedStarterHabitatItems: { mutate: vi.fn(), isPending: false },
  equipHabitatItem: { mutate: vi.fn(), isPending: false },
}));

vi.mock("framer-motion", async () => {
  const actual = await vi.importActual<typeof import("framer-motion")>("framer-motion");
  return {
    ...actual,
    useReducedMotion: () => mocks.reducedMotion,
  };
});

vi.mock("@/hooks/useMotionProfile", () => ({
  useMotionProfile: () => ({
    profile: mocks.motionProfile,
    capabilities: mocks.motionCapabilities,
    signals: {
      prefersReducedMotion: mocks.reducedMotion,
      hardwareConcurrency: 8,
      deviceMemory: 8,
      isNative: false,
      platform: "web",
      isVisible: true,
      hasVibration: true,
    },
  }),
}));

vi.mock("@/hooks/useCompanion", () => ({
  useCompanion: () => ({
    companion: mocks.companion,
  }),
}));

vi.mock("@/hooks/useCompanionLife", () => ({
  useCompanionLife: () => ({
    habitat: mocks.habitat,
    habitatItems: mocks.habitatItems,
    snapshots: mocks.snapshots,
    publishSnapshot: mocks.publishSnapshot,
    setHabitatAppearance: mocks.setHabitatAppearance,
    seedStarterHabitatItems: mocks.seedStarterHabitatItems,
    equipHabitatItem: mocks.equipHabitatItem,
  }),
}));

vi.mock("@/components/companion/CompanionHabitatScene", () => ({
  CompanionHabitatScene: ({
    qualityTier,
    reducedMotion,
    maxParticles,
  }: {
    qualityTier: "high" | "medium" | "low";
    reducedMotion: boolean;
    maxParticles?: number;
  }) => (
    <div
      data-testid="habitat-scene"
      data-quality-tier={qualityTier}
      data-reduced-motion={reducedMotion ? "true" : "false"}
      data-max-particles={typeof maxParticles === "number" ? String(maxParticles) : "none"}
    />
  ),
}));

import { HomeTab } from "./HomeTab";

describe("HomeTab", () => {
  beforeEach(() => {
    mocks.reducedMotion = false;
    mocks.motionProfile = "balanced";
    mocks.motionCapabilities = {
      allowParallax: true,
      maxParticles: 24,
      allowBackgroundAnimation: true,
      enableTabTransitions: true,
      hapticsMode: "web",
    };
    mocks.habitat.biome = "cosmic_nest";
    mocks.habitat.ambiance = "serene";
    mocks.habitat.qualityTier = "medium";
    mocks.habitat.unlockedThemes = ["cosmic_nest", "starlit_valley"];
    mocks.habitat.decorSlots = {
      foreground: null,
      midground: null,
      background: null,
    };
    mocks.habitatItems = [];
    mocks.snapshots = [];
    mocks.publishSnapshot.isPending = false;
    mocks.setHabitatAppearance.isPending = false;
    mocks.seedStarterHabitatItems.isPending = false;
    mocks.equipHabitatItem.isPending = false;
    mocks.publishSnapshot.mutate.mockReset();
    mocks.setHabitatAppearance.mutate.mockReset();
    mocks.seedStarterHabitatItems.mutate.mockReset();
    mocks.equipHabitatItem.mutate.mockReset();
  });

  it("shows seed starter decor action when no habitat items exist", () => {
    render(<HomeTab />);

    const seedButton = screen.getByRole("button", { name: /seed starter decor/i });
    expect(seedButton).toBeInTheDocument();

    fireEvent.click(seedButton);
    expect(mocks.seedStarterHabitatItems.mutate).toHaveBeenCalledTimes(1);
  });

  it("updates habitat appearance when selecting a theme", () => {
    render(<HomeTab />);

    fireEvent.click(screen.getByRole("button", { name: /starlit valley/i }));

    expect(mocks.setHabitatAppearance.mutate).toHaveBeenCalledWith({
      biome: "starlit_valley",
      ambiance: "hopeful",
    });
  });

  it("equips a decor item for its slot", () => {
    mocks.habitatItems = [
      {
        id: "item-1",
        itemKey: "starter_starlit_lanterns",
        itemName: "Starlit Lanterns",
        slot: "foreground",
        rarity: "common",
        isEquipped: false,
        unlockSource: "starter_pack",
        metadata: {},
      },
    ];

    render(<HomeTab />);
    fireEvent.click(screen.getByRole("button", { name: /starlit lanterns/i }));

    expect(mocks.equipHabitatItem.mutate).toHaveBeenCalledWith({
      itemId: "item-1",
      slot: "foreground",
    });
  });

  it("shows selected snapshot replay details", () => {
    mocks.snapshots = [
      {
        id: "snap-1",
        headline: "Fox found calm",
        publishedAt: "2026-02-13T10:00:00.000Z",
        snapshotPayload: {
          companion: { mood: "calm", emotionalArc: "steady_bloom", bondLevel: 4, stage: 2 },
          habitat: { biome: "cosmic_nest", ambiance: "serene" },
          campaign: { current_chapter: 2 },
        },
      },
      {
        id: "snap-2",
        headline: "Fox entered repair arc",
        publishedAt: "2026-02-13T11:00:00.000Z",
        snapshotPayload: {
          companion: { mood: "fragile", emotionalArc: "fragile_echo", bondLevel: 3, stage: 2 },
          habitat: { biome: "moonlit_garden", ambiance: "fragile" },
          campaign: { current_chapter: 3 },
        },
      },
    ];

    render(<HomeTab />);
    fireEvent.click(screen.getAllByRole("button", { name: /replay/i })[1]);

    const replayCard = screen.getByTestId("snapshot-replay-card");
    expect(replayCard).toBeInTheDocument();
    expect(within(replayCard).getByText(/fox entered repair arc/i)).toBeInTheDocument();
    expect(within(replayCard).getByText(/mood: fragile/i)).toBeInTheDocument();
  });

  it("caps habitat scene quality and motion when reduced profile is active", () => {
    mocks.motionProfile = "reduced";
    mocks.motionCapabilities.allowBackgroundAnimation = false;

    render(<HomeTab />);
    const scene = screen.getByTestId("habitat-scene");
    expect(scene).toHaveAttribute("data-quality-tier", "low");
    expect(scene).toHaveAttribute("data-reduced-motion", "true");
    expect(scene).toHaveAttribute("data-max-particles", "24");
  });

  it("allows richer scene quality for enhanced motion profile", () => {
    mocks.motionProfile = "enhanced";
    mocks.habitat.qualityTier = "medium";

    render(<HomeTab />);
    expect(screen.getByTestId("habitat-scene")).toHaveAttribute("data-quality-tier", "high");
    expect(screen.getByTestId("habitat-scene")).toHaveAttribute("data-reduced-motion", "false");
  });
});
