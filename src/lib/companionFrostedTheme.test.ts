import { describe, expect, it } from "vitest";
import {
  COMPANION_FROSTED_FALLBACK_COLOR,
  getCompanionFrostedThemeStyle,
  normalizeCompanionFrostedColor,
} from "./companionFrostedTheme";

const hslParts = (value: string) => {
  const [hue, saturation, lightness] = value.split(" ");
  return {
    hue: Number(hue),
    saturation: Number(saturation.replace("%", "")),
    lightness: Number(lightness.replace("%", "")),
  };
};

const rgbParts = (value: string) => value.split(",").map((part) => Number(part.trim()));

describe("companionFrostedTheme", () => {
  it("normalizes full and short hex colors", () => {
    expect(normalizeCompanionFrostedColor("#9B6BFF")).toBe("#9b6bff");
    expect(normalizeCompanionFrostedColor("abc")).toBe("#aabbcc");
  });

  it("derives a purple frosted theme from a companion favorite color", () => {
    const style = getCompanionFrostedThemeStyle("#9b6bff");

    expect(style["--companion-frosted-color"]).toBe("#9b6bff");
    expect(style["--companion-frosted-primary"]).toBe("259 78% 70%");
    expect(style["--companion-frosted-celestial-blue"]).toBe("259 96% 78%");
    expect(style["--companion-frosted-ring"]).toBe("259 94% 74%");
  });

  it("keeps gold and green hues as the frosted anchor", () => {
    const gold = hslParts(getCompanionFrostedThemeStyle("#f5b942")["--companion-frosted-primary"]);
    const green = hslParts(getCompanionFrostedThemeStyle("#58d68d")["--companion-frosted-primary"]);

    expect(gold.hue).toBeGreaterThanOrEqual(38);
    expect(gold.hue).toBeLessThanOrEqual(41);
    expect(green.hue).toBeGreaterThanOrEqual(143);
    expect(green.hue).toBeLessThanOrEqual(146);
  });

  it("darkens silver enough to stay legible as a frosted primary", () => {
    const style = getCompanionFrostedThemeStyle("#d6dee8");
    const silver = hslParts(style["--companion-frosted-primary"]);
    const silverShadowRgb = rgbParts(style["--companion-frosted-primary-rgb"]);

    expect(silver.saturation).toBeGreaterThanOrEqual(42);
    expect(silver.lightness).toBeLessThanOrEqual(70);
    expect(style["--companion-frosted-primary-rgb"]).not.toBe("214, 222, 232");
    expect(Math.max(...silverShadowRgb)).toBeLessThanOrEqual(212);
  });

  it("falls back to the existing blue when the color is invalid or missing", () => {
    expect(getCompanionFrostedThemeStyle(null)["--companion-frosted-color"]).toBe(
      COMPANION_FROSTED_FALLBACK_COLOR,
    );
    expect(getCompanionFrostedThemeStyle("not-a-color")["--companion-frosted-primary"]).toBe(
      "202 68% 68%",
    );
  });
});
