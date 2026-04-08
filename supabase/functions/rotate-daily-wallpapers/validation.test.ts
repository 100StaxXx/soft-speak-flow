import {
  buildWallpaperValidationPrompt,
  isWallpaperValidationAcceptable,
  normalizeWallpaperValidationResult,
  parseWallpaperValidationResult,
} from "./validation.ts";
import { wallpaperGenerationSpecs } from "../../../src/shared/wallpaperCatalog.ts";

Deno.test("buildWallpaperValidationPrompt includes the page label and review schema", () => {
  const prompt = buildWallpaperValidationPrompt(wallpaperGenerationSpecs.campaigns);

  if (!prompt.includes("Campaigns")) {
    throw new Error(`Expected prompt to reference Campaigns, got: ${prompt}`);
  }

  if (!prompt.includes("\"approved\"")) {
    throw new Error("Expected validation schema to be embedded in the prompt");
  }
});

Deno.test("parseWallpaperValidationResult normalizes fenced JSON payloads", () => {
  const parsed = parseWallpaperValidationResult(`\`\`\`json
{
  "approved": true,
  "hasReadableText": false,
  "hasUiOverlay": false,
  "safeZonesClear": true,
  "scenicQualityScore": 91,
  "detailScore": 84,
  "contrastScore": 72,
  "moodMatchScore": 88,
  "mobileFocusX": 44.7,
  "mobileFocusY": 26.2,
  "desktopFocusX": 49.1,
  "desktopFocusY": 30.4,
  "notes": ["clean"],
  "rejectionReasons": []
}
\`\`\``);

  if (!parsed.approved) {
    throw new Error("Expected parsed validation to remain approved");
  }

  if (parsed.mobileFocusX !== 44.7 || parsed.desktopFocusY !== 30.4) {
    throw new Error(`Unexpected normalized focus values: ${JSON.stringify(parsed)}`);
  }
});

Deno.test("isWallpaperValidationAcceptable rejects text, UI, and weak scenic quality", () => {
  const valid = normalizeWallpaperValidationResult({
    approved: true,
    safeZonesClear: true,
    scenicQualityScore: 85,
    detailScore: 80,
    contrastScore: 70,
    moodMatchScore: 90,
  });

  if (!isWallpaperValidationAcceptable(valid)) {
    throw new Error("Expected strong scenic validation to pass");
  }

  const rejected = normalizeWallpaperValidationResult({
    approved: true,
    hasReadableText: true,
    safeZonesClear: true,
    scenicQualityScore: 85,
    detailScore: 80,
    contrastScore: 70,
    moodMatchScore: 90,
  });

  if (isWallpaperValidationAcceptable(rejected)) {
    throw new Error("Expected readable text to force rejection");
  }
});
