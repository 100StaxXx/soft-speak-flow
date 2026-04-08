export const WALLPAPER_CATALOG_TIMEZONE = "America/Los_Angeles" as const;
export const WALLPAPER_PROMPT_VERSION = 1 as const;
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
  safeZonesClear: boolean;
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

export const wallpaperGenerationSpecs: Record<WallpaperPageKey, WallpaperGenerationSpec> = {
  quests: {
    label: "Quests",
    pageDescription: "Awe-inspiring open-path landscape for personal planning and weekly questing.",
    prompt: [
      "Create a breathtaking cinematic mobile wallpaper for a productivity app page called Quests.",
      "The scene should feel like the beginning of an epic journey: a gorgeous landscape with a visible path, alien valley, mountain pass, or celestial trail that invites forward movement.",
      "Prioritize awe, beauty, depth, and landscape scale over abstract effects.",
      "Keep the center area and bottom navigation safe by avoiding bright text-like clusters, UI shapes, or major subjects in the top bar and bottom 18 percent.",
      "No text, no letters, no logos, no app UI, no mockup browser bars, no buttons, no forms, no readable symbols.",
      "Photoreal or photo-like cinematic concept art, ultra-detailed, rich atmosphere, high contrast but still readable behind dark app chrome.",
      "Portrait 9:16 composition designed for a mobile wallpaper.",
    ].join(" "),
    mobileFocus: { x: 56, y: 54 },
    desktopFocus: { x: 58, y: 50 },
    overlayStrength: 0.64,
    showCosmicOverlay: true,
  },
  campaigns: {
    label: "Campaigns",
    pageDescription: "Grand cosmic vista with expedition scale for long-range momentum.",
    prompt: [
      "Create a high-definition cinematic mobile wallpaper for a productivity app page called Campaigns.",
      "The image should feel enormous and majestic: a gorgeous cosmic landscape, surreal mountain range, or otherworldly world with planets, stars, and vast expedition scale.",
      "Make it awe-inspiring and gorgeous, with strong depth and a dramatic scenic backdrop.",
      "Avoid readable text, UI artifacts, website chrome, buttons, forms, or mockup overlays.",
      "Leave safe visual breathing room for a page title, stat cards in the middle, and bottom navigation.",
      "Photoreal or photo-like cinematic concept art, crisp details, luxurious atmosphere, rich color, portrait 9:16 layout.",
    ].join(" "),
    mobileFocus: { x: 46, y: 44 },
    desktopFocus: { x: 50, y: 48 },
    overlayStrength: 0.7,
    showCosmicOverlay: true,
  },
  companion: {
    label: "Companion",
    pageDescription: "Calm luminous sanctuary that supports the companion card instead of competing with it.",
    prompt: [
      "Create a gorgeous cinematic mobile wallpaper for a productivity app page called Companion.",
      "The scene should feel like a serene celestial sanctuary or magical nature-meets-space refuge.",
      "Use beautiful clouds, stars, moonlight, aurora, cliffs, or gentle cosmic landscape elements, but keep the middle area calm enough that a large companion card remains the visual hero.",
      "No characters, no creatures, no text, no logos, no readable symbols, and absolutely no UI or mockup elements.",
      "Portrait 9:16 composition, premium wallpaper quality, atmospheric depth, soft luminous beauty, not busy in the center.",
    ].join(" "),
    mobileFocus: { x: 52, y: 28 },
    desktopFocus: { x: 50, y: 32 },
    overlayStrength: 0.72,
    showCosmicOverlay: true,
  },
  profile: {
    label: "Profile",
    pageDescription: "Quiet twilight observatory backdrop for settings and account surfaces.",
    prompt: [
      "Create a beautiful cinematic mobile wallpaper for a productivity app settings page called Profile.",
      "The image should feel calm, premium, and quietly cosmic: a twilight observatory, distant cosmic horizon, serene mountain overlook, or elegant space-nature backdrop.",
      "Keep contrast controlled and avoid busy focal clutter so account cards and settings rows remain readable.",
      "No text, no letters, no logos, no UI chrome, no mockup elements, and no readable symbols.",
      "Portrait 9:16 composition, high-definition scenic wallpaper, refined and atmospheric.",
    ].join(" "),
    mobileFocus: { x: 50, y: 34 },
    desktopFocus: { x: 50, y: 36 },
    overlayStrength: 0.66,
    showCosmicOverlay: false,
  },
};

const wallpaperDateFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: WALLPAPER_CATALOG_TIMEZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

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
