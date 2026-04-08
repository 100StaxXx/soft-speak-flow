import type {
  WallpaperGenerationSpec,
  WallpaperValidationResult,
} from "../../../src/shared/wallpaperCatalog.ts";

const DEFAULT_VALIDATION_RESULT: WallpaperValidationResult = {
  approved: false,
  hasReadableText: false,
  hasUiOverlay: false,
  safeZonesClear: false,
  scenicQualityScore: 0,
  detailScore: 0,
  contrastScore: 0,
  moodMatchScore: 0,
  mobileFocusX: 50,
  mobileFocusY: 50,
  desktopFocusX: 50,
  desktopFocusY: 50,
  notes: [],
  rejectionReasons: [],
};

export const buildWallpaperValidationPrompt = (spec: WallpaperGenerationSpec) => `You are reviewing an AI-generated mobile wallpaper for the ${spec.label} page in the Cosmiq app.

Goal:
- scenic, gorgeous, awe-inspiring wallpaper first
- no text, no logos, no UI chrome, no mockup browser bars, no buttons, no forms
- safe for dark app content over the top, middle, and bottom

Target mood:
${spec.pageDescription}

Review the image for:
1. Readable text, letters, logos, or watermark-like marks
2. UI-like overlays, mockup chrome, browser bars, forms, buttons, or fake app screens
3. Scenic quality and overall beauty
4. Detail level and image fidelity
5. Contrast/readability suitability for dark translucent cards
6. Whether the page mood matches the target mood above
7. Whether the top header zone, middle content zone, and bottom nav zone stay visually usable
8. Recommend a strong focal point for mobile and desktop object-position percentages

Respond with ONLY valid JSON using this exact schema:
{
  "approved": true,
  "hasReadableText": false,
  "hasUiOverlay": false,
  "safeZonesClear": true,
  "scenicQualityScore": 0,
  "detailScore": 0,
  "contrastScore": 0,
  "moodMatchScore": 0,
  "mobileFocusX": 50,
  "mobileFocusY": 50,
  "desktopFocusX": 50,
  "desktopFocusY": 50,
  "notes": ["short note"],
  "rejectionReasons": ["short reason"]
}

Rules:
- Scores are 0 to 100.
- Set approved to false if there is any readable text, any UI overlay, unsafe composition, scenicQualityScore below 72, detailScore below 68, contrastScore below 60, or moodMatchScore below 72.
- Keep notes concise.
- If approved is true, rejectionReasons must be an empty array.
`;

export const parseWallpaperValidationResult = (content: string): WallpaperValidationResult => {
  let cleaned = content.trim();
  if (cleaned.startsWith("```json")) {
    cleaned = cleaned.slice(7);
  } else if (cleaned.startsWith("```")) {
    cleaned = cleaned.slice(3);
  }
  if (cleaned.endsWith("```")) {
    cleaned = cleaned.slice(0, -3);
  }

  try {
    const parsed = JSON.parse(cleaned.trim()) as Partial<WallpaperValidationResult>;
    return normalizeWallpaperValidationResult(parsed);
  } catch (_error) {
    return {
      ...DEFAULT_VALIDATION_RESULT,
      rejectionReasons: ["Validator returned invalid JSON"],
      notes: ["Validation parser fell back to rejection because the structured response was malformed."],
    };
  }
};

export const normalizeWallpaperValidationResult = (
  value: Partial<WallpaperValidationResult> | null | undefined,
): WallpaperValidationResult => {
  const base = value ?? {};
  const rejectionReasons = Array.isArray(base.rejectionReasons)
    ? base.rejectionReasons.filter((item): item is string => typeof item === "string" && item.length > 0)
    : [];
  const notes = Array.isArray(base.notes)
    ? base.notes.filter((item): item is string => typeof item === "string" && item.length > 0)
    : [];

  return {
    approved: Boolean(base.approved),
    hasReadableText: Boolean(base.hasReadableText),
    hasUiOverlay: Boolean(base.hasUiOverlay),
    safeZonesClear: Boolean(base.safeZonesClear),
    scenicQualityScore: clampScore(base.scenicQualityScore),
    detailScore: clampScore(base.detailScore),
    contrastScore: clampScore(base.contrastScore),
    moodMatchScore: clampScore(base.moodMatchScore),
    mobileFocusX: clampPercent(base.mobileFocusX),
    mobileFocusY: clampPercent(base.mobileFocusY),
    desktopFocusX: clampPercent(base.desktopFocusX),
    desktopFocusY: clampPercent(base.desktopFocusY),
    notes,
    rejectionReasons,
  };
};

export const isWallpaperValidationAcceptable = (result: WallpaperValidationResult) => {
  if (result.hasReadableText || result.hasUiOverlay || !result.safeZonesClear) {
    return false;
  }

  if (result.scenicQualityScore < 72) return false;
  if (result.detailScore < 68) return false;
  if (result.contrastScore < 60) return false;
  if (result.moodMatchScore < 72) return false;

  return result.approved;
};

const clampScore = (value: number | null | undefined) => {
  if (typeof value !== "number" || Number.isNaN(value)) return 0;
  return Math.max(0, Math.min(100, Math.round(value)));
};

const clampPercent = (value: number | null | undefined) => {
  if (typeof value !== "number" || Number.isNaN(value)) return 50;
  return Math.max(0, Math.min(100, Number(value.toFixed(2))));
};
