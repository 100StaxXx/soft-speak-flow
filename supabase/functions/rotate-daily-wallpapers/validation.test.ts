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
  "hasPurpleDominance": false,
  "safeZonesClear": true,
  "safeZoneConfidenceScore": 89,
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

  if (parsed.mobileFocusX !== 44.7 || parsed.desktopFocusY !== 30.4 || parsed.safeZoneConfidenceScore !== 89) {
    throw new Error(`Unexpected normalized focus values: ${JSON.stringify(parsed)}`);
  }
});

Deno.test("isWallpaperValidationAcceptable rejects text, UI, and weak scenic quality", () => {
  const valid = normalizeWallpaperValidationResult({
    approved: true,
    hasPurpleDominance: false,
    safeZonesClear: true,
    safeZoneConfidenceScore: 88,
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
    hasPurpleDominance: false,
    safeZonesClear: true,
    safeZoneConfidenceScore: 88,
    scenicQualityScore: 85,
    detailScore: 80,
    contrastScore: 70,
    moodMatchScore: 90,
  });

  if (isWallpaperValidationAcceptable(rejected)) {
    throw new Error("Expected readable text to force rejection");
  }

  const purpleDominant = normalizeWallpaperValidationResult({
    approved: true,
    hasPurpleDominance: true,
    safeZonesClear: true,
    safeZoneConfidenceScore: 88,
    scenicQualityScore: 85,
    detailScore: 80,
    contrastScore: 70,
    moodMatchScore: 90,
  });

  if (isWallpaperValidationAcceptable(purpleDominant)) {
    throw new Error("Expected purple dominance to force rejection");
  }
});
