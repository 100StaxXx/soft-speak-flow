export const WALLPAPER_CATALOG_TIMEZONE = "America/Los_Angeles" as const;
export const WALLPAPER_PROMPT_VERSION = 2 as const;
export const WALLPAPER_IMAGE_SIZE = "1024x1536" as const;
export const WALLPAPER_IMAGE_WIDTH = 1024 as const;
export const WALLPAPER_IMAGE_HEIGHT = 1536 as const;

export const WALLPAPER_PAGE_KEYS = [
  "quests",
  "campaigns",
  "companion",
  "profile",
] as const;

export type WallpaperPageKey = (typeof WALLPAPER_PAGE_KEYS)[number];

export type WallpaperPublishState =
  | "ready"
  | "validation_failed"
  | "suppressed"
  | "retired";

export type WallpaperAssignmentSource =
  | "auto"
  | "carry_forward"
  | "admin_override";

export interface WallpaperValidationResult {
  approved: boolean;
  hasReadableText: boolean;
  hasUiOverlay: boolean;
  hasPurpleDominance: boolean;
  safeZonesClear: boolean;
  safeZoneConfidenceScore: number;
  scenicQualityScore: number;
  detailScore: number;
  contrastScore: number;
  moodMatchScore: number;
  mobileFocusX: number;
  mobileFocusY: number;
  desktopFocusX: number;
  desktopFocusY: number;
  notes: string[];
  rejectionReasons: string[];
}

export interface WallpaperGenerationSpec {
  label: string;
  pageDescription: string;
  prompt: string;
  mobileFocus: {
    x: number;
    y: number;
  };
  desktopFocus: {
    x: number;
    y: number;
  };
  overlayStrength: number;
  showCosmicOverlay: boolean;
}

export interface WallpaperPromptVariant {
  pageKey: WallpaperPageKey;
  title: string;
  prompt: string;
}

export interface WallpaperGenerationBatchPreset {
  label: string;
  variantKeys: WallpaperPromptVariantKey[];
}

export interface WallpaperPromotionCandidate<TId extends string = string> {
  id: TId;
  createdAt?: string;
  validation: Pick<
    WallpaperValidationResult,
    "scenicQualityScore"
    | "moodMatchScore"
    | "detailScore"
    | "contrastScore"
    | "safeZoneConfidenceScore"
  >;
}

const wallpaperPageLabels: Record<WallpaperPageKey, string> = {
  quests: "Quests",
  campaigns: "Campaigns",
  companion: "Companion",
  profile: "Profile",
};

const wallpaperPageDescriptions: Record<WallpaperPageKey, string> = {
  quests: "Awe-inspiring open-path landscape for personal planning and weekly questing.",
  campaigns: "Grand expedition-scale vista for long-range momentum and ritual building.",
  companion: "Calm luminous sanctuary that supports the companion card instead of competing with it.",
  profile: "Quiet premium observatory or twilight landscape for settings and account surfaces.",
};

const WALLPAPER_SHARED_FIDELITY_CLAUSE = [
  "Portrait 9:16 mobile wallpaper composition.",
  "Mixed cinematic realism: grounded enough to feel like a real landscape, but polished enough to feel premium and awe-inspiring.",
  "Very high detail, sharp focus, crisp terrain texture, premium wallpaper fidelity, not soft or muddy.",
].join(" ");

const WALLPAPER_SHARED_PALETTE_CLAUSE = [
  "Prefer sand, rust, slate, emerald, teal, cyan, deep blue, silver, and moonlit neutrals.",
  "Magenta or purple may appear only as a restrained accent.",
  "Do not let purple or pink dominate the sky, fog, water, terrain, or the overall image mood.",
].join(" ");

const WALLPAPER_SHARED_NEGATIVE_CLAUSE = [
  "No text, no letters, no numbers, no logos, no readable symbols, no watermarks.",
  "No app UI, no browser chrome, no forms, no buttons, no device frames, no mockup overlays.",
  "Avoid abstract nebula mush, soft purple haze, tunnel effects, portal gimmicks, or promo-art composition.",
].join(" ");

const WALLPAPER_SHARED_SAFE_ZONE_CLAUSE = [
  "Keep the top header zone, center content zone, and bottom navigation zone readable for a dark translucent mobile app interface.",
  "Avoid placing the brightest or busiest subject directly in the top bar or bottom 18 percent of the frame.",
].join(" ");

