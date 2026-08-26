export const WALLPAPER_CATALOG_TIMEZONE = "America/Los_Angeles" as const;
export const WALLPAPER_RESET_HOUR = 2 as const;
export const WALLPAPER_HORIZON_DAYS = 4 as const;
export const WALLPAPER_DEFAULT_CANDIDATE_COUNT = 3 as const;
export const WALLPAPER_PROMPT_VERSION = 5 as const;
export const WALLPAPER_PORTRAIT_IMAGE_SIZE = "1024x1536" as const;
export const WALLPAPER_PORTRAIT_IMAGE_WIDTH = 1024 as const;
export const WALLPAPER_PORTRAIT_IMAGE_HEIGHT = 1536 as const;
export const WALLPAPER_LANDSCAPE_IMAGE_SIZE = "1536x1024" as const;
export const WALLPAPER_LANDSCAPE_IMAGE_WIDTH = 1536 as const;
export const WALLPAPER_LANDSCAPE_IMAGE_HEIGHT = 1024 as const;

export const WALLPAPER_PAGE_KEYS = [
  "guide",
  "quests",
  "campaigns",
  "companion",
  "profile",
  "pep_talk",
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
  image: {
    size: `${number}x${number}`;
    width: number;
    height: number;
  };
  safeZoneGuidance?: string;
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
  themeKey?: string;
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
  guide: "Guidance",
  quests: "Today",
  campaigns: "Prayer",
  companion: "Companion",
  profile: "Profile",
  pep_talk: "Daily Encouragement",
};

const wallpaperPageDescriptions: Record<WallpaperPageKey, string> = {
  guide: "Calm, grounded sacred scenery for thoughtful Christian guidance and reflection.",
  quests: "Hopeful morning scenery with a clear path and forward energy for today's faithful practices.",
  campaigns: "Quiet chapels, ancient paths, open landscapes, and places of prayer that invite stillness rather than performance.",
  companion: "A warm, living refuge that gives the companion a sense of presence, movement, safety, and wonder.",
  profile: "Restrained courtyards, cloisters, gardens, or peaceful natural scenery for personal settings and account surfaces.",
  pep_talk: "Awe-inspiring natural scenery for daily encouragement, with warmth around the edges and a calm readable center behind the player.",
};

const WALLPAPER_PORTRAIT_FIDELITY_CLAUSE = [
  "Portrait 9:16 mobile wallpaper composition.",
  "Cinematic natural realism: grounded enough to feel like a real place, but polished enough to feel premium, sacred, and awe-inspiring.",
  "Very high detail, sharp focus, crisp terrain texture, premium wallpaper fidelity, not soft or muddy.",
].join(" ");

const WALLPAPER_LANDSCAPE_FIDELITY_CLAUSE = [
  "Landscape 3:2 scenic section composition for a wide pep talk module inside a mobile app.",
  "Compose the scene with expansive left-to-right depth and a calm center band suited to a dark overlay card stack.",
  "Mixed cinematic realism with very high detail, sharp focus, crisp terrain texture, and premium wallpaper fidelity.",
].join(" ");

const WALLPAPER_SHARED_PALETTE_CLAUSE = [
  "Prefer olive, sage, cedar, moss, limestone, ivory, soft blue, sunrise gold, and warm earth neutrals.",
  "Lavender or blush may appear only through natural flowers or a restrained sky accent.",
  "Keep the palette organic, peaceful, luminous, and cohesive with Graceward's garden imagery.",
].join(" ");

const WALLPAPER_SHARED_DIVERSITY_CLAUSE = [
  "Favor broad scenic variety across gardens, olive groves, forests, deserts, wetlands, grasslands, coastlines, courtyards, cloisters, chapels, and quiet paths.",
  "Let creation, warm natural light, cultivated spaces, and ancient materials carry the spiritual atmosphere without becoming literal or theatrical.",
  "Architecture is allowed only when it remains calm, timeless, spacious, and free of crowds, traffic, signage, or commercial noise.",
].join(" ");

