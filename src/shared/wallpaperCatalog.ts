export const WALLPAPER_CATALOG_TIMEZONE = "America/Los_Angeles" as const;
export const WALLPAPER_RESET_HOUR = 2 as const;
export const WALLPAPER_HORIZON_DAYS = 4 as const;
export const WALLPAPER_DEFAULT_CANDIDATE_COUNT = 3 as const;
export const WALLPAPER_PROMPT_VERSION = 4 as const;
export const WALLPAPER_IMAGE_SIZE = "1024x1536" as const;
export const WALLPAPER_IMAGE_WIDTH = 1024 as const;
export const WALLPAPER_IMAGE_HEIGHT = 1536 as const;

export const WALLPAPER_PAGE_KEYS = [
  "guide",
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
}

export interface WallpaperPromptRecipe {
  key: string;
  pageKey: WallpaperPageKey;
  title: string;
  prompt: string;
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

export interface WallpaperLiveEligibilityInput {
  publishState?: string | null;
}

export interface WallpaperAssetCandidate<TId extends string = string>
  extends WallpaperPromotionCandidate<TId>,
    WallpaperLiveEligibilityInput {
  pageKey?: WallpaperPageKey | null;
  sourceKind?: string | null;
  generationDate?: string | null;
}

export interface LiveWallpaperManifestEntry {
  forDate: string;
  pageKey: WallpaperPageKey;
  assignmentSource: WallpaperAssignmentSource;
  imageUrl: string;
  mobileFocusX: number | null;
  mobileFocusY: number | null;
  desktopFocusX: number | null;
  desktopFocusY: number | null;
  updatedAt: string;
}

const wallpaperPageLabels: Record<WallpaperPageKey, string> = {
  guide: "Guide",
  quests: "Quests",
  campaigns: "Campaigns",
  companion: "Companion",
  profile: "Profile",
};

const wallpaperPageDescriptions: Record<WallpaperPageKey, string> = {
  guide: "Calm cinematic observatory backdrop for daily guidance, briefings, and reflective support.",
  quests: "Forward-motion planning landscape with a clear route and a sense of possibility.",
  campaigns: "Large-scale strategic vista for long-range momentum, ambition, and ritual building.",
  companion: "Peaceful sanctuary backdrop that stays supportive while leaving the companion card as the hero.",
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
  atmospherePrompt?: string,
) => [
  `Create a breathtaking cinematic mobile wallpaper for the ${wallpaperPageLabels[pageKey]} page in the Cosmiq app.`,
  `Target mood: ${wallpaperPageDescriptions[pageKey]}`,
  scenePrompt,
  emphasisPrompt,
  atmospherePrompt,
  WALLPAPER_SHARED_FIDELITY_CLAUSE,
  WALLPAPER_SHARED_PALETTE_CLAUSE,
  WALLPAPER_SHARED_SAFE_ZONE_CLAUSE,
  WALLPAPER_SHARED_NEGATIVE_CLAUSE,
].filter(Boolean).join(" ");

export const wallpaperGenerationSpecs: Record<WallpaperPageKey, WallpaperGenerationSpec> = {
  guide: {
    label: wallpaperPageLabels.guide,
    pageDescription: wallpaperPageDescriptions.guide,
    prompt: buildWallpaperPrompt(
      "guide",
      "Show a calm observatory, contemplative overlook, moonlit terrace, or serene horizon with subtle celestial detail and elegant atmospheric depth.",
      "Prioritize wisdom, steadiness, and readability for guidance cards. The image should feel premium and supportive, never loud or distracting.",
    ),
    mobileFocus: { x: 50, y: 30 },
    desktopFocus: { x: 52, y: 34 },
  },
  quests: {
    label: wallpaperPageLabels.quests,
    pageDescription: wallpaperPageDescriptions.quests,
    prompt: buildWallpaperPrompt(
      "quests",
      "Show a gorgeous path, trail, pass, shoreline route, canyon switchback, or other clearly readable way forward through a vast landscape. The image should spark planning energy and motion.",
      "Prioritize route clarity, beauty, depth, and a sense of personal momentum over spectacle or fantasy noise.",
    ),
    mobileFocus: { x: 56, y: 56 },
    desktopFocus: { x: 58, y: 50 },
  },
  campaigns: {
    label: wallpaperPageLabels.campaigns,
    pageDescription: wallpaperPageDescriptions.campaigns,
    prompt: buildWallpaperPrompt(
      "campaigns",
      "Show a majestic large-scale landscape with cliffs, ranges, coastlines, canyons, glaciers, or alien horizons that feel built for long-range ambition and expedition planning.",
      "The image should feel enormous, strategic, and high-definition, with commanding scenic depth rather than dreamy haze.",
    ),
    mobileFocus: { x: 46, y: 42 },
    desktopFocus: { x: 50, y: 46 },
  },
  companion: {
    label: wallpaperPageLabels.companion,
    pageDescription: wallpaperPageDescriptions.companion,
    prompt: buildWallpaperPrompt(
      "companion",
      "Show a serene celestial sanctuary or nature-meets-space refuge with a peaceful center, soft atmosphere, and gentle luminous beauty.",
      "Keep the center especially calm and uncluttered so the companion card remains the visual hero. Avoid bright competing subjects behind the card area.",
    ),
    mobileFocus: { x: 50, y: 26 },
    desktopFocus: { x: 50, y: 30 },
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
  },
};

interface RecipeSceneDescriptor {
  key: string;
  title: string;
  scenePrompt: string;
}

interface RecipeAtmosphereDescriptor {
  key: string;
  title: string;
  atmospherePrompt: string;
}

const createPromptRecipeFamily = (
  pageKey: WallpaperPageKey,
  scenes: readonly RecipeSceneDescriptor[],
  atmospheres: readonly RecipeAtmosphereDescriptor[],
  emphasisPrompt: string,
) => scenes.flatMap((scene) => atmospheres.map((atmosphere) => ({
  key: `${pageKey}-${scene.key}-${atmosphere.key}`,
  pageKey,
  title: `${scene.title} / ${atmosphere.title}`,
  prompt: buildWallpaperPrompt(
    pageKey,
    scene.scenePrompt,
    emphasisPrompt,
    atmosphere.atmospherePrompt,
  ),
})));

const wallpaperRecipeFamilies = {
  guide: createPromptRecipeFamily(
    "guide",
    [
      {
        key: "aurora-observatory",
        title: "Aurora Observatory",
        scenePrompt: "Show a refined hilltop observatory or moonlit study terrace with subtle aurora color and a tranquil celestial sky.",
      },
      {
        key: "stone-library-overlook",
        title: "Stone Library Overlook",
        scenePrompt: "Show an elevated stone library overlook above a quiet valley, with lantern architecture, distant stars, and a serene horizon.",
      },
      {
        key: "moon-tide-balcony",
        title: "Moon Tide Balcony",
        scenePrompt: "Show a contemplative balcony above a moonlit sea with calm surf, elegant rails, and a clear horizon that feels reflective and wise.",
      },
      {
        key: "high-desert-telescope",
        title: "High Desert Telescope",
        scenePrompt: "Show a high-desert telescope ridge with clean night air, sculpted rock, and a steady celestial canopy that feels grounding rather than flashy.",
      },
    ],
    [
      {
        key: "silver-quiet",
        title: "Silver Quiet",
        atmospherePrompt: "Favor silver, deep blue, slate, and restrained teal glow with calm contrast and elegant darkness.",
      },
      {
        key: "teal-dawn",
        title: "Teal Dawn",
        atmospherePrompt: "Favor teal dawn light, cool cyan haze, and gentle warm lantern accents without overpowering the scene.",
      },
      {
        key: "amber-lantern",
        title: "Amber Lantern",
        atmospherePrompt: "Use moonlit neutrals with subtle amber lantern pools that imply guidance and warmth while keeping the image quiet.",
      },
      {
        key: "crisp-midnight",
        title: "Crisp Midnight",
        atmospherePrompt: "Keep the air crisp and dark with sharp stars, restrained cloud detail, and premium night-sky clarity.",
      },
    ],
    "Keep the center readable and emotionally steady, with calm atmosphere that supports daily guidance rather than stealing focus.",
  ),
  quests: createPromptRecipeFamily(
    "quests",
    [
      {
        key: "desert-trail",
        title: "Desert Trail",
        scenePrompt: "Show a winding desert trail through sandstone mesas and sweeping dunes with a clearly readable route and wide-open motion.",
      },
      {
        key: "redwood-path",
        title: "Redwood Path",
        scenePrompt: "Show a towering redwood or old-growth forest path with clear forward direction through mist, moss, and filtered light.",
      },
      {
        key: "ringed-pass",
        title: "Ringed Pass",
        scenePrompt: "Show an icy or tundra route threading through a mountain pass with subtle alien wonder and a visible trail line.",
      },
      {
        key: "coastal-switchbacks",
        title: "Coastal Switchbacks",
        scenePrompt: "Show dramatic coastal switchbacks above a deep blue sea with a long route drawing the eye upward and forward.",
      },
    ],
    [
      {
        key: "first-light",
        title: "First Light",
        atmospherePrompt: "Favor warm dawn edges, clean air, and crisp depth without losing terrain detail or route visibility.",
      },
      {
        key: "cool-mist",
        title: "Cool Mist",
        atmospherePrompt: "Use cool mist, silver light, and deep blue shadow separation while keeping the path unmistakably clear.",
      },
      {
        key: "storm-clearing",
        title: "Storm Clearing",
        atmospherePrompt: "Let the sky feel freshly clearing after weather with strong contrast, dramatic cloud shape, and bright route readability.",
      },
      {
        key: "moon-route",
        title: "Moon Route",
        atmospherePrompt: "Blend moonlit cool tones with subtle alien scale, keeping the route luminous by composition rather than artificial glow.",
      },
    ],
    "Make the route legible and inviting. Prioritize motion, depth, and planning energy over spectacle or fantasy clutter.",
  ),
  campaigns: createPromptRecipeFamily(
    "campaigns",
    [
      {
        key: "ocean-cliffs",
        title: "Ocean Cliffs",
        scenePrompt: "Show colossal ocean cliffs above a storm-polished sea with huge scenic scale and a commanding horizon.",
      },
      {
        key: "golden-canyon",
        title: "Golden Canyon",
        scenePrompt: "Show a sunlit canyon expanse with giant layered rock walls, open desert air, and a dramatic overlook built for long-range planning.",
      },
      {
        key: "glacial-range",
        title: "Glacial Range",
        scenePrompt: "Show a glacial mountain range with teal ice, dark stone, reflective water, and a cold clean sky with expedition-scale grandeur.",
      },
      {
        key: "volcanic-archipelago",
        title: "Volcanic Archipelago",
        scenePrompt: "Show a volcanic archipelago or basalt highlands with sweeping landforms, enormous scale, and clear strategic depth.",
      },
    ],
    [
      {
        key: "ringworld-sky",
        title: "Ringworld Sky",
        atmospherePrompt: "A distant ringworld or planetary arc may appear, but keep the terrain and scale primary rather than turning the image into poster art.",
      },
      {
        key: "sun-struck",
        title: "Sun-Struck",
        atmospherePrompt: "Favor crisp sun-struck terrain, deep shadows, and commanding visibility with minimal haze.",
      },
      {
        key: "storm-polished",
        title: "Storm-Polished",
        atmospherePrompt: "Let the environment feel weathered, strategic, and immense with strong contrast and premium scenic texture.",
      },
      {
        key: "cold-clarity",
        title: "Cold Clarity",
        atmospherePrompt: "Use cold clarity, deep blue, slate, silver, and restrained teal highlights to emphasize expedition-scale ambition.",
      },
    ],
    "The image should feel enormous, strategic, and high-definition, with commanding scenic depth rather than dreamy haze.",
  ),
  companion: createPromptRecipeFamily(
    "companion",
    [
      {
        key: "alpine-sanctuary",
        title: "Alpine Sanctuary",
        scenePrompt: "Show a moonlit alpine lake sanctuary surrounded by mountains, gentle clouds, and soft starlight with a calm center.",
      },
      {
        key: "bioluminescent-lagoon",
        title: "Bioluminescent Lagoon",
        scenePrompt: "Show a serene bioluminescent lagoon with natural emerald and cyan glow, dark rock, soft vegetation, and a quiet celestial sky.",
      },
      {
        key: "garden-temple",
        title: "Garden Temple",
        scenePrompt: "Show a hidden celestial garden temple or quiet ruin wrapped in nature, stillness, and soft open space through the center.",
      },
      {
        key: "snow-meadow",
        title: "Snow Meadow",
        scenePrompt: "Show a snow meadow refuge under a luminous night sky with calm terrain, subtle shelter cues, and a peaceful central field.",
      },
    ],
    [
      {
        key: "moonlit",
        title: "Moonlit",
        atmospherePrompt: "Favor moonlit neutrals, deep blue, silver, teal, and evergreen tones with restrained glow and gentle depth.",
      },
      {
        key: "emerald-breath",
        title: "Emerald Breath",
        atmospherePrompt: "Use natural emerald and cyan luminous accents that feel premium and alive, never neon or synthetic.",
      },
      {
        key: "soft-clouds",
        title: "Soft Clouds",
        atmospherePrompt: "Let soft clouds, atmospheric depth, and clean tonal separation keep the center comforting and readable.",
      },
      {
        key: "dawn-peace",
        title: "Dawn Peace",
        atmospherePrompt: "Introduce faint dawn warmth at the edges while preserving a cool, peaceful center for the companion card.",
      },
    ],
    "Keep the center especially calm and uncluttered so the companion card remains the visual hero. Avoid bright competing subjects behind the card area.",
  ),
  profile: createPromptRecipeFamily(
    "profile",
    [
      {
        key: "coastal-observatory",
        title: "Coastal Observatory",
        scenePrompt: "Show a quiet coastal observatory or cliffside lookout at twilight with a clean horizon and refined architecture silhouette.",
      },
      {
        key: "snow-plateau",
        title: "Snow Plateau",
        scenePrompt: "Show a minimalist snow plateau or tundra horizon under a crisp cold sky with subtle cosmic scale and lots of breathing room.",
      },
      {
        key: "desert-courtyard",
        title: "Desert Courtyard",
        scenePrompt: "Show a restrained desert courtyard or ridge overlook with elegant stone forms, open sky, and premium stillness.",
      },
      {
        key: "lake-horizon",
        title: "Lake Horizon",
        scenePrompt: "Show a polished mountain-lake horizon with quiet premium atmosphere, spacious composition, and subtle celestial detail.",
      },
    ],
    [
      {
        key: "slate-evening",
        title: "Slate Evening",
        atmospherePrompt: "Favor deep blue, slate, silver, and seafoam tones with cool evening contrast and minimal clutter.",
      },
      {
        key: "moon-glass",
        title: "Moon Glass",
        atmospherePrompt: "Keep reflections, surfaces, and air clean and elegant with moonlit neutrals and refined tonal separation.",
      },
      {
        key: "cold-air",
        title: "Cold Air",
        atmospherePrompt: "Use crisp cold air, blue-gray shadow, and restrained light accents to preserve a premium settings backdrop.",
      },
      {
        key: "soft-amber",
        title: "Soft Amber",
        atmospherePrompt: "Allow only very restrained amber architectural warmth against otherwise cool neutrals for a polished premium feel.",
      },
    ],
    "Keep the image elegant, subtle, and uncluttered rather than dramatic or loud.",
  ),
} as const satisfies Record<WallpaperPageKey, WallpaperPromptRecipe[]>;

export const wallpaperPromptRecipes = Object.freeze(
  Object.fromEntries(
    Object.values(wallpaperRecipeFamilies)
      .flat()
      .map((recipe) => [recipe.key, recipe]),
  ) as Record<string, WallpaperPromptRecipe>,
);

export type WallpaperPromptVariantKey = keyof typeof wallpaperPromptRecipes;

function resolveWallpaperTimezone(timezone?: string | null): string {
  const fallback = Intl.DateTimeFormat().resolvedOptions().timeZone || WALLPAPER_CATALOG_TIMEZONE;

  if (!timezone) {
    return fallback;
  }

  try {
    Intl.DateTimeFormat("en-US", { timeZone: timezone });
    return timezone;
  } catch (_error) {
    return fallback;
  }
}

function getDatePartsInTimezone(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
    timeZone,
  }).formatToParts(date);

  const read = (type: Intl.DateTimeFormatPartTypes, fallback: string) =>
    Number(parts.find((part) => part.type === type)?.value ?? fallback);

  return {
    year: read("year", "1970"),
    month: read("month", "1"),
    day: read("day", "1"),
    hour: read("hour", "0"),
    minute: read("minute", "0"),
    second: read("second", "0"),
  };
}

