import { describe, expect, it } from "vitest";

import {
  isAiGeneratedCompanion,
  isPresetBackedCompanion,
  isPresetEggCompanion,
} from "./companionPredicates";

describe("companion product identity predicates", () => {
  it("uses explicit product mode before legacy preset inference", () => {
    const graceward = {
      product_mode: "graceward",
      preset_id: null,
      current_stage: 0,
      current_image_url: "https://example.com/graceward-egg.png",
    } as const;
    const cosmiqEgg = {
      product_mode: "cosmiq",
      preset_id: null,
      current_stage: 0,
      current_image_url: "/companion-eggs/v2/egg__t0_egg__normal__fire.webp",
    } as const;

    expect(isAiGeneratedCompanion(graceward)).toBe(true);
    expect(isPresetBackedCompanion(graceward)).toBe(false);
    expect(isPresetBackedCompanion(cosmiqEgg)).toBe(true);
    expect(isPresetEggCompanion(cosmiqEgg)).toBe(true);
  });

  it("keeps preset-id inference for records loaded before the migration", () => {
    expect(isPresetBackedCompanion({ preset_id: "phoenix" })).toBe(true);
    expect(isPresetBackedCompanion({ preset_id: null })).toBe(false);
  });
});
