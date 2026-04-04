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
        transform: "translate(1.906%, 9.668%) scale(1.08)",
      },
    });
  });

  it("detects preset portrait assets and resolves portrait framing from bundled metadata", () => {
    expect(
      isCompanionPresetImageSource("/companion-presets/buttercat/t1_youth/normal/buttercat__t1_youth__normal__fire.png"),
    ).toBe(true);

    expect(
      getBundledCompanionImageFocalPoint("/companion-presets/buttercat/t1_youth/normal/buttercat__t1_youth__normal__fire.png"),
    ).toEqual({
      x: 0.500977,
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
        transform: "translate(-0.098%, 2.930%) scale(1.08)",
      },
    });
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