const WALLPAPER_SHARED_NEGATIVE_CLAUSE = [
  "No text, no letters, no numbers, no logos, no readable symbols, no watermarks.",
  "No app UI, no browser chrome, no forms, no buttons, no device frames, no mockup overlays.",
  "No planets, galaxies, zodiac imagery, fantasy portals, neon futurism, abstract nebula haze, promo-art composition, or crowded city chaos.",
  "Avoid literal depictions of God or Jesus and avoid prominent denominational symbols; communicate faith through creation, light, shelter, paths, water, and cultivated gardens.",
].join(" ");

const WALLPAPER_SHARED_SAFE_ZONE_CLAUSE = [
  "Keep the top header zone, center content zone, and bottom navigation zone readable for a dark translucent mobile app interface.",
  "Avoid placing the brightest or busiest subject directly in the top bar or bottom 18 percent of the frame.",
].join(" ");

const WALLPAPER_PORTRAIT_IMAGE = {
  size: WALLPAPER_PORTRAIT_IMAGE_SIZE,
  width: WALLPAPER_PORTRAIT_IMAGE_WIDTH,
  height: WALLPAPER_PORTRAIT_IMAGE_HEIGHT,
} as const;

const WALLPAPER_LANDSCAPE_IMAGE = {
  size: WALLPAPER_LANDSCAPE_IMAGE_SIZE,
  width: WALLPAPER_LANDSCAPE_IMAGE_WIDTH,
  height: WALLPAPER_LANDSCAPE_IMAGE_HEIGHT,
} as const;

const getWallpaperCompositionClause = (
  image: WallpaperGenerationSpec["image"],
) => image.width > image.height
  ? WALLPAPER_LANDSCAPE_FIDELITY_CLAUSE
  : WALLPAPER_PORTRAIT_FIDELITY_CLAUSE;

const buildWallpaperSafeZoneClause = (
  safeZoneGuidance?: string,
) => [
  WALLPAPER_SHARED_SAFE_ZONE_CLAUSE,
  safeZoneGuidance,
].filter(Boolean).join(" ");

const buildWallpaperPrompt = (
  pageKey: WallpaperPageKey,
  scenePrompt: string,
  emphasisPrompt: string,
  atmospherePrompt?: string,
  options?: {
    image?: WallpaperGenerationSpec["image"];
    safeZoneGuidance?: string;
  },
) => [
  `Create a breathtaking cinematic wallpaper for the ${wallpaperPageLabels[pageKey]} surface in the Graceward Christian formation app.`,
  `Target mood: ${wallpaperPageDescriptions[pageKey]}`,
  scenePrompt,
  emphasisPrompt,
  atmospherePrompt,
  getWallpaperCompositionClause(options?.image ?? WALLPAPER_PORTRAIT_IMAGE),
  WALLPAPER_SHARED_DIVERSITY_CLAUSE,
  WALLPAPER_SHARED_PALETTE_CLAUSE,
  buildWallpaperSafeZoneClause(options?.safeZoneGuidance),
  WALLPAPER_SHARED_NEGATIVE_CLAUSE,
].filter(Boolean).join(" ");

const createWallpaperGenerationSpec = (args: {
  pageKey: WallpaperPageKey;
  scenePrompt: string;
  emphasisPrompt: string;
  atmospherePrompt?: string;
  image?: WallpaperGenerationSpec["image"];
  safeZoneGuidance?: string;
  mobileFocus: WallpaperGenerationSpec["mobileFocus"];
  desktopFocus: WallpaperGenerationSpec["desktopFocus"];
}): WallpaperGenerationSpec => {
  const image = args.image ?? WALLPAPER_PORTRAIT_IMAGE;

  return {
    label: wallpaperPageLabels[args.pageKey],
    pageDescription: wallpaperPageDescriptions[args.pageKey],
    prompt: buildWallpaperPrompt(
      args.pageKey,
      args.scenePrompt,
      args.emphasisPrompt,
      args.atmospherePrompt,
      {
        image,
        safeZoneGuidance: args.safeZoneGuidance,
      },
    ),
    image,
    safeZoneGuidance: args.safeZoneGuidance,
    mobileFocus: args.mobileFocus,
    desktopFocus: args.desktopFocus,
  };
};