const buildWallpaperPrompt = (
  pageKey: WallpaperPageKey,
  scenePrompt: string,
  emphasisPrompt: string,
) => [
  `Create a breathtaking cinematic mobile wallpaper for the ${wallpaperPageLabels[pageKey]} page in the Cosmiq app.`,
  `Target mood: ${wallpaperPageDescriptions[pageKey]}`,
  scenePrompt,
  emphasisPrompt,
  WALLPAPER_SHARED_FIDELITY_CLAUSE,
  WALLPAPER_SHARED_PALETTE_CLAUSE,
  WALLPAPER_SHARED_SAFE_ZONE_CLAUSE,
  WALLPAPER_SHARED_NEGATIVE_CLAUSE,
].join(" ");

export const wallpaperGenerationSpecs: Record<WallpaperPageKey, WallpaperGenerationSpec> = {
  quests: {
    label: wallpaperPageLabels.quests,
    pageDescription: wallpaperPageDescriptions.quests,
    prompt: buildWallpaperPrompt(
      "quests",
      "Show a gorgeous path, trail, pass, shoreline, canyon route, or other inviting route through a vast landscape. The image should spark forward motion and possibility.",
      "Prioritize beauty, depth, horizon scale, and a strong sense of journey over overt fantasy effects.",
    ),
    mobileFocus: { x: 56, y: 54 },
    desktopFocus: { x: 58, y: 50 },
    overlayStrength: 0.64,
    showCosmicOverlay: true,
  },
  campaigns: {
    label: wallpaperPageLabels.campaigns,
    pageDescription: wallpaperPageDescriptions.campaigns,
    prompt: buildWallpaperPrompt(
      "campaigns",
      "Show a majestic large-scale landscape with cliffs, ranges, coastlines, canyons, glaciers, or alien horizons that feel built for long-term ambition and expedition.",
      "The image should feel enormous, dramatic, and strategic, with clear scenic depth and a premium high-definition finish.",
    ),
    mobileFocus: { x: 46, y: 44 },
    desktopFocus: { x: 50, y: 48 },
    overlayStrength: 0.7,
    showCosmicOverlay: true,
  },
  companion: {
    label: wallpaperPageLabels.companion,
    pageDescription: wallpaperPageDescriptions.companion,
    prompt: buildWallpaperPrompt(
      "companion",
      "Show a serene celestial sanctuary or nature-meets-space refuge with a peaceful center and gentle atmospheric beauty.",
      "Keep the center calm and uncluttered so the companion card remains the visual hero.",
    ),
    mobileFocus: { x: 52, y: 28 },
    desktopFocus: { x: 50, y: 32 },
    overlayStrength: 0.72,
    showCosmicOverlay: true,
  },
  profile: {
    label: wallpaperPageLabels.profile,
    pageDescription: wallpaperPageDescriptions.profile,
    prompt: buildWallpaperPrompt(
      "profile",
      "Show a refined twilight observatory, coastal overlook, snowy horizon, or restrained cosmic landscape with quiet premium atmosphere.",
      "Keep the image elegant, subtle, and uncluttered rather than dramatic or loud.",
    ),
    mobileFocus: { x: 50, y: 34 },
    desktopFocus: { x: 50, y: 36 },
    overlayStrength: 0.66,
    showCosmicOverlay: false,
  },
};

