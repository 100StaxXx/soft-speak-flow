import fs from "node:fs";
import sharp from "sharp";
import {
  COMPANION_ELEMENTS,
  COMPANION_EXPRESSION_MOODS,
  COMPANION_PRESETS,
  type CompanionArtTier,
  type CompanionElementId,
  type CompanionExpressionMood,
  type CompanionPresetId,
} from "@/config/companionCatalog";
import {
  CONTACT_SHEET_DIR,
  EXPRESSIVE_TIERS,
  EXPRESSIVE_VARIANTS,
  buildExpressiveContactSheetPath,
  buildExpressiveSingleOutputPath,
  ensureDir,
} from "./companion-expressive-preview-utils";

const TILE_SIZE = 220;
const LABEL_HEIGHT = 36;
const HEADER_HEIGHT = 92;
const LEFT_LABEL_WIDTH = 132;
const COLUMNS = EXPRESSIVE_VARIANTS.length;
const ROWS = COMPANION_EXPRESSION_MOODS.length;
const SHEET_WIDTH = LEFT_LABEL_WIDTH + TILE_SIZE * COLUMNS;
const SHEET_HEIGHT = HEADER_HEIGHT + (TILE_SIZE + LABEL_HEIGHT) * ROWS;

const PRESET_LOOKUP = new Map(COMPANION_PRESETS.map((preset) => [preset.id, preset] as const));
const ELEMENT_LOOKUP = new Map(COMPANION_ELEMENTS.map((element) => [element.id, element] as const));

const escapeXml = (value: string): string =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll("\"", "&quot;")
    .replaceAll("'", "&apos;");

const expressionLabel = (mood: CompanionExpressionMood) =>
  mood.charAt(0).toUpperCase() + mood.slice(1);

const tierLabel = (tier: CompanionArtTier) =>
  tier === "t1_hatchling" ? "Hatchling" : "Initiate";

const headerSvg = ({
  presetName,
  tier,
  elementName,
}: {
  presetName: string;
  tier: CompanionArtTier;
  elementName: string;
}): Buffer =>
  Buffer.from(`
<svg xmlns="http://www.w3.org/2000/svg" width="${SHEET_WIDTH}" height="${HEADER_HEIGHT}" viewBox="0 0 ${SHEET_WIDTH} ${HEADER_HEIGHT}">
  <rect width="${SHEET_WIDTH}" height="${HEADER_HEIGHT}" fill="#020617" />
  <text x="28" y="38" fill="#F8FAFC" font-size="28" font-family="SF Pro Display, Inter, sans-serif" font-weight="800">${escapeXml(presetName)} · ${escapeXml(tierLabel(tier))}</text>
  <text x="28" y="68" fill="#CBD5E1" font-size="18" font-family="SF Pro Display, Inter, sans-serif">${escapeXml(elementName)} expressive sheet · rows = moods · columns = variants</text>
</svg>
`.trim());

const rowLabelSvg = (mood: CompanionExpressionMood): Buffer =>
  Buffer.from(`
<svg xmlns="http://www.w3.org/2000/svg" width="${LEFT_LABEL_WIDTH}" height="${TILE_SIZE + LABEL_HEIGHT}" viewBox="0 0 ${LEFT_LABEL_WIDTH} ${TILE_SIZE + LABEL_HEIGHT}">
  <rect width="${LEFT_LABEL_WIDTH}" height="${TILE_SIZE + LABEL_HEIGHT}" fill="#020617" />
  <text x="18" y="${(TILE_SIZE + LABEL_HEIGHT) / 2}" fill="#F8FAFC" font-size="20" font-family="SF Pro Display, Inter, sans-serif" font-weight="700">${escapeXml(expressionLabel(mood))}</text>
</svg>
`.trim());

