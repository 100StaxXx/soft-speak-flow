import { describe, expect, it } from "vitest";

import {
  getCompanionReactionAnimationUrl,
  getDailyFormationAssetDescriptor,
} from "./gracewardMotion";

describe("Graceward motion asset resolution", () => {
  it.each([
    ["lamb", "fire", "Body", 5, /body-1\.mp4$/],
    ["lion", "light", "Mind", 1, /mind-[12]\.mp4$/],
    ["dove", "nature", "Mind", 1, /mind-[123]\.mp4$/],
    ["wolf", "light", "Mind", 1, /mind-[123]\.mp4$/],
  ] as const)("resolves a reviewed launch clip for %s + %s + %s", (
    species,
    element,
    category,
    stage,
    expectedPath,
  ) => {
    const asset = getDailyFormationAssetDescriptor({
      species,
      element,
      stage,
      category,
      dateKey: "2026-08-11",
    });

    expect(asset?.videoStoragePath).toMatch(expectedPath);
    expect(asset?.stillStoragePath).toBe(
      asset?.videoStoragePath.replace(/\.mp4$/, ".jpg"),
    );
  });

  it("keeps the video and settled portrait on the same daily stage and variant", () => {
    const input = {
      species: "lamb",
      element: "light",
      stage: 5,
      category: "Mind" as const,
      dateKey: "2026-08-11",
    };

    const asset = getDailyFormationAssetDescriptor(input);

    expect(asset?.videoStoragePath).toMatch(
      /^premade\/v1\/graceward\/lamb\/light\/formation\/level-5\/mind-1\.mp4$/,
    );
    expect(asset?.stillStoragePath).toBe(
      asset?.videoStoragePath.replace(/\.mp4$/, ".jpg"),
    );
  });

  it("returns no remote media for unpublished category and identity combinations", () => {
    expect(getDailyFormationAssetDescriptor({
      species: "lion",
      element: "light",
      stage: 1,
      category: "Body",
      dateKey: "2026-08-11",
    })).toBeNull();
    expect(getDailyFormationAssetDescriptor({
      species: "eagle",
      element: "fire",
      stage: 5,
      category: "Soul",
      dateKey: "2026-08-11",
    })).toBeNull();
  });

  it("never falls back to a different product species or unpublished stage", () => {
    expect(getDailyFormationAssetDescriptor({
      species: "phoenix",
      element: "light",
      stage: 1,
      category: "Soul",
      dateKey: "2026-08-11",
    })).toBeNull();
    expect(getDailyFormationAssetDescriptor({
      species: "lion",
      element: "fire",
      stage: 13,
      category: "Body",
      dateKey: "2026-08-11",
    })).toBeNull();
  });

  it("resolves exact reactions only for the pilot matrix", () => {
    expect(getCompanionReactionAnimationUrl({
      species: "dove",
      element: "nature",
      reaction: "celebrate",
    })).toBe("/graceward-motion/v1/dove/nature/reaction-celebrate.mp4");
    expect(getCompanionReactionAnimationUrl({
      species: "eagle",
      element: "nature",
      reaction: "celebrate",
    })).toBeNull();
    expect(getCompanionReactionAnimationUrl({
      species: "wolf",
      element: "nature",
      reaction: "celebrate",
    })).toBeNull();
  });
});
