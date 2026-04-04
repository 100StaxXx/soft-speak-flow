import sharp from "sharp";
import { describe, expect, it } from "vitest";

import {
  buildPortraitAssetBuffer,
  getAlphaBounds,
  validatePortraitAsset,
} from "../../scripts/companion-portrait-pipeline.mjs";

describe("companion portrait pipeline", () => {
  it("builds square portraits with transparent padding and removes stray edge fragments", async () => {
    const syntheticPanel = Buffer.from(`
      <svg xmlns="http://www.w3.org/2000/svg" width="341" height="512" viewBox="0 0 341 512">
        <rect width="341" height="512" fill="transparent" />
        <ellipse cx="168" cy="276" rx="102" ry="136" fill="#ff8a00" />
        <circle cx="170" cy="240" r="18" fill="#1f2937" />
        <circle cx="323" cy="262" r="18" fill="#60a5fa" />
      </svg>
    `);

    const output = await buildPortraitAssetBuffer(syntheticPanel);
    const validation = await validatePortraitAsset(output);
    const bounds = await getAlphaBounds(output);

    expect(validation.errors).toEqual([]);
    expect(bounds.width).toBe(512);
    expect(bounds.height).toBe(512);
    expect(bounds.transparentPixels).toBeGreaterThan(40_000);
    expect(bounds.bounds?.maxX ?? 0).toBeLessThan(455);
  });

  it("flags opaque portrait tiles that still carry baked-in backgrounds", async () => {
    const opaqueTile = await sharp({
      create: {
        width: 512,
        height: 512,
        channels: 4,
        background: { r: 255, g: 255, b: 255, alpha: 1 },
      },
    })
      .png()
      .toBuffer();

    const validation = await validatePortraitAsset(opaqueTile);

    expect(validation.errors).toContain("Portrait output must retain transparent background padding.");
  });
});