export const wallpaperGenerationSpecs: Record<WallpaperPageKey, WallpaperGenerationSpec> = {
  guide: createWallpaperGenerationSpec({
    pageKey: "guide",
    scenePrompt:
      "Show a calm cloister garden, olive grove overlook, lamplit stone study, forest lookout, coastal path, desert prayer retreat, or quiet courtyard with elegant atmospheric depth.",
    emphasisPrompt:
      "Prioritize wisdom, steadiness, and readability for guidance cards. The image should feel premium and supportive, never loud or distracting.",
    mobileFocus: { x: 50, y: 30 },
    desktopFocus: { x: 52, y: 34 },
  }),
  quests: createWallpaperGenerationSpec({
    pageKey: "quests",
    scenePrompt:
      "Show a gorgeous path, garden walk, boardwalk, stairway, shoreline trail, or other clearly readable way forward through varied natural scenery. The image should support one small faithful step today.",
    emphasisPrompt:
      "Prioritize route clarity, beauty, depth, and a sense of personal momentum over spectacle or fantasy noise.",
    mobileFocus: { x: 56, y: 56 },
    desktopFocus: { x: 58, y: 50 },
  }),
  campaigns: createWallpaperGenerationSpec({
    pageKey: "campaigns",
    scenePrompt:
      "Show a majestic place of prayer such as a desert basin at dawn, forest canopy overlook, quiet coast, ancient stone chapel garden, candlelit cloister, or open field beneath a luminous sky.",
    emphasisPrompt:
      "The image should feel spacious, reverent, and high-definition, with commanding scenic depth rather than dreamy haze.",
    mobileFocus: { x: 46, y: 42 },
    desktopFocus: { x: 50, y: 46 },
  }),
  companion: createWallpaperGenerationSpec({
    pageKey: "companion",
    scenePrompt:
      "Show a breathtaking living garden sanctuary such as an olive grove, walled herb garden, wildflower meadow, courtyard fountain, oasis, wetland refuge, or woodland clearing with a peaceful center and luminous natural beauty.",
    emphasisPrompt:
      "Express patient growth and cultivation. Keep the center calm and uncluttered so progress content remains readable, with no bright competing subject behind the card area.",
    mobileFocus: { x: 50, y: 26 },
    desktopFocus: { x: 50, y: 30 },
  }),
  profile: createWallpaperGenerationSpec({
    pageKey: "profile",
    scenePrompt:
      "Show a refined coastal retreat, cloister walk, forest hermitage, elegant courtyard, garden gate, or restrained waterside overlook with a quiet premium atmosphere.",
    emphasisPrompt:
      "Keep the image elegant, subtle, and uncluttered rather than dramatic or loud.",
    mobileFocus: { x: 50, y: 34 },
    desktopFocus: { x: 50, y: 36 },
  }),
  pep_talk: createWallpaperGenerationSpec({
    pageKey: "pep_talk",
    image: WALLPAPER_LANDSCAPE_IMAGE,
    safeZoneGuidance:
      "Keep the middle 60 percent of the frame especially calm, darker than the outer edges, and free of bright focal subjects so the pep talk player, transcript panel, and CTA remain readable. Avoid faces, statues, suns, moons, horizons, or architectural features landing behind the central card stack.",
    scenePrompt:
      "Show a wide premium natural landscape, garden at dawn, quiet sea, sunlit grove, desert path, or monumental scenic environment charged with hope, courage, mercy, and steady faith without people, text, or UI-like shapes.",
    emphasisPrompt:
      "The backdrop should feel cinematic and emotionally strong around the edges, but the center must stay spacious, restrained, and highly usable behind a dark overlay card.",
    atmospherePrompt:
      "Favor rich olive, sage, limestone, sunrise gold, soft blue, warm earth, and deep green neutrals with clean contrast and grounded scenic realism.",
    mobileFocus: { x: 50, y: 48 },
    desktopFocus: { x: 50, y: 52 },
  }),
};

export const PEP_TALK_WEEKDAY_THEMES = {
  monday: { key: "forge", title: "Forge" },
  tuesday: { key: "focus", title: "Focus" },
  wednesday: { key: "endurance", title: "Endurance" },
  thursday: { key: "ascent", title: "Ascent" },
  friday: { key: "triumph", title: "Triumph" },
  saturday: { key: "recovery", title: "Recovery" },
  sunday: { key: "reflection", title: "Reflection" },
} as const;

