import { describe, expect, it } from "vitest";

import {
  getCompanionReactionAnimationUrl,
  getDailyFormationAnimationUrl,
  getDailyFormationStillUrl,
} from "./gracewardMotion";

describe("Graceward motion asset resolution", () => {
  it.each([
    ["lion", "light"],
    ["lion", "nature"],
    ["dove", "light"],
    ["dove", "nature"],
  ] as const)("covers every formation pillar for %s + %s", (species, element) => {
    (["Mind", "Body", "Soul"] as const).forEach((category) => {
      const input = { species, element, category, dateKey: "2026-08-11" };
      const video = getDailyFormationAnimationUrl(input);
      const still = getDailyFormationStillUrl(input);

      expect(video).toMatch(
        new RegExp(`^/graceward-motion/v1/${species}/${element}/${category.toLowerCase()}-[123]\\.mp4$`),
      );
      expect(still).toBe(video?.replace(/\.mp4$/, ".jpg"));
    });
  });

  it("keeps the video and settled portrait on the same daily variant", () => {
    const input = {
      species: "lion",
      element: "light",
      category: "Mind" as const,
      dateKey: "2026-08-11",
    };

    const video = getDailyFormationAnimationUrl(input);
    const still = getDailyFormationStillUrl(input);

    expect(video).toMatch(/^\/graceward-motion\/v1\/lion\/light\/mind-[123]\.mp4$/);
    expect(still).toBe(video?.replace(/\.mp4$/, ".jpg"));
  });

  it("never falls back to a different species or element", () => {
    expect(getDailyFormationAnimationUrl({
      species: "lamb",
      element: "light",
      category: "Soul",
      dateKey: "2026-08-11",
    })).toBeNull();
    expect(getDailyFormationStillUrl({
      species: "lion",
      element: "fire",
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
  });
});