const tilePlaceholderSvg = ({
  mood,
  variant,
}: {
  mood: CompanionExpressionMood;
  variant: number;
}): Buffer =>
  Buffer.from(`
<svg xmlns="http://www.w3.org/2000/svg" width="${TILE_SIZE}" height="${TILE_SIZE + LABEL_HEIGHT}" viewBox="0 0 ${TILE_SIZE} ${TILE_SIZE + LABEL_HEIGHT}">
  <rect width="${TILE_SIZE}" height="${TILE_SIZE}" rx="24" fill="#0F172A" />
  <rect x="12" y="12" width="${TILE_SIZE - 24}" height="${TILE_SIZE - 24}" rx="18" fill="rgba(148,163,184,0.08)" stroke="rgba(148,163,184,0.28)" stroke-dasharray="8 8" />
  <text x="50%" y="${TILE_SIZE / 2 - 6}" text-anchor="middle" fill="#E2E8F0" font-size="22" font-family="SF Pro Display, Inter, sans-serif" font-weight="700">${escapeXml(expressionLabel(mood))}</text>
  <text x="50%" y="${TILE_SIZE / 2 + 24}" text-anchor="middle" fill="#94A3B8" font-size="18" font-family="SF Pro Display, Inter, sans-serif">v${variant}</text>
  <rect y="${TILE_SIZE}" width="${TILE_SIZE}" height="${LABEL_HEIGHT}" fill="rgba(2,6,23,0.92)" />
  <text x="50%" y="${TILE_SIZE + 24}" text-anchor="middle" fill="#F8FAFC" font-size="16" font-family="SF Pro Display, Inter, sans-serif">Variant ${variant}</text>
</svg>
`.trim());

async function loadTile({
  presetId,
  tier,
  elementId,
  mood,
  variant,
}: {
  presetId: CompanionPresetId;
  tier: CompanionArtTier;
  elementId: CompanionElementId;
  mood: CompanionExpressionMood;
  variant: number;
}): Promise<Buffer> {
  const filePath = buildExpressiveSingleOutputPath({
    presetId,
    tier,
    elementId,
    mood,
    variant,
  });

  if (!fs.existsSync(filePath)) {
    return sharp(tilePlaceholderSvg({ mood, variant })).png().toBuffer();
  }

  const labelSvg = Buffer.from(`
<svg xmlns="http://www.w3.org/2000/svg" width="${TILE_SIZE}" height="${LABEL_HEIGHT}" viewBox="0 0 ${TILE_SIZE} ${LABEL_HEIGHT}">
  <rect width="${TILE_SIZE}" height="${LABEL_HEIGHT}" fill="rgba(2,6,23,0.92)" />
  <text x="50%" y="24" text-anchor="middle" fill="#F8FAFC" font-size="16" font-family="SF Pro Display, Inter, sans-serif">Variant ${variant}</text>
</svg>
`.trim());

  const imageBuffer = await sharp(filePath)
    .resize(TILE_SIZE, TILE_SIZE, { fit: "cover" })
    .png()
    .toBuffer();

  return sharp({
    create: {
      width: TILE_SIZE,
      height: TILE_SIZE + LABEL_HEIGHT,
      channels: 4,
      background: "#020617",
    },
  })
    .composite([
      { input: imageBuffer, top: 0, left: 0 },
      { input: labelSvg, top: TILE_SIZE, left: 0 },
    ])
    .png()
    .toBuffer();
}

async function renderSheet({
  presetId,
  tier,
  elementId,
}: {
  presetId: CompanionPresetId;
  tier: CompanionArtTier;
  elementId: CompanionElementId;
}): Promise<void> {
  const presetName = PRESET_LOOKUP.get(presetId)?.displayName ?? presetId;
  const elementName = ELEMENT_LOOKUP.get(elementId)?.label ?? elementId;

  ensureDir(CONTACT_SHEET_DIR);
  const composites: sharp.OverlayOptions[] = [
    { input: headerSvg({ presetName, tier, elementName }), top: 0, left: 0 },
  ];

  for (let row = 0; row < ROWS; row += 1) {
    const mood = COMPANION_EXPRESSION_MOODS[row];
    const top = HEADER_HEIGHT + row * (TILE_SIZE + LABEL_HEIGHT);
    composites.push({ input: rowLabelSvg(mood), top, left: 0 });

    for (let column = 0; column < COLUMNS; column += 1) {
      const variant = EXPRESSIVE_VARIANTS[column];
      const tile = await loadTile({
        presetId,
        tier,
        elementId,
        mood,
        variant,
      });
      composites.push({
        input: tile,
        top,
        left: LEFT_LABEL_WIDTH + column * TILE_SIZE,
      });
    }
  }

  await sharp({
    create: {
      width: SHEET_WIDTH,
      height: SHEET_HEIGHT,
      channels: 4,
      background: "#020617",
    },
  })
    .composite(composites)
    .png()
    .toFile(
      buildExpressiveContactSheetPath({
        presetId,
        tier,
        elementId,
      }),
    );
}

async function main() {
  for (const preset of COMPANION_PRESETS) {
    for (const tier of EXPRESSIVE_TIERS) {
      for (const element of COMPANION_ELEMENTS) {
        await renderSheet({
          presetId: preset.id,
          tier,
          elementId: element.id,
        });
      }
    }
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
