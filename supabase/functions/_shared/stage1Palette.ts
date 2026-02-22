export interface StageOnePaletteInput {
  companionId: string;
  favoriteColor: string;
  coreElement: string;
}

export interface StageOnePalette {
  anchor: string;
  elementAccent: string;
  contrastAccent: string;
  secondaryAccent: string;
  neutralBalance: string;
  anchorHue: number;
  elementHue: number;
  contrastHue: number;
  secondaryHue: number;
  neutralHue: number;
  distinctHueGroups: number;
  hasWarmHue: boolean;
  hasCoolHue: boolean;
  hueDistances: {
    anchorElement: number;
    anchorContrast: number;
    anchorSecondary: number;
    elementContrast: number;
    elementSecondary: number;
    contrastSecondary: number;
  };
}

export const SYSTEM_PROMPT_STAGE1_COLOR_DISTRIBUTION = `You are generating a Stage 1 hatchling portrait.
Your top priority is species-correct baby anatomy plus aggressive, intentional multi-hue color distribution.

COLOR DISTRIBUTION RULES (MANDATORY):
1. Use the provided five-swatch palette exactly as role guidance.
2. Keep the anchor color dominant but limited to 28-36% while clearly using all other swatches.
3. Ensure both warm and cool hues are visible in the final image.
4. Maintain at least four visually distinct hue groups.
5. Strictly avoid monochrome outputs.

ANTI-MONOCHROME HARD FAILS:
- Do not output single-hue wash.
- Do not tint all materials with only anchor color.
- If output appears mostly one color, rebalance using provided ratio targets.

SPECIES & STYLE RULES:
- Preserve pure baby species identity with correct anatomy and limb count.
- Keep elemental mood visible through ambient effects and accents.
- Stylized fantasy game-art quality with readable, non-muddy color separation.`;

export const STAGE1_COVERAGE_TARGETS = {
  anchor: "28-36%",
  elementAccent: "22-26%",
  contrastAccent: "18-22%",
  secondaryAccent: "14-18%",
  neutralBalance: "8-12%",
} as const;

export const STAGE1_HUE_CONSTRAINTS = {
  minAnchorElementDistance: 64,
  minAnchorContrastDistance: 132,
  minDistinctGroupSeparation: 34,
  minSecondaryDistance: 68,
} as const;

interface HslColor {
  h: number;
  s: number;
  l: number;
}

const DEFAULT_STAGE1_COLOR = "#8B5CF6";
const ELEMENT_HUE_FAMILY: Record<string, number> = {
  fire: 18,
  water: 205,
  earth: 95,
  air: 195,
  lightning: 52,
  ice: 192,
  light: 48,
  shadow: 270,
};

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function wrapHue(value: number): number {
  const normalized = value % 360;
  return normalized < 0 ? normalized + 360 : normalized;
}

function hueDistance(a: number, b: number): number {
  const diff = Math.abs(wrapHue(a) - wrapHue(b));
  return diff > 180 ? 360 - diff : diff;
}

