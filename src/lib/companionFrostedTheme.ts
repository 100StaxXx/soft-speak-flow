import type { CSSProperties } from "react";

export const COMPANION_FROSTED_THEME_SCOPE_CLASS = "companion-frosted-theme-scope";
export const COMPANION_FROSTED_QUEST_LIGHT_CLASS = "companion-frosted-quest-light";
export const COMPANION_FROSTED_PLANNER_LIGHT_CLASS = "companion-frosted-planner-light";
export const COMPANION_FROSTED_PLANNER_DARK_CLASS = "companion-frosted-planner-dark";

export const COMPANION_FROSTED_FALLBACK_COLOR = "#52b7ff";

export type CompanionFrostedThemeStyle = CSSProperties & Record<`--${string}`, string>;

interface RgbColor {
  r: number;
  g: number;
  b: number;
}

interface HslColor {
  h: number;
  s: number;
  l: number;
}

const FALLBACK_THEME: CompanionFrostedThemeStyle = {
  "--companion-frosted-color": COMPANION_FROSTED_FALLBACK_COLOR,
  "--companion-frosted-background": "202 100% 98%",
  "--companion-frosted-card": "0 0% 100%",
  "--companion-frosted-secondary": "203 78% 96%",
  "--companion-frosted-muted": "205 68% 94%",
  "--companion-frosted-border": "201 100% 86%",
  "--companion-frosted-input": "202 100% 94%",
  "--companion-frosted-popover": "0 0% 100%",
  "--companion-frosted-primary": "202 68% 68%",
  "--companion-frosted-accent": "204 100% 91%",
  "--companion-frosted-ring": "202 82% 73%",
  "--companion-frosted-celestial-blue": "202 92% 76%",
  "--companion-frosted-background-dark": "224 42% 10%",
  "--companion-frosted-card-dark": "226 32% 16%",
  "--companion-frosted-secondary-dark": "224 28% 21%",
  "--companion-frosted-muted-dark": "224 24% 23%",
  "--companion-frosted-border-dark": "214 32% 29%",
  "--companion-frosted-input-dark": "224 28% 21%",
  "--companion-frosted-popover-dark": "226 32% 16%",
  "--companion-frosted-primary-dark": "201 92% 58%",
  "--companion-frosted-accent-dark": "202 70% 24%",
  "--companion-frosted-ring-dark": "201 92% 58%",
  "--companion-frosted-celestial-blue-dark": "202 88% 58%",
  "--companion-frosted-primary-rgb": "82, 183, 255",
  "--companion-frosted-shadow-glow": "0 0 30px hsl(202 68% 68% / 0.32)",
  "--companion-frosted-shadow-glow-lg":
    "0 0 40px hsl(202 68% 68% / 0.38), 0 0 80px hsl(202 68% 68% / 0.22)",
};

const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value));

const wrapHue = (value: number): number => {
  const normalized = value % 360;
  return normalized < 0 ? normalized + 360 : normalized;
};

const formatHsl = (h: number, s: number, l: number): string =>
  `${Math.round(wrapHue(h))} ${Math.round(clamp(s, 0, 100))}% ${Math.round(clamp(l, 0, 100))}%`;

const hslToRgb = ({ h, s, l }: HslColor): RgbColor => {
  const saturation = clamp(s, 0, 100) / 100;
  const lightness = clamp(l, 0, 100) / 100;
  const chroma = (1 - Math.abs(2 * lightness - 1)) * saturation;
  const huePrime = wrapHue(h) / 60;
  const x = chroma * (1 - Math.abs((huePrime % 2) - 1));

  let red = 0;
  let green = 0;
  let blue = 0;

  if (huePrime < 1) {
    red = chroma;
    green = x;
  } else if (huePrime < 2) {
    red = x;
    green = chroma;
  } else if (huePrime < 3) {
    green = chroma;
    blue = x;
  } else if (huePrime < 4) {
    green = x;
    blue = chroma;
  } else if (huePrime < 5) {
    red = x;
    blue = chroma;
  } else {
    red = chroma;
    blue = x;
  }

  const match = lightness - chroma / 2;

  return {
    r: Math.round((red + match) * 255),
    g: Math.round((green + match) * 255),
    b: Math.round((blue + match) * 255),
  };
};

const formatRgb = ({ r, g, b }: RgbColor): string => `${r}, ${g}, ${b}`;

export const normalizeCompanionFrostedColor = (
  favoriteColor?: string | null,
): string | null => {
  if (!favoriteColor) return null;
  const trimmed = favoriteColor.trim();

  const sixDigit = /^#?[0-9a-f]{6}$/i;
  if (sixDigit.test(trimmed)) {
    return `#${trimmed.replace("#", "").toLowerCase()}`;
  }

  const threeDigit = /^#?[0-9a-f]{3}$/i;
  if (threeDigit.test(trimmed)) {
    const value = trimmed.replace("#", "").toLowerCase();
    return `#${value.split("").map((char) => `${char}${char}`).join("")}`;
  }

  return null;
};

