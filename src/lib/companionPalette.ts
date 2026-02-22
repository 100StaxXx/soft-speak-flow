const DEFAULT_FAVORITE_COLOR = "#8B5CF6";
const DEFAULT_STAGE = 1;

type CanonicalElement =
  | "fire"
  | "water"
  | "earth"
  | "air"
  | "lightning"
  | "ice"
  | "light"
  | "shadow"
  | "nature"
  | "cosmic"
  | "energy"
  | "spirit";

const ELEMENT_HUES: Record<CanonicalElement, number> = {
  fire: 18,
  water: 202,
  earth: 38,
  air: 192,
  lightning: 50,
  ice: 190,
  light: 48,
  shadow: 266,
  nature: 128,
  cosmic: 292,
  energy: 322,
  spirit: 272,
};

const ELEMENT_ALIASES: Record<string, CanonicalElement> = {
  fire: "fire",
  water: "water",
  earth: "earth",
  air: "air",
  lightning: "lightning",
  storm: "lightning",
  ice: "ice",
  frost: "ice",
  light: "light",
  shadow: "shadow",
  nature: "nature",
  cosmic: "cosmic",
  energy: "energy",
  spirit: "spirit",
};

interface HslColor {
  h: number;
  s: number;
  l: number;
}

export interface CompanionPaletteInput {
  coreElement?: string | null;
  favoriteColor?: string | null;
  stage?: number | null;
  companionId?: string | null;
}

export interface CompanionPalette {
  normalizedElement: string;
  cardGradientA: string;
  cardGradientB: string;
  glow: string;
  accentText: string;
  badgeBg: string;
  badgeBorder: string;
  badgeText: string;
  chipBg: string;
  chipBorder: string;
}

const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value));

const wrapHue = (value: number): number => {
  const normalized = value % 360;
  return normalized < 0 ? normalized + 360 : normalized;
};

const hashString = (value: string): number => {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
};

const isHexColor = (value: string): boolean => /^#[0-9a-f]{6}$/i.test(value.trim());

const normalizeHex = (value?: string | null): string => {
  if (!value) return DEFAULT_FAVORITE_COLOR;
  const trimmed = value.trim();
  if (isHexColor(trimmed)) {
    return trimmed.toUpperCase();
  }
  if (/^[0-9a-f]{6}$/i.test(trimmed)) {
    return `#${trimmed.toUpperCase()}`;
  }
  return DEFAULT_FAVORITE_COLOR;
};

const hexToHsl = (hex: string): HslColor => {
  const normalized = normalizeHex(hex).slice(1);
  const r = Number.parseInt(normalized.slice(0, 2), 16) / 255;
  const g = Number.parseInt(normalized.slice(2, 4), 16) / 255;
  const b = Number.parseInt(normalized.slice(4, 6), 16) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const delta = max - min;
  const lightness = (max + min) / 2;

  let hue = 0;
  if (delta !== 0) {
    if (max === r) hue = ((g - b) / delta) % 6;
    else if (max === g) hue = (b - r) / delta + 2;
    else hue = (r - g) / delta + 4;
    hue *= 60;
  }

  const saturation =
    delta === 0
      ? 0
      : delta / (1 - Math.abs(2 * lightness - 1));

  return {
    h: wrapHue(hue),
    s: saturation * 100,
    l: lightness * 100,
  };
};

const hsla = (h: number, s: number, l: number, alpha: number): string =>
  `hsla(${Math.round(wrapHue(h))}, ${Math.round(clamp(s, 0, 100))}%, ${Math.round(clamp(l, 0, 100))}%, ${clamp(alpha, 0, 1)})`;

const hsl = (h: number, s: number, l: number): string =>
  `hsl(${Math.round(wrapHue(h))}, ${Math.round(clamp(s, 0, 100))}%, ${Math.round(clamp(l, 0, 100))}%)`;

const normalizedElementFromInput = (value?: string | null): CanonicalElement | "unknown" => {
  if (!value) return "unknown";
  const normalized = value.trim().toLowerCase();
  return ELEMENT_ALIASES[normalized] ?? "unknown";
};

export const deriveCompanionPalette = ({
  coreElement,
  favoriteColor,
  stage,
  companionId,
}: CompanionPaletteInput): CompanionPalette => {
  const safeStage = Number.isFinite(stage) ? Math.max(0, Number(stage)) : DEFAULT_STAGE;
  const safeColor = normalizeHex(favoriteColor);
  const anchor = hexToHsl(safeColor);
  const normalizedElement = normalizedElementFromInput(coreElement);

  const unknownElementHashHue = hashString(coreElement?.trim().toLowerCase() || "unknown-element") % 360;
  const elementHue = normalizedElement === "unknown"
    ? unknownElementHashHue
    : ELEMENT_HUES[normalizedElement];

  const seedSource = `${companionId || "no-id"}:${safeStage}:${safeColor}:${coreElement || "none"}`;
  const seed = hashString(seedSource);
  const idJitter = (seed % 17) - 8;
  const stageShift = ((safeStage * 13 + (seed % 29)) % 58) - 29;

  const accentHue = wrapHue(elementHue + stageShift * 0.9 + idJitter);
  const contrastHue = wrapHue(anchor.h + 160 + safeStage * 7 + (seed % 23) - 11);
  const cardHueA = wrapHue(anchor.h + stageShift * 0.35);
  const cardHueB = wrapHue(accentHue + 22);

  const anchorSat = clamp(anchor.s, 34, 88);
  const anchorLight = clamp(anchor.l, 26, 72);

  const cardGradientA = hsla(cardHueA, clamp(anchorSat + 10, 38, 94), clamp(anchorLight - 18, 16, 46), 0.36);
  const cardGradientB = hsla(cardHueB, clamp(anchorSat + 20, 48, 97), clamp(anchorLight - 10, 22, 54), 0.31);
  const glow = hsla(contrastHue, clamp(anchorSat + 26, 55, 98), clamp(anchorLight + 14, 48, 76), 0.42);
  const accentText = hsl(accentHue, clamp(anchorSat + 22, 52, 100), clamp(anchorLight + 16, 56, 82));
  const badgeText = hsl(accentHue, clamp(anchorSat + 26, 58, 100), clamp(anchorLight + 26, 66, 90));
  const badgeBorder = hsla(accentHue, clamp(anchorSat + 20, 44, 97), clamp(anchorLight + 8, 48, 78), 0.54);
  const badgeBg = `linear-gradient(135deg, ${hsla(cardHueA, clamp(anchorSat + 12, 44, 95), clamp(anchorLight - 8, 30, 58), 0.48)}, ${hsla(accentHue, clamp(anchorSat + 18, 52, 97), clamp(anchorLight + 2, 36, 64), 0.44)})`;
  const chipBg = `linear-gradient(135deg, ${hsla(cardHueA, clamp(anchorSat + 8, 34, 92), clamp(anchorLight - 10, 22, 54), 0.24)}, ${hsla(contrastHue, clamp(anchorSat + 18, 52, 97), clamp(anchorLight + 5, 34, 66), 0.2)})`;
  const chipBorder = hsla(contrastHue, clamp(anchorSat + 14, 42, 95), clamp(anchorLight + 10, 48, 80), 0.28);

  return {
    normalizedElement,
    cardGradientA,
    cardGradientB,
    glow,
    accentText,
    badgeBg,
    badgeBorder,
    badgeText,
    chipBg,
    chipBorder,
  };
};
