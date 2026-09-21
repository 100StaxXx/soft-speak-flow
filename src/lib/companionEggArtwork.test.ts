import { readdir } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { describe, expect, it } from "vitest";

const ELEMENTS = ["fire", "ice", "light", "nature", "storm", "void"] as const;

const getAssetPath = (relativePath: string) =>
  path.resolve(process.cwd(), "public", relativePath);

const expectTransparentCorners = async (assetPath: string) => {
  const { data, info } = await sharp(assetPath)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const alphaAt = (x: number, y: number) =>
    data[(y * info.width + x) * info.channels + 3];

  expect([
    alphaAt(0, 0),
    alphaAt(info.width - 1, 0),
    alphaAt(0, info.height - 1),
    alphaAt(info.width - 1, info.height - 1),
  ]).toEqual([0, 0, 0, 0]);
};

describe("bundled companion egg artwork", () => {
  it("keeps every elemental egg on square transparent canvases", async () => {
    for (const element of ELEMENTS) {
      const variants = [
        {
          path: getAssetPath(`companion-eggs/egg__t0_egg__normal__${element}.png`),
          size: 512,
        },
        {
          path: getAssetPath(`companion-eggs/v2/egg__t0_egg__normal__${element}.webp`),
          size: 900,
        },
      ];

      for (const variant of variants) {
        const metadata = await sharp(variant.path).metadata();
        expect(metadata).toMatchObject({
          width: variant.size,
          height: variant.size,
          hasAlpha: true,
        });
        await expectTransparentCorners(variant.path);
      }
    }
  });

  it("keeps every bundled preset and launcher portrait on transparent square canvases", async () => {
    for (const directory of ["companion-presets", "companion-launcher-away"]) {
      const directoryPath = getAssetPath(directory);
      const relativeFiles = (await readdir(directoryPath, { recursive: true }))
        .filter((filePath) => /\.(png|webp)$/i.test(filePath));

      expect(relativeFiles.length).toBeGreaterThan(0);
      for (const relativeFile of relativeFiles) {
        const assetPath = path.join(directoryPath, relativeFile);
        const metadata = await sharp(assetPath).metadata();
        expect(metadata).toMatchObject({
          width: 512,
          height: 512,
          hasAlpha: true,
        });
        await expectTransparentCorners(assetPath);
      }
    }
  });
});
