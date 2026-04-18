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

  it("keeps full-coverage presets on the shared egg art before hatch", () => {
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

  it("preserves higher-tier remote coverage for existing remote presets", () => {
    expect(
      getPresetCompanionAssetUrl({
        presetId: "dragon",
        stage: 21,
        element: "storm",
        state: "dormant",
      }),
    ).toBe(
      "https://example.supabase.co/storage/v1/object/public/companion-presets/dragon/t3_champion/dormant/dragon__t3_champion__dormant__storm.png",
    );
  });

  it("resolves bundled hatchling expressive art from the public companion preset pack", () => {
    expect(
      getPresetCompanionExpressiveAssetUrl({
        presetId: "griffin",
        stage: 1,
        element: "fire",
        mood: "happy",
        variant: 3,
      }),
    ).toBe(
      "/companion-presets/griffin/t1_youth/happy/griffin__t1_youth__happy__v3__fire.png",
    );
    expect(getPublicUrlMock).not.toHaveBeenCalled();
  });

  it("resolves remote initiate expressive art for active preset tiers", () => {
    expect(
      getPresetCompanionExpressiveAssetUrl({
        presetId: "griffin",
        stage: 5,
        element: "fire",
        mood: "excited",
        variant: 2,
      }),
    ).toBe(
      "https://example.supabase.co/storage/v1/object/public/companion-presets/griffin/t2_guardian/excited/griffin__t2_guardian__excited__v2__fire.png",
    );
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

  it("resolves expressive URLs from companion records only for post-hatch preset companions", () => {
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
    ).toBe(
      "https://example.supabase.co/storage/v1/object/public/companion-presets/griffin/t2_guardian/sleepy/griffin__t2_guardian__sleepy__v5__fire.png",
    );

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
