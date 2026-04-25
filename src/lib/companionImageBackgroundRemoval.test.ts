import { describe, expect, it } from "vitest";
import {
  isLightCompanionImageBackgroundPixel,
  removeLightBorderBackgroundFromCompanionImage,
} from "./companionImageBackgroundRemoval";

const setPixel = (
  data: Uint8ClampedArray,
  width: number,
  x: number,
  y: number,
  color: readonly [number, number, number, number],
) => {
  const offset = ((y * width) + x) * 4;
  data[offset] = color[0];
  data[offset + 1] = color[1];
  data[offset + 2] = color[2];
  data[offset + 3] = color[3];
};

const getAlpha = (data: Uint8ClampedArray, width: number, x: number, y: number) => {
  const offset = ((y * width) + x) * 4;
  return data[offset + 3];
};

describe("companion image background removal", () => {
  it("recognizes flat light canvas pixels", () => {
    expect(isLightCompanionImageBackgroundPixel(255, 254, 250, 255)).toBe(true);
    expect(isLightCompanionImageBackgroundPixel(220, 250, 214, 255)).toBe(false);
    expect(isLightCompanionImageBackgroundPixel(18, 20, 24, 255)).toBe(false);
    expect(isLightCompanionImageBackgroundPixel(255, 255, 255, 0)).toBe(false);
  });

  it("removes only light background connected to the image border", () => {
    const width = 5;
    const height = 5;
    const data = new Uint8ClampedArray(width * height * 4);

    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        setPixel(data, width, x, y, [252, 251, 247, 255]);
      }
    }

    setPixel(data, width, 2, 2, [78, 122, 45, 255]);
    setPixel(data, width, 3, 2, [248, 248, 244, 255]);

    const result = removeLightBorderBackgroundFromCompanionImage({ data, width, height });

    expect(result.removedPixels).toBeGreaterThan(0);
    expect(getAlpha(result.data, width, 0, 0)).toBe(0);
    expect(getAlpha(result.data, width, 4, 4)).toBe(0);
    expect(getAlpha(result.data, width, 2, 2)).toBe(255);
  });

  it("leaves transparent or non-light bordered art untouched", () => {
    const width = 3;
    const height = 3;
    const data = new Uint8ClampedArray(width * height * 4);

    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        setPixel(data, width, x, y, [20, 35, 52, 255]);
      }
    }

    setPixel(data, width, 1, 1, [248, 248, 244, 255]);

    const result = removeLightBorderBackgroundFromCompanionImage({ data, width, height });

    expect(result.removedPixels).toBe(0);
    expect(getAlpha(result.data, width, 0, 0)).toBe(255);
    expect(getAlpha(result.data, width, 1, 1)).toBe(255);
  });
});