export const wallpaperPromptVariants = {
  "quests-desert-trail-dawn": {
    pageKey: "quests",
    title: "Desert Trail Dawn",
    prompt: buildWallpaperPrompt(
      "quests",
      "Show a winding desert trail at first light through sandstone mesas and sweeping dunes, with warm sand, rust, and slate tones. A subtle distant moon or ringed planet is allowed, but the landscape must stay primary.",
      "Make the path legible and inviting without looking artificial or glowing purple.",
    ),
  },
  "quests-redwood-mist-path": {
    pageKey: "quests",
    title: "Redwood Mist Path",
    prompt: buildWallpaperPrompt(
      "quests",
      "Show a towering redwood or old-growth forest path with mist, moss, and filtered dawn light. The palette should lean emerald, deep blue, silver, and natural bark tones.",
      "Keep the scene majestic and immersive, with clear forward movement and no fantasy clutter.",
    ),
  },
  "quests-ringed-tundra-pass": {
    pageKey: "quests",
    title: "Ringed Tundra Pass",
    prompt: buildWallpaperPrompt(
      "quests",
      "Show a windswept tundra trail threading through an icy mountain pass with a distant ringed planet above a cold blue horizon. Use slate, cyan, silver, and muted earth tones.",
      "Blend natural-world realism with subtle alien wonder, keeping the route visible and the scenery sharp.",
    ),
  },
  "campaigns-ocean-cliffs-ringworld": {
    pageKey: "campaigns",
    title: "Ocean Cliffs Ringworld",
    prompt: buildWallpaperPrompt(
      "campaigns",
      "Show colossal ocean cliffs above a storm-polished sea with an enormous ringworld or planetary arc spanning the far sky. Favor deep blue, teal, slate, and silver.",
      "The composition should feel vast and strategic, with a powerful horizon and expedition scale.",
    ),
  },
  "campaigns-golden-canyon-expanse": {
    pageKey: "campaigns",
    title: "Golden Canyon Expanse",
    prompt: buildWallpaperPrompt(
      "campaigns",
      "Show a sunlit canyon expanse with giant layered rock walls, open desert air, and a dramatic overlook. Favor sand, rust, amber, slate, and deep blue shadows.",
      "Make it heroic and high-definition, with a commanding long-range feeling rather than dreamlike haze.",
    ),
  },
  "campaigns-glacial-alien-range": {
    pageKey: "campaigns",
    title: "Glacial Alien Range",
    prompt: buildWallpaperPrompt(
      "campaigns",
      "Show a glacial mountain range on an alien world with teal ice, dark stone, reflective water, and a cold clean sky. A distant moon is welcome, but keep the terrain dominant.",
      "Aim for expedition-scale grandeur with crisp texture, deep perspective, and restrained cosmic drama.",
    ),
  },
  "companion-moonlit-alpine-sanctuary": {
    pageKey: "companion",
    title: "Moonlit Alpine Sanctuary",
    prompt: buildWallpaperPrompt(
      "companion",
      "Show a moonlit alpine lake sanctuary surrounded by mountains, gentle clouds, and soft starlight. Favor moonlit neutrals, deep blue, silver, teal, and evergreen tones.",
      "Keep the center visually calm, luminous, and supportive rather than crowded or flashy.",
    ),
  },
  "companion-bioluminescent-lagoon": {
    pageKey: "companion",
    title: "Bioluminescent Lagoon",
    prompt: buildWallpaperPrompt(
      "companion",
      "Show a serene bioluminescent lagoon with emerald and cyan water glow, dark rock, soft vegetation, and a quiet celestial sky. The effect should feel natural and premium, not neon fantasy art.",
      "Preserve a calm central field for the companion card and avoid bright subjects competing for attention.",
    ),
  },
  "profile-twilight-coastal-observatory": {
    pageKey: "profile",
    title: "Twilight Coastal Observatory",
    prompt: buildWallpaperPrompt(
      "profile",
      "Show a quiet coastal observatory or cliffside lookout at twilight with a clean horizon, refined architecture silhouette, and restrained celestial detail. Favor deep blue, slate, silver, and seafoam tones.",
      "The image should feel premium, calm, and uncluttered, with excellent readability for settings content.",
    ),
  },
  "profile-snow-plateau-horizon": {
    pageKey: "profile",
    title: "Snow Plateau Horizon",
    prompt: buildWallpaperPrompt(
      "profile",
      "Show a minimalist snow plateau or tundra horizon under a crisp cold sky with subtle cosmic scale. Favor silver, blue-gray, slate, and moonlit neutrals with very restrained color accents.",
      "Keep the composition elegant, spacious, and quiet, with no dominant fantasy effects.",
    ),
  },
} as const satisfies Record<string, WallpaperPromptVariant>;

export type WallpaperPromptVariantKey = keyof typeof wallpaperPromptVariants;

