import { beforeEach, describe, expect, it, vi } from "vitest";

const getPublicUrlMock = vi.hoisted(() =>
  vi.fn((assetPath: string) => ({
    data: {
      publicUrl: `https://example.supabase.co/storage/v1/object/public/companion-presets/${assetPath}`,
    },
  })),
);

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    storage: {
      from: () => ({
        getPublicUrl: getPublicUrlMock,
      }),
    },
  },
}));

import {
  getPresetCompanionExpressiveAssetUrl,
  getPresetCompanionAssetUrl,
  getUniversalEggCutoutAssetUrl,
  getUniversalEggAssetUrl,
  normalizeCompanionStoredImageUrl,
  resolveCompanionExpressiveAssetUrl,
  resolveCompanionVisualAssetUrl,
} from "./companionAssetResolver";

describe("companion asset resolver", () => {
  beforeEach(() => {
    getPublicUrlMock.mockClear();
  });

  it("keeps bundled youth art for early stages", () => {
    expect(
      getPresetCompanionAssetUrl({
        presetId: "griffin",
        stage: 1,
        element: "fire",
        state: "normal",
      }),
    ).toBe("/companion-presets/griffin/t1_youth/normal/griffin__t1_youth__normal__fire.png");
    expect(getPublicUrlMock).not.toHaveBeenCalled();
  });

  it("keeps bundled youth relative URLs intact when normalizing stored image paths", () => {
    expect(
      normalizeCompanionStoredImageUrl(
        "/companion-presets/griffin/t1_youth/normal/griffin__t1_youth__normal__fire.png",
      ),
    ).toBe("/companion-presets/griffin/t1_youth/normal/griffin__t1_youth__normal__fire.png");
    expect(getPublicUrlMock).not.toHaveBeenCalled();
  });

  it("resolves Initiate normal art from remote storage for newly covered presets", () => {
    expect(
      getPresetCompanionAssetUrl({
        presetId: "griffin",
        stage: 5,
        element: "fire",
        state: "normal",
      }),
    ).toBe(
      "https://example.supabase.co/storage/v1/object/public/companion-presets/griffin/t2_guardian/normal/griffin__t2_guardian__normal__fire.png",
    );
  });

  it("normalizes relative remote preset URLs for legacy stage 2 companions", () => {
    expect(
      resolveCompanionVisualAssetUrl(
        {
          preset_id: null,
          current_stage: 8,
          core_element: "ice",
          current_image_url:
            "/companion-presets/fox/t2_guardian/normal/fox__t2_guardian__normal__ice.png",
        },
        "normal",
      ),
    ).toBe(
      "https://example.supabase.co/storage/v1/object/public/companion-presets/fox/t2_guardian/normal/fox__t2_guardian__normal__ice.png",
    );
  });

  it("falls back for missing Initiate neglected and dormant preset art", () => {
    expect(
      getPresetCompanionAssetUrl({
        presetId: "griffin",
        stage: 5,
        element: "fire",
        state: "neglected",
      }),
    ).toBeNull();

    expect(
      resolveCompanionVisualAssetUrl(
        {
          preset_id: "griffin",
          current_stage: 5,
          core_element: "fire",
          current_image_url: "https://example.com/current.png",
          neglected_image_url: "https://example.com/neglected.png",
        },
        "neglected",
      ),
    ).toBe("https://example.com/neglected.png");

    expect(
      resolveCompanionVisualAssetUrl(
        {
          preset_id: "griffin",
          current_stage: 5,
          core_element: "fire",
          current_image_url: "https://example.com/current.png",
          dormant_image_url: null,
        },
        "dormant",
      ),
    ).toBe("https://example.com/current.png");
  });

  it("always uses the bundled elemental egg art at stage 0", () => {
    expect(
      resolveCompanionVisualAssetUrl(
        {
          preset_id: "griffin",
          current_stage: 0,
          core_element: "storm",
          current_image_url: "https://example.com/broken-stage-zero-image.png",
        },
        "normal",
      ),
    ).toBe(getUniversalEggAssetUrl("storm"));
  });

  it("keeps AI generated companions on bundled elemental egg art at stage 0", () => {
    expect(
      resolveCompanionVisualAssetUrl(
        {
          preset_id: null,
          current_stage: 0,
          core_element: "nature",
          current_image_url: "https://example.com/generated-stage-zero-egg.png",
          initial_image_url: "https://example.com/generated-stage-zero-egg.png",
        },
        "normal",
      ),
    ).toBe(getUniversalEggAssetUrl("nature"));
  });

  it("keeps Graceward on its last approved portrait beyond the Level 5 launch pack", () => {
    expect(
      resolveCompanionVisualAssetUrl({
        product_mode: "graceward",
        preset_id: null,
        spirit_animal: "Lion",
        current_stage: 18,
        core_element: "light",
        current_image_url: "https://example.com/legacy-generated-lion.png",
      }),
    ).toBe("https://example.com/legacy-generated-lion.png");
  });

  it("keeps stage 0 companions on bundled elemental egg art for every visual state", () => {
    const stageZeroCompanion = {
      preset_id: null,
      current_stage: 0,
      core_element: "void",
      current_image_url: "https://example.com/generated-stage-zero-egg.png",
      initial_image_url: "https://example.com/generated-stage-zero-egg.png",
      dormant_image_url: "https://example.com/generated-dormant-stage-zero-egg.png",
      neglected_image_url: "https://example.com/generated-neglected-stage-zero-egg.png",
    };

    expect(resolveCompanionVisualAssetUrl(stageZeroCompanion, "normal")).toBe(getUniversalEggAssetUrl("void"));
    expect(resolveCompanionVisualAssetUrl(stageZeroCompanion, "dormant")).toBe(getUniversalEggAssetUrl("void"));
    expect(resolveCompanionVisualAssetUrl(stageZeroCompanion, "neglected")).toBe(getUniversalEggAssetUrl("void"));
  });

  it("exposes transparent stage 0 elemental egg cutouts for launcher art", () => {
    expect(getUniversalEggCutoutAssetUrl("storm")).toBe(
      "/companion-eggs/egg__t0_egg__normal__storm.png",
    );
  });

  it("keeps preset-backed companions on the shared egg art before hatch", () => {
    expect(
      getPresetCompanionAssetUrl({
        presetId: "dragon",
        stage: 0,
        element: "light",
        state: "normal",
      }),
    ).toBeNull();

    expect(
      resolveCompanionVisualAssetUrl(
        {
          preset_id: "dragon",
          current_stage: 0,
          core_element: "light",
          current_image_url:
            "https://example.supabase.co/storage/v1/object/public/companion-presets/dragon/t0_egg/normal/dragon__t0_egg__normal__light.png",
        },
        "normal",
      ),
    ).toBe(getUniversalEggAssetUrl("light"));
    expect(getPublicUrlMock).not.toHaveBeenCalled();
  });

  it("does not invent higher-tier remote coverage before those files exist", () => {
    expect(
      getPresetCompanionAssetUrl({
        presetId: "dragon",
        stage: 21,
        element: "storm",
        state: "dormant",
      }),
    ).toBeNull();
  });

  it("keeps an unsupported legacy companion on its last approved later-stage portrait", () => {
    expect(
      resolveCompanionVisualAssetUrl({
        preset_id: "dragon",
        spirit_animal: "Dragon",
        current_stage: 21,
        core_element: "storm",
        current_image_url: "https://example.com/approved-dragon-stage-5.png",
      }),
    ).toBe("https://example.com/approved-dragon-stage-5.png");
  });

  it("keeps bundled canonical later-stage URLs local when normalizing stored values", () => {
    const url = "/companion-presets/phoenix/t6_mythic/normal/phoenix__t6_mythic__normal__nature.png";
    expect(normalizeCompanionStoredImageUrl(url)).toBe(url);
    expect(getPublicUrlMock).not.toHaveBeenCalled();
  });

  it("uses canonical Cosmiq stage art for a legacy Kitsune without a preset id", () => {
    expect(
      resolveCompanionVisualAssetUrl({
        preset_id: null,
        spirit_animal: "Kitsune",
        current_stage: 36,
        core_element: "nature",
        current_image_url: "https://example.com/old-generated-kitsune.png",
      }),
    ).toBe(
      "/companion-presets/fox/t5_champion/normal/fox__t5_champion__normal__nature.png",
    );
  });

  it("does not resolve missing bundled hatchling expressive art", () => {
    expect(
      getPresetCompanionExpressiveAssetUrl({
        presetId: "griffin",
        stage: 1,
        element: "fire",
        mood: "happy",
        variant: 3,
      }),
    ).toBeNull();
    expect(getPublicUrlMock).not.toHaveBeenCalled();
  });

  it("does not resolve missing remote initiate expressive art", () => {
    expect(
      getPresetCompanionExpressiveAssetUrl({
        presetId: "griffin",
        stage: 5,
        element: "fire",
        mood: "excited",
        variant: 2,
      }),
    ).toBeNull();
  });

  it("falls back to normal portraits when expressive tiers are not covered yet", () => {
    expect(
      getPresetCompanionExpressiveAssetUrl({
        presetId: "griffin",
        stage: 21,
        element: "fire",
        mood: "calm",
        variant: 4,
      }),
    ).toBeNull();
  });

  it("falls back from expressive URLs for all current preset stages", () => {
    expect(
      resolveCompanionExpressiveAssetUrl(
        {
          preset_id: "griffin",
          current_stage: 5,
          core_element: "fire",
        },
        {
          mood: "sleepy",
          variant: 5,
        },
      ),
    ).toBeNull();

    expect(
      resolveCompanionExpressiveAssetUrl(
        {
          preset_id: "griffin",
          current_stage: 0,
          core_element: "fire",
        },
        {
          mood: "sleepy",
          variant: 5,
        },
      ),
    ).toBeNull();
  });
});