export type PepTalkWallpaperWeekday = keyof typeof PEP_TALK_WEEKDAY_THEMES;
export type PepTalkWallpaperThemeKey = typeof PEP_TALK_WEEKDAY_THEMES[PepTalkWallpaperWeekday]["key"];

const WALLPAPER_WEEKDAY_ORDER = [
  "sunday",
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
] as const satisfies readonly PepTalkWallpaperWeekday[];

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
  options?: {
    themeKey?: string;
  },
) => atmospheres.flatMap((atmosphere) => scenes.map((scene) => ({
  key: `${pageKey}-${scene.key}-${atmosphere.key}`,
  pageKey,
  title: `${scene.title} / ${atmosphere.title}`,
  prompt: buildWallpaperPrompt(
    pageKey,
    scene.scenePrompt,
    emphasisPrompt,
    atmosphere.atmospherePrompt,
    {
      image: wallpaperGenerationSpecs[pageKey].image,
      safeZoneGuidance: wallpaperGenerationSpecs[pageKey].safeZoneGuidance,
    },
  ),
  themeKey: options?.themeKey,
})));

const getWallpaperWeekdayFromDateKey = (
  dateKey: string,
): PepTalkWallpaperWeekday => {
  const [year, month, day] = dateKey.split("-").map(Number);
  const weekdayIndex = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
  return WALLPAPER_WEEKDAY_ORDER[weekdayIndex] ?? "monday";
};

export const resolvePepTalkWallpaperThemeForDate = (
  dateKey: string,
) => {
  const weekday = getWallpaperWeekdayFromDateKey(dateKey);
  const theme = PEP_TALK_WEEKDAY_THEMES[weekday];

  return {
    weekday,
    key: theme.key,
    title: theme.title,
  };
};