export const LANDSCAPE_DIVERSE_V1_VARIANT_KEYS = [
  "quests-desert-trail-dawn",
  "quests-redwood-mist-path",
  "quests-ringed-tundra-pass",
  "campaigns-ocean-cliffs-ringworld",
  "campaigns-golden-canyon-expanse",
  "campaigns-glacial-alien-range",
  "companion-moonlit-alpine-sanctuary",
  "companion-bioluminescent-lagoon",
  "profile-twilight-coastal-observatory",
  "profile-snow-plateau-horizon",
] as const satisfies readonly WallpaperPromptVariantKey[];

export const wallpaperGenerationBatchPresets = {
  "landscape-diverse-v1": {
    label: "Landscape Diverse v1",
    variantKeys: [...LANDSCAPE_DIVERSE_V1_VARIANT_KEYS],
  },
} as const satisfies Record<string, WallpaperGenerationBatchPreset>;

export type WallpaperGenerationBatchPresetKey = keyof typeof wallpaperGenerationBatchPresets;

const wallpaperDateFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: WALLPAPER_CATALOG_TIMEZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

export const countWallpaperVariantsByPage = (
  variantKeys: readonly WallpaperPromptVariantKey[],
) => variantKeys.reduce<Record<WallpaperPageKey, number>>(
  (counts, variantKey) => {
    counts[wallpaperPromptVariants[variantKey].pageKey] += 1;
    return counts;
  },
  {
    quests: 0,
    campaigns: 0,
    companion: 0,
    profile: 0,
  },
);

export const formatWallpaperVariantLabel = (variantKey: string | null | undefined) => {
  if (!variantKey) return null;

  const knownVariant = wallpaperPromptVariants[variantKey as WallpaperPromptVariantKey];
  if (knownVariant) {
    return knownVariant.title;
  }

  return variantKey
    .split("-")
    .filter(Boolean)
    .map((part) => `${part.slice(0, 1).toUpperCase()}${part.slice(1)}`)
    .join(" ");
};

export const calculateWallpaperPromotionScore = (
  validation: Pick<
    WallpaperValidationResult,
    "scenicQualityScore"
    | "moodMatchScore"
    | "detailScore"
    | "contrastScore"
  >,
) => Number((
  validation.scenicQualityScore * 0.35
  + validation.moodMatchScore * 0.25
  + validation.detailScore * 0.2
  + validation.contrastScore * 0.2
).toFixed(4));

export const compareWallpaperPromotionCandidates = <
  T extends WallpaperPromotionCandidate,
>(
  left: T,
  right: T,
) => {
  const scoreDifference = calculateWallpaperPromotionScore(right.validation)
    - calculateWallpaperPromotionScore(left.validation);
  if (scoreDifference !== 0) return scoreDifference;

  const safeZoneDifference = right.validation.safeZoneConfidenceScore
    - left.validation.safeZoneConfidenceScore;
  if (safeZoneDifference !== 0) return safeZoneDifference;

  const rightCreatedAt = right.createdAt ? Date.parse(right.createdAt) : 0;
  const leftCreatedAt = left.createdAt ? Date.parse(left.createdAt) : 0;
  return rightCreatedAt - leftCreatedAt;
};

export const pickBestWallpaperPromotionCandidate = <
  T extends WallpaperPromotionCandidate,
>(
  candidates: readonly T[],
) => {
  if (candidates.length === 0) return null;
  return [...candidates].sort(compareWallpaperPromotionCandidates)[0];
};

export const pickOldestUnusedWallpaperAssetId = (
  orderedReadyAssetIds: readonly string[],
  usedAssetIds: Iterable<string>,
) => {
  const used = new Set(usedAssetIds);
  return orderedReadyAssetIds.find((assetId) => !used.has(assetId)) ?? null;
};

export const clampPercent = (value: number | null | undefined, fallback = 50) => {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return fallback;
  }
  return Math.min(100, Math.max(0, value));
};

export const toObjectPosition = (
  x: number | null | undefined,
  y: number | null | undefined,
  fallbackX = 50,
  fallbackY = 50,
) => `${clampPercent(x, fallbackX)}% ${clampPercent(y, fallbackY)}%`;

export const getWallpaperDateKey = (date = new Date()) => {
  const parts = wallpaperDateFormatter.formatToParts(date);
  const year = parts.find((part) => part.type === "year")?.value ?? "1970";
  const month = parts.find((part) => part.type === "month")?.value ?? "01";
  const day = parts.find((part) => part.type === "day")?.value ?? "01";

  return `${year}-${month}-${day}`;
};