const hexToRgb = (hex: string): RgbColor => {
  const normalized = hex.slice(1);
  return {
    r: Number.parseInt(normalized.slice(0, 2), 16),
    g: Number.parseInt(normalized.slice(2, 4), 16),
    b: Number.parseInt(normalized.slice(4, 6), 16),
  };
};

const rgbToHsl = ({ r, g, b }: RgbColor): HslColor => {
  const red = r / 255;
  const green = g / 255;
  const blue = b / 255;
  const max = Math.max(red, green, blue);
  const min = Math.min(red, green, blue);
  const delta = max - min;
  const lightness = (max + min) / 2;

  let hue = 0;
  if (delta > 0) {
    if (max === red) {
      hue = ((green - blue) / delta) % 6;
    } else if (max === green) {
      hue = (blue - red) / delta + 2;
    } else {
      hue = (red - green) / delta + 4;
    }
    hue *= 60;
  }

  const saturation = delta === 0 ? 0 : delta / (1 - Math.abs(2 * lightness - 1));

  return {
    h: wrapHue(hue),
    s: saturation * 100,
    l: lightness * 100,
  };
};

const deriveThemeFromColor = (hex: string): CompanionFrostedThemeStyle => {
  const rgb = hexToRgb(hex);
  const { h, s, l } = rgbToHsl(rgb);
  const baseSat = clamp(s, 42, 78);
  const vividSat = clamp(s + 12, 56, 94);
  const tintSat = clamp(s + 18, 58, 96);
  const primaryLight = clamp(l, 52, 70);
  const tintHue = h;
  const primaryHsl = formatHsl(tintHue, baseSat, primaryLight);
  const primaryRgb = hslToRgb({ h: tintHue, s: baseSat, l: primaryLight });

  return {
    "--companion-frosted-color": hex,
    "--companion-frosted-background": formatHsl(tintHue, tintSat, 98),
    "--companion-frosted-card": "0 0% 100%",
    "--companion-frosted-secondary": formatHsl(tintHue, tintSat, 96),
    "--companion-frosted-muted": formatHsl(tintHue, clamp(s + 6, 40, 82), 94),
    "--companion-frosted-border": formatHsl(tintHue, tintSat, 86),
    "--companion-frosted-input": formatHsl(tintHue, tintSat, 94),
    "--companion-frosted-popover": "0 0% 100%",
    "--companion-frosted-primary": primaryHsl,
    "--companion-frosted-accent": formatHsl(tintHue, tintSat, 91),
    "--companion-frosted-ring": formatHsl(tintHue, vividSat, clamp(primaryLight + 5, 58, 74)),
    "--companion-frosted-celestial-blue": formatHsl(tintHue, tintSat, clamp(primaryLight + 8, 66, 78)),
    "--companion-frosted-background-dark": formatHsl(tintHue, clamp(s, 34, 58), 10),
    "--companion-frosted-card-dark": formatHsl(tintHue, clamp(s, 30, 52), 16),
    "--companion-frosted-secondary-dark": formatHsl(tintHue, clamp(s, 28, 48), 21),
    "--companion-frosted-muted-dark": formatHsl(tintHue, clamp(s, 24, 44), 23),
    "--companion-frosted-border-dark": formatHsl(tintHue, clamp(s, 30, 58), 29),
    "--companion-frosted-input-dark": formatHsl(tintHue, clamp(s, 28, 48), 21),
    "--companion-frosted-popover-dark": formatHsl(tintHue, clamp(s, 30, 52), 16),
    "--companion-frosted-primary-dark": formatHsl(tintHue, vividSat, 58),
    "--companion-frosted-accent-dark": formatHsl(tintHue, clamp(s, 42, 70), 24),
    "--companion-frosted-ring-dark": formatHsl(tintHue, vividSat, 58),
    "--companion-frosted-celestial-blue-dark": formatHsl(tintHue, clamp(s + 8, 58, 88), 58),
    "--companion-frosted-primary-rgb": formatRgb(primaryRgb),
    "--companion-frosted-shadow-glow":
      `0 0 30px hsl(${primaryHsl} / 0.32)`,
    "--companion-frosted-shadow-glow-lg":
      `0 0 40px hsl(${primaryHsl} / 0.38), `
      + `0 0 80px hsl(${primaryHsl} / 0.22)`,
  };
};

export const getCompanionFrostedThemeStyle = (
  favoriteColor?: string | null,
): CompanionFrostedThemeStyle => {
  const normalized = normalizeCompanionFrostedColor(favoriteColor);
  if (!normalized) {
    return { ...FALLBACK_THEME };
  }

  return deriveThemeFromColor(normalized);
};
