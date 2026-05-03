import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useJourneysCompanionVisual } from "./useJourneysCompanionVisual";
import type { Companion } from "./useCompanion";

const mocks = vi.hoisted(() => ({
  companion: null as Companion | null,
  health: {
    imageUrl: null as string | null,
    imageFocalX: null as number | null,
    imageFocalY: null as number | null,
    isNeglected: false,
    neglectedImageUrl: null as string | null,
    neglectedImageFocalX: null as number | null,
    neglectedImageFocalY: null as number | null,
  },
  care: {
    dormancy: {
      isDormant: false,
    },
  },
}));

vi.mock("./useCompanion", () => ({
  useCompanion: () => ({
    companion: mocks.companion,
    nextEvolutionXP: 200,
    progressToNext: 40,
    canEvolve: false,
  }),
}));

vi.mock("./useCompanionHealth", () => ({
  useCompanionHealth: () => ({
    health: mocks.health,
  }),
}));

vi.mock("./useCompanionCareSignals", () => ({
  useCompanionCareSignals: () => ({
    care: mocks.care,
  }),
}));

const baseCompanion = (overrides: Partial<Companion> = {}): Companion => ({
  id: "companion-1",
  user_id: "user-1",
  preset_id: null,
  favorite_color: "#f8c14a",
  spirit_animal: "fox",
  core_element: "fire",
  story_tone: "cozy",
  current_stage: 3,
  current_xp: 120,
  current_image_url: "https://assets.example.com/scene.png",
  current_image_focal_x: 0.44,
  current_image_focal_y: 0.58,
  initial_image_url: null,
  initial_image_focal_x: null,
  initial_image_focal_y: null,
  created_at: "2026-05-03T00:00:00.000Z",
  updated_at: "2026-05-03T00:00:00.000Z",
  ...overrides,
});

describe("useJourneysCompanionVisual", () => {
  beforeEach(() => {
    mocks.companion = null;
    mocks.health = {
      imageUrl: null,
      imageFocalX: null,
      imageFocalY: null,
      isNeglected: false,
      neglectedImageUrl: null,
      neglectedImageFocalX: null,
      neglectedImageFocalY: null,
    };
    mocks.care = {
      dormancy: {
        isDormant: false,
      },
    };
  });

  it("uses fresh AI launcher art for the Journeys FAB", () => {
    mocks.companion = baseCompanion({
      launcher_image_url: "https://assets.example.com/launcher.png",
      launcher_image_focal_x: 0.51,
      launcher_image_focal_y: 0.47,
      launcher_image_source_url: "https://assets.example.com/scene.png",
    });

    const { result } = renderHook(() => useJourneysCompanionVisual());

    expect(result.current.isGeneratedCompanion).toBe(true);
    expect(result.current.launcherAwayImageUrl).toBe("https://assets.example.com/launcher.png");
    expect(result.current.launcherAwayFocalX).toBe(0.51);
    expect(result.current.launcherAwayFocalY).toBe(0.47);
    expect(result.current.needsLauncherImage).toBe(false);
  });

  it("requests lazy generation when AI launcher art is missing", () => {
    mocks.companion = baseCompanion();

    const { result } = renderHook(() => useJourneysCompanionVisual());

    expect(result.current.launcherAwayImageUrl).toBeNull();
    expect(result.current.needsLauncherImage).toBe(true);
    expect(result.current.currentSceneImageUrl).toBe("https://assets.example.com/scene.png");
  });

  it("ignores stale launcher art when the current scene image changes", () => {
    mocks.companion = baseCompanion({
      current_image_url: "https://assets.example.com/new-scene.png",
      launcher_image_url: "https://assets.example.com/old-launcher.png",
      launcher_image_source_url: "https://assets.example.com/old-scene.png",
    });

    const { result } = renderHook(() => useJourneysCompanionVisual());

    expect(result.current.launcherAwayImageUrl).toBeNull();
    expect(result.current.needsLauncherImage).toBe(true);
  });

  it("keeps preset companions on bundled launcher-away art", () => {
    mocks.companion = baseCompanion({
      preset_id: "dragon",
      core_element: "ice",
      current_image_url: "/companion-presets/dragon/t1_youth/normal/dragon__t1_youth__normal__ice.png",
      launcher_image_url: "https://assets.example.com/ignored-launcher.png",
      launcher_image_source_url: "/companion-presets/dragon/t1_youth/normal/dragon__t1_youth__normal__ice.png",
    });

    const { result } = renderHook(() => useJourneysCompanionVisual());

    expect(result.current.isGeneratedCompanion).toBe(false);
    expect(result.current.launcherAwayImageUrl).toBe("/companion-launcher-away/dragon/dragon__launcher-away__ice.png");
    expect(result.current.launcherAwayUsesPortraitShell).toBe(true);
    expect(result.current.needsLauncherImage).toBe(false);
  });
});
