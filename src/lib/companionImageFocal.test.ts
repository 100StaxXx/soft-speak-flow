import { describe, expect, it } from "vitest";

import {
  getBundledCompanionImageFocalPoint,
  isCompanionPresetImageSource,
  resolveCompanionImagePresentation,
} from "./companionImageFocal";

describe("companionImageFocal", () => {
  it("resolves bundled storm egg focal metadata for cover presentation", () => {
    expect(
      getBundledCompanionImageFocalPoint("/companion-eggs/egg__t0_egg__normal__storm.png"),
    ).toEqual({
      x: 0.48827,
      y: 0.445313,
    });

    expect(
      resolveCompanionImagePresentation({
        src: "/companion-eggs/egg__t0_egg__normal__storm.png",
        fit: "cover",
      }),
    ).toMatchObject({
      focalSource: "manifest",
      assetKey: "companion-eggs/egg__t0_egg__normal__storm.png",
      style: {
        objectPosition: "50% 33.62588070175439%",
      },
    });
  });

  it("applies contain translation for top-heavy bundled eggs", () => {
    expect(
      resolveCompanionImagePresentation({
        src: "/companion-eggs/egg__t0_egg__normal__nature.png",
        fit: "contain",
      }),
    ).toMatchObject({
      focalSource: "manifest",
      style: {
        transform: "translate(1.906%, 9.668%)",
      },
    });
  });

  it("keeps centered square egg art in the center without a no-op transform", () => {
    expect(
      resolveCompanionImagePresentation({
        src: "/companion-eggs/v2/egg__t0_egg__normal__storm.webp",
        fit: "portrait",
      }),
    ).toMatchObject({
      focalSource: "manifest",
      assetKey: "companion-eggs/v2/egg__t0_egg__normal__storm.webp",
      style: {
        objectPosition: "center center",
      },
    });

    expect(
      resolveCompanionImagePresentation({
        src: "/companion-eggs/v2/egg__t0_egg__normal__storm.webp",
        fit: "portrait",
      }).style.transform,
    ).toBeUndefined();
  });

  it("detects preset portrait assets and resolves portrait framing from bundled metadata", () => {
    expect(
      isCompanionPresetImageSource("/companion-presets/buttercat/t1_youth/normal/buttercat__t1_youth__normal__fire.png"),
    ).toBe(true);

    expect(
      getBundledCompanionImageFocalPoint("/companion-presets/buttercat/t1_youth/normal/buttercat__t1_youth__normal__fire.png"),
    ).toEqual({
      x: 0.5,
      y: 0.470703,
    });

    expect(
      resolveCompanionImagePresentation({
        src: "/companion-presets/buttercat/t1_youth/normal/buttercat__t1_youth__normal__fire.png",
        fit: "portrait",
      }),
    ).toMatchObject({
      focalSource: "manifest",
      assetKey: "companion-presets/buttercat/t1_youth/normal/buttercat__t1_youth__normal__fire.png",
      style: {
        transform: "translate(0.000%, 2.930%)",
      },
    });
  });

  it("resolves remote initiate preset URLs from manifest metadata after import", () => {
    expect(
      getBundledCompanionImageFocalPoint(
        "https://example.supabase.co/storage/v1/object/public/companion-presets/phoenix/t2_guardian/normal/phoenix__t2_guardian__normal__nature.png",
      ),
    ).toEqual({
      x: 0.500977,
      y: 0.470703,
    });

    expect(
      resolveCompanionImagePresentation({
        src: "https://example.supabase.co/storage/v1/object/public/companion-presets/phoenix/t2_guardian/normal/phoenix__t2_guardian__normal__nature.png",
        fit: "portrait",
      }),
    ).toMatchObject({
      focalSource: "manifest",
      assetKey: "companion-presets/phoenix/t2_guardian/normal/phoenix__t2_guardian__normal__nature.png",
      style: {
        transform: "translate(-0.098%, 2.930%)",
      },
    });
  });

  it("keeps generated cover portraits unscaled while using stored focal metadata", () => {
    expect(
      resolveCompanionImagePresentation({
        src: "https://example.com/generated-companion.png",
        fit: "cover",
        focalX: 0.375,
        focalY: 0.625,
      }),
    ).toEqual({
      focalPoint: { x: 0.375, y: 0.625 },
      focalSource: "stored",
      assetKey: null,
      style: {
        objectPosition: "37.5% 62.5%",
      },
    });
  });

  it("uses known source dimensions to center generated landscape cover portraits", () => {
    expect(
      resolveCompanionImagePresentation({
        src: "https://example.com/generated-companion.png",
        fit: "cover",
        focalX: 0.32,
        focalY: 0.68,
        sourceAspectRatio: 1536 / 1024,
      }),
    ).toEqual({
      focalPoint: { x: 0.32, y: 0.68 },
      focalSource: "stored",
      assetKey: null,
      style: {
        objectPosition: "0% 50%",
      },
    });
  });

  it("keeps stored remote portrait focal metadata centered without translating the image", () => {
    const presentation = resolveCompanionImagePresentation({
      src: "https://example.com/generated-companion.png",
      fit: "portrait",
      focalX: 0.32,
      focalY: 0.68,
    });

    expect(presentation).toMatchObject({
      focalPoint: { x: 0.32, y: 0.68 },
      focalSource: "stored",
      assetKey: null,
      style: {
        objectPosition: "center center",
      },
    });
    expect(presentation.style.transform).toBeUndefined();
  });

  it("falls back cleanly for non-bundled images without stored focal metadata", () => {
    expect(
      resolveCompanionImagePresentation({
        src: "https://example.com/companion.png",
        fit: "cover",
      }),
    ).toEqual({
      style: {},
      focalPoint: null,
      focalSource: "default",
      assetKey: null,
    });
  });
});