const wallpaperRecipeFamilies = {
  guide: createPromptRecipeFamily(
    "guide",
    [
      {
        key: "aurora-observatory",
        title: "Aurora Observatory",
        scenePrompt: "Show a refined observatory or moonlit study terrace with subtle aurora color, elegant architecture, and a tranquil celestial sky.",
      },
      {
        key: "stone-library-overlook",
        title: "Stone Library Overlook",
        scenePrompt: "Show an elevated stone library overlook or lantern-lit terrace above a quiet valley or marsh with distant stars and a serene horizon.",
      },
      {
        key: "moon-tide-balcony",
        title: "Moon Tide Balcony",
        scenePrompt: "Show a contemplative balcony above a moonlit sea with calm surf, elegant rails, and a clear horizon that feels reflective and wise.",
      },
      {
        key: "high-desert-telescope",
        title: "High Desert Telescope",
        scenePrompt: "Show a high-desert telescope terrace with clean night air, sculpted rock, and a steady celestial canopy that feels grounding rather than flashy.",
      },
      {
        key: "forest-observatory",
        title: "Forest Observatory",
        scenePrompt: "Show a quiet forest observatory or cedar lookout deck nestled among tall trees, cool mist, and precise starlight with a thoughtful premium mood.",
      },
      {
        key: "rooftop-study",
        title: "Rooftop Study",
        scenePrompt: "Show a serene rooftop study or skyline terrace above a calm city at night with clean lines, sparse lantern warmth, and generous open sky.",
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
        key: "tundra-route",
        title: "Tundra Route",
        scenePrompt: "Show an icy or tundra route crossing open cold terrain with subtle alien wonder, crisp footing, and a clearly visible trail line.",
      },
      {
        key: "grassland-track",
        title: "Grassland Track",
        scenePrompt: "Show a long grassland or steppe track through wind-shaped fields and rolling open country with unmistakable forward direction.",
      },
      {
        key: "wetland-boardwalk",
        title: "Wetland Boardwalk",
        scenePrompt: "Show a premium wetland boardwalk or marsh path through reeds, still water, and soft morning haze with a clean readable route.",
      },
      {
        key: "coastal-switchbacks",
        title: "Coastal Switchbacks",
        scenePrompt: "Show dramatic coastal switchbacks above a deep blue sea with a long route drawing the eye upward and forward.",
      },
      {
        key: "city-ascent",
        title: "City Ascent",
        scenePrompt: "Show an elegant urban stairway, elevated walkway, or rooftop path rising through a calm cityscape with strong route clarity and zero crowd noise.",
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
        key: "glacial-shelf",
        title: "Glacial Shelf",
        scenePrompt: "Show a glacial shelf or tundra ice field with teal ice, dark stone, reflective water, and a cold clean sky with expedition-scale grandeur.",
      },
      {
        key: "volcanic-archipelago",
        title: "Volcanic Archipelago",
        scenePrompt: "Show a volcanic archipelago or basalt highlands with sweeping landforms, enormous scale, and clear strategic depth.",
      },
      {
        key: "forest-basin",
        title: "Forest Basin",
        scenePrompt: "Show a giant forest basin or canopy overlook with layered green depth, distant ridgeless horizons, and immense strategic scale.",
      },
      {
        key: "steppe-frontier",
        title: "Steppe Frontier",
        scenePrompt: "Show a vast steppe frontier with open land, huge sky, subtle fortification cues, and commanding long-range visibility.",
      },
      {
        key: "delta-coast",
        title: "Delta Coast",
        scenePrompt: "Show a monumental delta coast or estuary vista with braided waterways, marsh islands, port-like scale, and immense strategic depth.",
      },
      {
        key: "skyline-overlook",
        title: "Skyline Overlook",
        scenePrompt: "Show a strategic skyline overlook or monumental civic terrace above a calm city with premium architecture, enormous scale, and disciplined visual order.",
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
        scenePrompt: "Show a hidden celestial garden temple or quiet ruin garden wrapped in nature, stillness, and soft open space through the center.",
      },
      {
        key: "meadow-refuge",
        title: "Meadow Refuge",
        scenePrompt: "Show a moonlit meadow refuge with soft grasses, calm shelter cues, and a peaceful central field that feels safe and luminous.",
      },
      {
        key: "desert-oasis",
        title: "Desert Oasis",
        scenePrompt: "Show a serene desert oasis with still water, elegant palms, warm stone, and quiet celestial air while keeping the center uncluttered.",
      },
      {
        key: "rooftop-garden",
        title: "Rooftop Garden",
        scenePrompt: "Show a rooftop garden sanctuary above a calm twilight skyline with restrained lights, soft greenery, and a gentle open center.",
      },
      {
        key: "snow-meadow",
        title: "Snow Meadow",
        scenePrompt: "Show a snow meadow refuge under a luminous night sky with calm terrain, subtle shelter cues, and a peaceful central field.",
      },
      {
        key: "wetland-sanctuary",
        title: "Wetland Sanctuary",
        scenePrompt: "Show a quiet wetland sanctuary with reeds, reflective water, subtle boardwalk hints, and a calm open center under a soft celestial sky.",
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
        scenePrompt: "Show a quiet coastal observatory or seaside lookout at twilight with a clean horizon and refined architecture silhouette.",
      },
      {
        key: "snow-plateau",
        title: "Snow Plateau",
        scenePrompt: "Show a minimalist snow plateau or tundra horizon under a crisp cold sky with subtle cosmic scale and lots of breathing room.",
      },
      {
        key: "desert-courtyard",
        title: "Desert Courtyard",
        scenePrompt: "Show a restrained desert courtyard with elegant stone forms, open sky, and premium stillness.",
      },
      {
        key: "forest-retreat",
        title: "Forest Retreat",
        scenePrompt: "Show a polished forest retreat with quiet architecture, tall trees, cool air, and lots of breathing room for a premium settings backdrop.",
      },
      {
        key: "lake-horizon",
        title: "Lake Horizon",
        scenePrompt: "Show a polished lake or marsh horizon with quiet premium atmosphere, spacious composition, and subtle celestial detail.",
      },
      {
        key: "skyline-terrace",
        title: "Skyline Terrace",
        scenePrompt: "Show a refined skyline terrace or rooftop overlook at blue hour with disciplined architecture, quiet lights, and an uncluttered premium mood.",
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
  pep_talk: [
    ...createPromptRecipeFamily(
      "pep_talk",
      [
        {
          key: "forge-basalt-causeway",
          title: "Basalt Causeway",
          scenePrompt: "Show a vast basalt causeway across dark coastal rock with ember light at the edges, disciplined geometry, and a broad calm center band.",
        },
        {
          key: "forge-desert-courtyard",
          title: "Desert Courtyard",
          scenePrompt: "Show a monumental desert forge courtyard of stone, steel, and wind-carved walls with restrained furnace glow pushed to the edges and a spacious center.",
        },
        {
          key: "forge-training-overlook",
          title: "Training Overlook",
          scenePrompt: "Show a cliffside training overlook above a storm-dark sea with powerful terrain, disciplined architecture, and no bright central focal subject.",
        },
      ],
      [
        {
          key: "forge",
          title: "Forge",
          atmospherePrompt: "Use ember accents, dark slate, iron, sea spray, and disciplined contrast that feels like resolve being hammered into shape.",
        },
      ],
      "The mood should feel like strength is being earned through pressure, discipline, and focus while the center remains calm enough for the pep talk card overlay.",
      { themeKey: "forge" },
    ),
    ...createPromptRecipeFamily(
      "pep_talk",
      [
        {
          key: "focus-mirror-lake",
          title: "Mirror Lake",
          scenePrompt: "Show a perfectly still mirror lake framed by dark pines and narrow stone paths with crisp sightlines and a wide uncluttered center.",
        },
        {
          key: "focus-cedar-corridor",
          title: "Cedar Corridor",
          scenePrompt: "Show a long cedar corridor or forest promenade with precise depth, controlled light, and a centered field of visual calm.",
        },
        {
          key: "focus-ridge-causeway",
          title: "Ridge Causeway",
          scenePrompt: "Show an elevated ridge causeway across cool tundra or moorland with clean horizon control and a broad steady center channel.",
        },
      ],
      [
        {
          key: "focus",
          title: "Focus",
          atmospherePrompt: "Favor clean blue, teal, silver, and graphite tones with crisp air, high clarity, and zero visual clutter.",
        },
      ],
      "The scene should feel mentally sharp and controlled, with the eye drawn into stillness instead of spectacle.",
      { themeKey: "focus" },
    ),
    ...createPromptRecipeFamily(
      "pep_talk",
      [
        {
          key: "endurance-salt-flat",
          title: "Salt Flat",
          scenePrompt: "Show an immense salt flat or dry lake bed under dramatic weather with long distance, grounded texture, and a central zone that stays usable and restrained.",
        },
        {
          key: "endurance-glacier-pass",
          title: "Glacier Pass",
          scenePrompt: "Show a broad glacier pass or cold expedition shelf with hard-earned scale, deep blue shadow, and no bright competing center subject.",
        },
        {
          key: "endurance-storm-boardwalk",
          title: "Storm Boardwalk",
          scenePrompt: "Show a long storm-tested boardwalk through marsh or tidal flats with grit, repetition, and a determined sense of carrying on.",
        },
      ],
      [
        {
          key: "endurance",
          title: "Endurance",
          atmospherePrompt: "Use weathered contrast, cold silver light, dark teal shadow, and subtle warmth only at the far edges to suggest perseverance.",
        },
      ],
      "The image should feel steady under pressure and emotionally durable, never frantic or chaotic in the center.",
      { themeKey: "endurance" },
    ),
    ...createPromptRecipeFamily(
      "pep_talk",
      [
        {
          key: "ascent-sky-stair",
          title: "Sky Stair",
          scenePrompt: "Show a monumental stair or ascending civic terrace toward open sky with huge scale, clean geometry, and a calm central viewing band.",
        },
        {
          key: "ascent-alpine-switchback",
          title: "Alpine Switchback",
          scenePrompt: "Show broad alpine switchbacks cutting through open terrain with unmistakable upward motion and center readability preserved.",
        },
        {
          key: "ascent-hanging-bridge",
          title: "Hanging Bridge",
          scenePrompt: "Show a long hanging bridge or elevated crossing over a vast valley with confident movement upward and balanced open space behind the card zone.",
        },
      ],
      [
        {
          key: "ascent",
          title: "Ascent",
          atmospherePrompt: "Favor clean dawn edges, deep slate shadow, cool cyan air, and a feeling of momentum climbing into something greater.",
        },
      ],
      "The backdrop should feel upward-moving and ambitious while staying composed and premium in the center.",
      { themeKey: "ascent" },
    ),
    ...createPromptRecipeFamily(
      "pep_talk",
      [
        {
          key: "triumph-summit-plateau",
          title: "Summit Plateau",
          scenePrompt: "Show a vast summit plateau with commanding light at the far edges, huge breathing room, and a composed center that feels earned rather than flashy.",
        },
        {
          key: "triumph-victory-shore",
          title: "Victory Shore",
          scenePrompt: "Show a dramatic victory shore or sea wall overlook with luminous distance, disciplined contrast, and a strong but readable center band.",
        },
        {
          key: "triumph-skyline-overlook",
          title: "Skyline Overlook",
          scenePrompt: "Show a polished skyline overlook above a calm city with celebratory scale, premium restraint, and no bright subject placed behind the central card stack.",
        },
      ],
      [
        {
          key: "triumph",
          title: "Triumph",
          atmospherePrompt: "Use bright reward cues only at the outer edges, with silver, gold, cyan, and deep blue tones that feel victorious but controlled.",
        },
      ],
      "The scene should feel like the aftermath of a win, powerful and expansive without becoming loud or gaudy.",
      { themeKey: "triumph" },
    ),
    ...createPromptRecipeFamily(
      "pep_talk",
      [
        {
          key: "recovery-hot-spring",
          title: "Hot Spring",
          scenePrompt: "Show a hidden hot spring valley or geothermal refuge with soft steam, grounded stone, and a broad central calm.",
        },
        {
          key: "recovery-moon-garden",
          title: "Moon Garden",
          scenePrompt: "Show a moon garden cloister or quiet retreat courtyard with restorative stillness, soft edge lighting, and lots of usable center space.",
        },
        {
          key: "recovery-beach-retreat",
          title: "Beach Retreat",
          scenePrompt: "Show a quiet beach retreat or dune sanctuary at blue hour with restorative openness and restrained highlights kept away from center.",
        },
      ],
      [
        {
          key: "recovery",
          title: "Recovery",
          atmospherePrompt: "Favor gentle teal, seafoam, silver, and moonlit neutrals with soft restorative air and low visual noise.",
        },
      ],
      "The mood should feel restorative and spacious, like rebuilding energy without losing premium scenic depth.",
      { themeKey: "recovery" },
    ),
    ...createPromptRecipeFamily(
      "pep_talk",
      [
        {
          key: "reflection-observatory-lake",
          title: "Observatory Lake",
          scenePrompt: "Show an observatory lake or still waterside overlook under a reflective sky with balanced symmetry and a calm central band.",
        },
        {
          key: "reflection-cliff-cloister",
          title: "Cliff Cloister",
          scenePrompt: "Show a contemplative cliff cloister or lantern terrace above fog and sea with deep thoughtfulness and no busy center subject.",
        },
        {
          key: "reflection-marsh-boardwalk",
          title: "Marsh Boardwalk",
          scenePrompt: "Show a still marsh boardwalk or wetland path at dusk with polished quiet, emotional depth, and strong center readability.",
        },
      ],
      [
        {
          key: "reflection",
          title: "Reflection",
          atmospherePrompt: "Use silver, slate, deep blue, and restrained teal with reflective surfaces and quiet end-of-week depth.",
        },
      ],
      "The image should feel introspective and emotionally grounded, with beauty that supports contemplation rather than intensity.",
      { themeKey: "reflection" },
    ),
  ],
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

const getWallpaperRecipeFamilyForDate = (
  pageKey: WallpaperPageKey,
  dateKey: string,
) => {
  if (pageKey !== "pep_talk") {
    return wallpaperRecipeFamilies[pageKey];
  }

  const themeKey = resolvePepTalkWallpaperThemeForDate(dateKey).key;
  const themedFamily = wallpaperRecipeFamilies.pep_talk
    .filter((recipe) => recipe.themeKey === themeKey);

  return themedFamily.length > 0 ? themedFamily : wallpaperRecipeFamilies.pep_talk;
};

export const getDeterministicWallpaperRecipes = (
  pageKey: WallpaperPageKey,
  dateKey: string,
  candidateCount: number = WALLPAPER_DEFAULT_CANDIDATE_COUNT,
): WallpaperPromptRecipe[] => {
  const family = getWallpaperRecipeFamilyForDate(pageKey, dateKey);
  if (family.length === 0) {
    return [];
  }
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