function hashString(input: string): number {
  let hash = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function normalizeHexColor(input: string | null | undefined, fallback = DEFAULT_STAGE1_COLOR): string {
  if (!input) return fallback;
  const trimmed = input.trim();
  if (/^#[0-9a-f]{6}$/i.test(trimmed)) return trimmed.toUpperCase();
  if (/^[0-9a-f]{6}$/i.test(trimmed)) return `#${trimmed.toUpperCase()}`;
  return fallback;
}

function hexToHsl(hexColor: string): HslColor {
  const hex = normalizeHexColor(hexColor).slice(1);
  const r = Number.parseInt(hex.slice(0, 2), 16) / 255;
  const g = Number.parseInt(hex.slice(2, 4), 16) / 255;
  const b = Number.parseInt(hex.slice(4, 6), 16) / 255;

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

  const saturation = delta === 0 ? 0 : delta / (1 - Math.abs(2 * lightness - 1));

  return {
    h: wrapHue(hue),
    s: saturation * 100,
    l: lightness * 100,
  };
}

function hslToHex(h: number, s: number, l: number): string {
  const hue = wrapHue(h);
  const sat = clamp(s, 0, 100) / 100;
  const light = clamp(l, 0, 100) / 100;
  const chroma = (1 - Math.abs(2 * light - 1)) * sat;
  const x = chroma * (1 - Math.abs(((hue / 60) % 2) - 1));
  const m = light - chroma / 2;

  let rPrime = 0;
  let gPrime = 0;
  let bPrime = 0;

  if (hue < 60) {
    rPrime = chroma; gPrime = x; bPrime = 0;
  } else if (hue < 120) {
    rPrime = x; gPrime = chroma; bPrime = 0;
  } else if (hue < 180) {
    rPrime = 0; gPrime = chroma; bPrime = x;
  } else if (hue < 240) {
    rPrime = 0; gPrime = x; bPrime = chroma;
  } else if (hue < 300) {
    rPrime = x; gPrime = 0; bPrime = chroma;
  } else {
    rPrime = chroma; gPrime = 0; bPrime = x;
  }

  const toHex = (value: number) => {
    const channel = Math.round((value + m) * 255);
    return channel.toString(16).padStart(2, "0");
  };

  return `#${toHex(rPrime)}${toHex(gPrime)}${toHex(bPrime)}`.toUpperCase();
}

function isWarmHue(hue: number): boolean {
  const h = wrapHue(hue);
  return h < 70 || h >= 330;
}

function isCoolHue(hue: number): boolean {
  const h = wrapHue(hue);
  return h >= 140 && h <= 260;
}

function countDistinctHueGroups(hues: number[], minSeparation: number): number {
  const groups: number[] = [];
  for (const hue of hues) {
    if (!groups.some((existing) => hueDistance(existing, hue) < minSeparation)) {
      groups.push(hue);
    }
  }
  return groups.length;
}

function selectMostDistinctHue(candidates: number[], anchors: number[], minDistance: number): number {
  let selected = candidates[0];
  let bestScore = -1;

  for (const candidate of candidates) {
    const minObserved = anchors.reduce((acc, anchor) => Math.min(acc, hueDistance(candidate, anchor)), 360);
    const score = minObserved >= minDistance ? 1000 + minObserved : minObserved;
    if (score > bestScore) {
      bestScore = score;
      selected = candidate;
    }
  }

  return wrapHue(selected);
}

function nudgeHueAway(baseHue: number, avoidHue: number, minDistance: number, step: number): number {
  let hue = wrapHue(baseHue);
  let guard = 0;

  while (hueDistance(hue, avoidHue) < minDistance && guard < 16) {
    hue = wrapHue(hue + step);
    guard += 1;
  }

  return hue;
}

function resolveElementHue(coreElement: string, fallbackHue: number): number {
  const key = coreElement.trim().toLowerCase();
  return ELEMENT_HUE_FAMILY[key] ?? wrapHue(fallbackHue);
}

export function buildStageOnePalette({
  companionId,
  favoriteColor,
  coreElement,
}: StageOnePaletteInput): StageOnePalette {
  const anchor = normalizeHexColor(favoriteColor);
  const anchorHsl = hexToHsl(anchor);
  const seed = hashString(`${companionId}:${anchor}:${coreElement.toLowerCase()}`);
  const jitter = (seed % 21) - 10;

  let elementHue = wrapHue(resolveElementHue(coreElement, anchorHsl.h + 105) + jitter * 0.85);
  if (hueDistance(anchorHsl.h, elementHue) < STAGE1_HUE_CONSTRAINTS.minAnchorElementDistance) {
    const direction = ((seed >> 1) & 1) === 0 ? 1 : -1;
    elementHue = nudgeHueAway(
      wrapHue(elementHue + direction * 39),
      anchorHsl.h,
      STAGE1_HUE_CONSTRAINTS.minAnchorElementDistance,
      direction * 17,
    );
  }

  let contrastHue = wrapHue(
    (isWarmHue(anchorHsl.h) ? 210 : 24) + ((seed >> 5) % 35) - 17,
  );
  contrastHue = nudgeHueAway(
    contrastHue,
    anchorHsl.h,
    STAGE1_HUE_CONSTRAINTS.minAnchorContrastDistance,
    (seed & 1) === 0 ? 19 : -19,
  );

  const secondaryCandidates = [
    wrapHue(anchorHsl.h + 128 + ((seed >> 9) % 21) - 10),
    wrapHue(anchorHsl.h + 236 + ((seed >> 10) % 21) - 10),
    wrapHue(elementHue + 98 + ((seed >> 11) % 25) - 12),
    wrapHue(contrastHue - 112 + ((seed >> 12) % 25) - 12),
  ];
  let secondaryHue = selectMostDistinctHue(
    secondaryCandidates,
    [anchorHsl.h, elementHue, contrastHue],
    STAGE1_HUE_CONSTRAINTS.minSecondaryDistance,
  );

  let hueGroupCount = countDistinctHueGroups(
    [anchorHsl.h, elementHue, contrastHue, secondaryHue],
    STAGE1_HUE_CONSTRAINTS.minDistinctGroupSeparation,
  );

  if (hueGroupCount < 4) {
    secondaryHue = wrapHue(secondaryHue + 96);
    hueGroupCount = countDistinctHueGroups(
      [anchorHsl.h, elementHue, contrastHue, secondaryHue],
      STAGE1_HUE_CONSTRAINTS.minDistinctGroupSeparation,
    );
  }

  if (hueGroupCount < 4) {
    elementHue = nudgeHueAway(
      wrapHue(elementHue + 72),
      anchorHsl.h,
      STAGE1_HUE_CONSTRAINTS.minAnchorElementDistance,
      17,
    );
    hueGroupCount = countDistinctHueGroups(
      [anchorHsl.h, elementHue, contrastHue, secondaryHue],
      STAGE1_HUE_CONSTRAINTS.minDistinctGroupSeparation,
    );
  }

  const accentHues = () => [elementHue, contrastHue, secondaryHue];

  if (!accentHues().some((hue) => isWarmHue(hue))) {
    const warmCandidates = [
      wrapHue(24 + ((seed >> 13) % 24) - 12),
      wrapHue(42 + ((seed >> 14) % 24) - 12),
      wrapHue(352 + ((seed >> 15) % 18) - 9),
    ];
    contrastHue = selectMostDistinctHue(
      warmCandidates,
      [anchorHsl.h, elementHue, secondaryHue],
      STAGE1_HUE_CONSTRAINTS.minSecondaryDistance,
    );
    contrastHue = nudgeHueAway(
      contrastHue,
      anchorHsl.h,
      STAGE1_HUE_CONSTRAINTS.minAnchorContrastDistance,
      17,
    );
  }

  if (!accentHues().some((hue) => isCoolHue(hue))) {
    const coolCandidates = [
      wrapHue(198 + ((seed >> 16) % 28) - 14),
      wrapHue(222 + ((seed >> 17) % 28) - 14),
      wrapHue(246 + ((seed >> 18) % 28) - 14),
    ];
    secondaryHue = selectMostDistinctHue(
      coolCandidates,
      [anchorHsl.h, elementHue, contrastHue],
      STAGE1_HUE_CONSTRAINTS.minSecondaryDistance,
    );
  }

  hueGroupCount = countDistinctHueGroups(
    [anchorHsl.h, elementHue, contrastHue, secondaryHue],
    STAGE1_HUE_CONSTRAINTS.minDistinctGroupSeparation,
  );

  const hasWarmHue = [anchorHsl.h, elementHue, contrastHue, secondaryHue].some((hue) => isWarmHue(hue));
  const hasCoolHue = [anchorHsl.h, elementHue, contrastHue, secondaryHue].some((hue) => isCoolHue(hue));

  const neutralHue = wrapHue(anchorHsl.h + ((seed >> 19) % 18) - 9);
  const neutralSat = clamp(10 + ((seed >> 20) % 9), 8, 18);
  const neutralLight = clamp(52 + ((seed >> 21) % 12) - 6, 46, 66);

  return {
    anchor,
    elementAccent: hslToHex(
      elementHue,
      clamp(80 + ((seed >> 2) % 12), 76, 95),
      clamp(56 + ((seed >> 3) % 10) - 4, 48, 66),
    ),
    contrastAccent: hslToHex(
      contrastHue,
      clamp(86 + ((seed >> 4) % 12), 80, 99),
      clamp(58 + ((seed >> 5) % 10) - 4, 50, 70),
    ),
    secondaryAccent: hslToHex(
      secondaryHue,
      clamp(68 + ((seed >> 6) % 16), 64, 90),
      clamp(57 + ((seed >> 7) % 12) - 6, 48, 68),
    ),
    neutralBalance: hslToHex(neutralHue, neutralSat, neutralLight),
    anchorHue: anchorHsl.h,
    elementHue,
    contrastHue,
    secondaryHue,
    neutralHue,
    distinctHueGroups: hueGroupCount,
    hasWarmHue,
    hasCoolHue,
    hueDistances: {
      anchorElement: hueDistance(anchorHsl.h, elementHue),
      anchorContrast: hueDistance(anchorHsl.h, contrastHue),
      anchorSecondary: hueDistance(anchorHsl.h, secondaryHue),
      elementContrast: hueDistance(elementHue, contrastHue),
      elementSecondary: hueDistance(elementHue, secondaryHue),
      contrastSecondary: hueDistance(contrastHue, secondaryHue),
    },
  };
}

export function formatStageOnePaletteInstructions(palette: StageOnePalette): string {
  return `COLOR PALETTE SPEC (MANDATORY - AGGRESSIVE MULTI-HUE):
- anchor: ${palette.anchor} (identity anchor)
- element_accent: ${palette.elementAccent} (element-led aura/accent)
- contrast_accent: ${palette.contrastAccent} (high-contrast pop)
- secondary_accent: ${palette.secondaryAccent} (supporting hue family)
- neutral_balance: ${palette.neutralBalance} (soft balancing tone)

TARGET COVERAGE RATIOS:
- anchor: ${STAGE1_COVERAGE_TARGETS.anchor}
- element_accent: ${STAGE1_COVERAGE_TARGETS.elementAccent}
- contrast_accent: ${STAGE1_COVERAGE_TARGETS.contrastAccent}
- secondary_accent: ${STAGE1_COVERAGE_TARGETS.secondaryAccent}
- neutral_balance: ${STAGE1_COVERAGE_TARGETS.neutralBalance}

HUE DIVERSITY REQUIREMENTS:
- Include both warm and cool hue presence in the final composition.
- Maintain at least 4 visually distinct hue groups across creature + environment.
- Preserve strong hue separation (especially anchor vs contrast accent).`;
}

export function buildStageOneColorPlacementGuidance(): string {
  return `PALETTE PLACEMENT GUIDANCE (STRICT):
CREATURE ZONE MAPPING (MANDATORY):
- Anchor color on dominant body masses and primary fur/feather/scale regions.
- Element accent on aura rims, magical wisps, elemental particles, and selective edge-lighting on anatomy.
- Contrast accent on iris ring/reflections, shell crack glow, micro-markings, and small high-signal focal details.
- Secondary accent on belly/inner feather transitions, small pattern bands, and controlled feature transitions.
- Neutral balance on cast shadows, paw/claw recesses, shell interiors, and low-frequency body shadows.

SCENE ZONE MAPPING (MANDATORY):
- Element accent in airborne particles, atmospheric wisps, and local bloom around hatch energy.
- Contrast accent in shell fracture emissive zones and tiny foreground sparkle clusters.
- Secondary accent in background mist gradients and environmental support lights.
- Neutral balance in ground plane, distant backdrop haze, and shadow continuity.

ANTI-MONOCHROME CONSTRAINTS (MANDATORY):
- Do not output single-hue wash.
- Do not tint all materials with only anchor color.
- Do not wash creature and environment with anchor hue; preserve separable hue families in midtones and shadows.`;
}
