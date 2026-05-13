import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useJourneysCompanionVisual } from "./useJourneysCompanionVisual";
import type { Companion } from "./useCompanion";

const mocks = vi.hoisted(() => ({
  companion: null as Companion | null,
  pendingEvolutionReveal: null as {
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
  } | null,
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

vi.mock("@/contexts/EvolutionContext", () => ({
  useEvolution: () => ({
    pendingEvolutionReveal: mocks.pendingEvolutionReveal,
  }),
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
    mocks.pendingEvolutionReveal = null;
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

  it("uses fresh transparent AI launcher art for the Journeys FAB when available", () => {
    mocks.companion = baseCompanion({
      launcher_image_url:
        "https://assets.example.com/user-1/companion_user-1_launcher_validated_transparent_stage3.png",
      launcher_image_focal_x: 0.51,
      launcher_image_focal_y: 0.47,
      launcher_image_source_url: "https://assets.example.com/scene.png",
    });

    const { result } = renderHook(() => useJourneysCompanionVisual());

    expect(result.current.isGeneratedCompanion).toBe(true);
    expect(result.current.currentStage).toBe(3);
    expect(result.current.launcherAwayImageUrl).toBe(
      "https://assets.example.com/user-1/companion_user-1_launcher_validated_transparent_stage3.png",
    );
    expect(result.current.launcherAwayFocalX).toBe(0.51);
    expect(result.current.launcherAwayFocalY).toBe(0.47);
    expect(result.current.launcherAwayUsesPortraitShell).toBe(false);
    expect(result.current.launcherAwayHasTransparentBackground).toBe(true);
    expect(result.current.needsLauncherImage).toBe(false);
    expect(result.current.currentSceneImageUrl).toBe("https://assets.example.com/scene.png");
  });

  it("ignores legacy AI launcher art saved before validated transparent cutouts", () => {
    mocks.companion = baseCompanion({
      launcher_image_url:
        "https://assets.example.com/user-1/companion_user-1_launcher_transparent_stage3.png",
      launcher_image_focal_x: 0.51,
      launcher_image_focal_y: 0.47,
      launcher_image_source_url: "https://assets.example.com/scene.png",
    });

    const { result } = renderHook(() => useJourneysCompanionVisual());

    expect(result.current.launcherAwayImageUrl).toBeNull();
    expect(result.current.launcherAwayHasTransparentBackground).toBe(false);
    expect(result.current.needsLauncherImage).toBe(true);
    expect(result.current.currentSceneImageUrl).toBe("https://assets.example.com/scene.png");
  });

  it("requests a transparent launcher image while lazy AI launcher art is missing", () => {
    mocks.companion = baseCompanion();

    const { result } = renderHook(() => useJourneysCompanionVisual());

    expect(result.current.launcherAwayImageUrl).toBeNull();
    expect(result.current.launcherAwayFocalX).toBeNull();
    expect(result.current.launcherAwayFocalY).toBeNull();
    expect(result.current.launcherAwayUsesPortraitShell).toBe(false);
    expect(result.current.launcherAwayHasTransparentBackground).toBe(false);
    expect(result.current.needsLauncherImage).toBe(true);
    expect(result.current.currentSceneImageUrl).toBe("https://assets.example.com/scene.png");
  });

  it("keeps the previous companion art while an evolution reveal is pending", () => {
    mocks.companion = baseCompanion({
      current_stage: 4,
      current_image_url: "https://assets.example.com/stage-4-scene.png",
      current_image_focal_x: 0.61,
      current_image_focal_y: 0.42,
      launcher_image_url:
        "https://assets.example.com/user-1/companion_user-1_launcher_validated_transparent_stage3.png",
      launcher_image_focal_x: 0.45,
      launcher_image_focal_y: 0.55,
      launcher_image_source_url: "https://assets.example.com/stage-3-scene.png",
    });
    mocks.pendingEvolutionReveal = {
      status: "ready",
      companionId: "companion-1",
      evolutionId: "evolution-4",
      previousStage: 3,
      newStage: 4,
      previousImageUrl: "https://assets.example.com/stage-3-scene.png",
      newImageUrl: "https://assets.example.com/stage-4-scene.png",
      animationVideoUrl: "https://assets.example.com/reveal-stage-4.mp4",
      presetId: null,
      element: "fire",
    };

    const { result } = renderHook(() => useJourneysCompanionVisual());

    expect(result.current.currentSceneImageUrl).toBe("https://assets.example.com/stage-3-scene.png");
    expect(result.current.currentStage).toBe(3);
    expect(result.current.launcherAwayImageUrl).toBe(
      "https://assets.example.com/user-1/companion_user-1_launcher_validated_transparent_stage3.png",
    );
    expect(result.current.launcherAwayFocalX).toBe(0.45);
    expect(result.current.launcherAwayFocalY).toBe(0.55);
    expect(result.current.launcherAwayUsesPortraitShell).toBe(false);
    expect(result.current.launcherAwayHasTransparentBackground).toBe(true);
    expect(result.current.needsLauncherImage).toBe(false);
  });

  it("switches the FAB source to the new stage after the reveal state clears", () => {
    mocks.companion = baseCompanion({
      current_stage: 4,
      current_image_url: "https://assets.example.com/stage-4-scene.png",
      current_image_focal_x: 0.61,
      current_image_focal_y: 0.42,
      launcher_image_url:
        "https://assets.example.com/user-1/companion_user-1_launcher_validated_transparent_stage3.png",
      launcher_image_source_url: "https://assets.example.com/stage-3-scene.png",
    });

    const { result } = renderHook(() => useJourneysCompanionVisual());

    expect(result.current.currentSceneImageUrl).toBe("https://assets.example.com/stage-4-scene.png");
    expect(result.current.currentStage).toBe(4);
    expect(result.current.launcherAwayImageUrl).toBeNull();
    expect(result.current.launcherAwayFocalX).toBeNull();
    expect(result.current.launcherAwayFocalY).toBeNull();
    expect(result.current.launcherAwayHasTransparentBackground).toBe(false);
    expect(result.current.needsLauncherImage).toBe(true);
  });

  it("ignores stale launcher art when the current scene image changes", () => {
    mocks.companion = baseCompanion({
      current_image_url: "https://assets.example.com/new-scene.png",
      launcher_image_url: "https://assets.example.com/old-launcher.png",
      launcher_image_source_url: "https://assets.example.com/old-scene.png",
    });

    const { result } = renderHook(() => useJourneysCompanionVisual());

    expect(result.current.launcherAwayImageUrl).toBeNull();
    expect(result.current.launcherAwayUsesPortraitShell).toBe(false);
    expect(result.current.launcherAwayHasTransparentBackground).toBe(false);
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
