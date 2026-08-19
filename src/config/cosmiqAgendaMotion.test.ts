import { describe, expect, it } from "vitest";
import {
  COSMIQ_AGENDA_MOTION_RECIPES,
  getCosmiqAgendaMotionAssetDescriptor,
  getExpectedCosmiqAgendaMotionAssets,
} from "./cosmiqAgendaMotion";

describe("cosmiqAgendaMotion", () => {
  it("defines 27 reusable agenda reactions per stage", () => {
    expect(COSMIQ_AGENDA_MOTION_RECIPES).toHaveLength(27);
  });

  it("enumerates the full 13 species x 6 elements x 7 stages matrix", () => {
    const assets = getExpectedCosmiqAgendaMotionAssets();
    expect(assets).toHaveLength(14_742);
    expect(new Set(assets.map((asset) => asset.videoStoragePath)).size).toBe(14_742);
    expect(new Set(assets.map((asset) => asset.stillStoragePath)).size).toBe(14_742);
  });

  it("uses the current visual stage boundary and a stable seeded variant", () => {
    const input = {
      species: "kitsune",
      element: "fire",
      stage: 12,
      eventType: "task-start" as const,
      category: "Mind" as const,
      seed: "task-123:2026-08-15",
    };
    const first = getCosmiqAgendaMotionAssetDescriptor(input);
    const second = getCosmiqAgendaMotionAssetDescriptor(input);

    expect(first).toEqual(second);
    expect(first?.species).toBe("fox");
    expect(first?.boundaryLevel).toBe(5);
    expect(first?.videoStoragePath).toMatch(
      /^premade\/v1\/cosmiq\/fox\/fire\/agenda\/level-5\/task-start\/mind-[1-3]\.mp4$/,
    );
  });

  it("accepts locked production combinations while rejecting legacy species and invalid category shapes", () => {
    expect(getCosmiqAgendaMotionAssetDescriptor({
      species: "wolf",
      element: "storm",
      stage: 1,
      eventType: "ambient",
    })).not.toBeNull();
    expect(getCosmiqAgendaMotionAssetDescriptor({
      species: "raven",
      element: "fire",
      stage: 1,
      eventType: "ambient",
    })).toBeNull();
    expect(getCosmiqAgendaMotionAssetDescriptor({
      species: "fox",
      element: "fire",
      stage: 1,
      eventType: "task-complete",
    })).toBeNull();
    expect(getCosmiqAgendaMotionAssetDescriptor({
      species: "fox",
      element: "fire",
      stage: 1,
      eventType: "ambient",
      category: "Soul",
    })).toBeNull();
  });
});