function formatDateKeyInTimezone(date: Date, timeZone: string) {
  const { year, month, day } = getDatePartsInTimezone(date, timeZone);
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function getUtcDateForZonedWallClock(
  timeZone: string,
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  second: number,
) {
  const initialGuess = new Date(Date.UTC(year, month - 1, day, hour, minute, second));
  const zonedParts = getDatePartsInTimezone(initialGuess, timeZone);
  const desiredUtcStamp = Date.UTC(year, month - 1, day, hour, minute, second);
  const zonedUtcStamp = Date.UTC(
    zonedParts.year,
    zonedParts.month - 1,
    zonedParts.day,
    zonedParts.hour,
    zonedParts.minute,
    zonedParts.second,
  );

  return new Date(initialGuess.getTime() + (desiredUtcStamp - zonedUtcStamp));
}

export const getEffectiveWallpaperDate = (
  userTimezone?: string | null,
  date = new Date(),
) => {
  const timeZone = resolveWallpaperTimezone(userTimezone);
  const parts = getDatePartsInTimezone(date, timeZone);

  if (parts.hour < WALLPAPER_RESET_HOUR) {
    const previousDate = new Date(date.getTime() - 24 * 60 * 60 * 1000);
    return formatDateKeyInTimezone(previousDate, timeZone);
  }

  return formatDateKeyInTimezone(date, timeZone);
};

export const getWallpaperSchedulerStartDate = (date = new Date()) =>
  getEffectiveWallpaperDate(WALLPAPER_CATALOG_TIMEZONE, date);

export const getNextWallpaperBoundary = (
  userTimezone?: string | null,
  date = new Date(),
) => {
  const timeZone = resolveWallpaperTimezone(userTimezone);
  const parts = getDatePartsInTimezone(date, timeZone);
  const targetDate = new Date(Date.UTC(parts.year, parts.month - 1, parts.day));

  if (parts.hour >= WALLPAPER_RESET_HOUR) {
    targetDate.setUTCDate(targetDate.getUTCDate() + 1);
  }

  let boundary = getUtcDateForZonedWallClock(
    timeZone,
    targetDate.getUTCFullYear(),
    targetDate.getUTCMonth() + 1,
    targetDate.getUTCDate(),
    WALLPAPER_RESET_HOUR,
    0,
    0,
  );

  if (boundary.getTime() <= date.getTime()) {
    boundary = new Date(boundary.getTime() + 24 * 60 * 60 * 1000);
  }

  return boundary;
};

export const addDaysToWallpaperDate = (
  dateKey: string,
  days: number,
) => {
  const [year, month, day] = dateKey.split("-").map(Number);
  const nextDate = new Date(Date.UTC(year, month - 1, day + days));
  return `${nextDate.getUTCFullYear()}-${String(nextDate.getUTCMonth() + 1).padStart(2, "0")}-${String(nextDate.getUTCDate()).padStart(2, "0")}`;
};

export const getWallpaperHorizonDates = (
  startDate: string,
  daysAhead: number = WALLPAPER_HORIZON_DAYS,
): string[] => Array.from(
  { length: Math.max(1, daysAhead) },
  (_, index) => addDaysToWallpaperDate(startDate, index),
);

const getWallpaperDateSerial = (dateKey: string) => {
  const [year, month, day] = dateKey.split("-").map(Number);
  return Math.floor(Date.UTC(year, month - 1, day) / 86400000);
};

const stableHash = (value: string) => (
  value.split("").reduce((hash, char) => (hash * 31 + char.charCodeAt(0)) >>> 0, 7)
);

export const getDeterministicWallpaperRecipes = (
  pageKey: WallpaperPageKey,
  dateKey: string,
  candidateCount: number = WALLPAPER_DEFAULT_CANDIDATE_COUNT,
): WallpaperPromptRecipe[] => {
  const family = wallpaperRecipeFamilies[pageKey];
  const cappedCount = Math.max(1, Math.min(candidateCount, family.length));
  const recipeStart = (
    stableHash(pageKey) + getWallpaperDateSerial(dateKey) * cappedCount
  ) % family.length;

  return Array.from({ length: cappedCount }, (_, index) => (
    family[(recipeStart + index) % family.length]
  ));
};

export const getDeterministicWallpaperRecipe = (
  pageKey: WallpaperPageKey,
  dateKey: string,
  candidateIndex: number,
  candidateCount: number = WALLPAPER_DEFAULT_CANDIDATE_COUNT,
) => {
  const recipes = getDeterministicWallpaperRecipes(pageKey, dateKey, candidateCount);
  const normalizedIndex = Math.max(0, Math.min(candidateIndex, recipes.length - 1));
  return recipes[normalizedIndex];
};

export const isWallpaperAssetEligibleForLiveRotation = (
  _pageKey: WallpaperPageKey,
  asset: WallpaperLiveEligibilityInput,
) => asset.publishState === "ready";

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

export const pickBestEligibleWallpaperCandidateForDate = <
  T extends WallpaperAssetCandidate,
>(
  pageKey: WallpaperPageKey,
  dateKey: string,
  candidates: readonly T[],
) => pickBestWallpaperPromotionCandidate(
  candidates.filter((candidate) =>
    candidate.generationDate === dateKey
    && isWallpaperAssetEligibleForLiveRotation(pageKey, candidate),
  ),
);

export const pickLatestEligibleWallpaperCandidate = <
  T extends WallpaperAssetCandidate,
>(
  pageKey: WallpaperPageKey,
  candidates: readonly T[],
) => (
  candidates
    .filter((candidate) => isWallpaperAssetEligibleForLiveRotation(pageKey, candidate))
    .sort((left, right) => {
      const rightCreatedAt = right.createdAt ? Date.parse(right.createdAt) : 0;
      const leftCreatedAt = left.createdAt ? Date.parse(left.createdAt) : 0;
      return rightCreatedAt - leftCreatedAt;
    })[0] ?? null
);

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

export const formatWallpaperVariantLabel = (variantKey: string | null | undefined) => {
  if (!variantKey) return null;

  const recipe = wallpaperPromptRecipes[variantKey];
  if (recipe) {
    return recipe.title;
  }

  return variantKey
    .split("-")
    .filter(Boolean)
    .map((part) => `${part.slice(0, 1).toUpperCase()}${part.slice(1)}`)
    .join(" ");
};
