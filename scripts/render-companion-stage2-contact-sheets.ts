import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";
import {
  COMPANION_ELEMENTS,
  COMPANION_PRESETS,
  type CompanionElementId,
  type CompanionPresetId,
} from "@/config/companionCatalog";
import {
  CONTACT_SHEET_DIR,
  ELEMENT_PANEL_ORDER,
  REVIEW_INDEX_PATH,
  STAGE2,
  STAGE2_NAME,
  buildContactSheetFilename,
  buildSingleOutputDir,
  buildSingleOutputPath,
  ensureDir,
  writeText,
} from "./companion-stage2-preview-utils";

const TILE_WIDTH = 512;
const TILE_HEIGHT = 512;
const HEADER_HEIGHT = 96;
const LABEL_HEIGHT = 56;
const SHEET_COLUMNS = 3;
const SHEET_ROWS = 2;
const SHEET_WIDTH = TILE_WIDTH * SHEET_COLUMNS;
const SHEET_HEIGHT = HEADER_HEIGHT + (TILE_HEIGHT + LABEL_HEIGHT) * SHEET_ROWS;

const ELEMENT_LOOKUP = new Map(COMPANION_ELEMENTS.map((element) => [element.id, element] as const));

interface SheetSummary {
  presetId: CompanionPresetId;
  presetName: string;
  imageCount: number;
  contactSheetPath: string;
}

function elementLabel(elementId: CompanionElementId) {
  return ELEMENT_LOOKUP.get(elementId)?.label ?? elementId;
}

function escapeXml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll("\"", "&quot;")
    .replaceAll("'", "&apos;");
}

function placeholderSvg(params: {
  speciesName: string;
  elementId: CompanionElementId;
  color: string;
}): Buffer {
  const { speciesName, elementId, color } = params;
  const label = elementLabel(elementId);
  const svg = `
<svg xmlns="http://www.w3.org/2000/svg" width="${TILE_WIDTH}" height="${TILE_HEIGHT + LABEL_HEIGHT}" viewBox="0 0 ${TILE_WIDTH} ${TILE_HEIGHT + LABEL_HEIGHT}">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#111827" />
      <stop offset="100%" stop-color="${color}" />
    </linearGradient>
  </defs>
  <rect x="0" y="0" width="${TILE_WIDTH}" height="${TILE_HEIGHT}" rx="28" fill="url(#bg)" />
  <circle cx="${TILE_WIDTH / 2}" cy="${TILE_HEIGHT / 2 - 24}" r="104" fill="rgba(255,255,255,0.08)" />
  <text x="50%" y="${TILE_HEIGHT / 2 - 32}" text-anchor="middle" fill="#F8FAFC" font-size="26" font-family="SF Pro Display, Inter, sans-serif" font-weight="700">${escapeXml(speciesName)}</text>
  <text x="50%" y="${TILE_HEIGHT / 2 + 8}" text-anchor="middle" fill="#E2E8F0" font-size="22" font-family="SF Pro Display, Inter, sans-serif">Missing ${escapeXml(label)}</text>
  <text x="50%" y="${TILE_HEIGHT / 2 + 44}" text-anchor="middle" fill="#CBD5E1" font-size="18" font-family="SF Pro Display, Inter, sans-serif">Add ${escapeXml(elementId)} single to render this slot</text>
  <rect x="0" y="${TILE_HEIGHT}" width="${TILE_WIDTH}" height="${LABEL_HEIGHT}" fill="rgba(2,6,23,0.92)" />
  <text x="50%" y="${TILE_HEIGHT + 36}" text-anchor="middle" fill="#F8FAFC" font-size="24" font-family="SF Pro Display, Inter, sans-serif" font-weight="700">${escapeXml(label)}</text>
</svg>
`.trim();

  return Buffer.from(svg);
}

function sheetHeaderSvg(speciesName: string): Buffer {
  const svg = `
<svg xmlns="http://www.w3.org/2000/svg" width="${SHEET_WIDTH}" height="${HEADER_HEIGHT}" viewBox="0 0 ${SHEET_WIDTH} ${HEADER_HEIGHT}">
  <rect x="0" y="0" width="${SHEET_WIDTH}" height="${HEADER_HEIGHT}" fill="#020617" />
  <text x="48" y="44" fill="#F8FAFC" font-size="34" font-family="SF Pro Display, Inter, sans-serif" font-weight="800">${escapeXml(speciesName)} Stage ${STAGE2}</text>
  <text x="48" y="76" fill="#CBD5E1" font-size="20" font-family="SF Pro Display, Inter, sans-serif">${escapeXml(STAGE2_NAME)} review sheet</text>
</svg>
`.trim();

  return Buffer.from(svg);
}

async function loadTile(presetId: CompanionPresetId, presetName: string, elementId: CompanionElementId): Promise<Buffer> {
  const filePath = buildSingleOutputPath(presetId, elementId);
  const color = ELEMENT_LOOKUP.get(elementId)?.anchorColor ?? "#475569";

  if (!fs.existsSync(filePath)) {
    return sharp(placeholderSvg({ speciesName: presetName, elementId, color }))
      .png()
      .toBuffer();
  }

  const label = elementLabel(elementId);
  const imageBuffer = await sharp(filePath)
    .resize(TILE_WIDTH, TILE_HEIGHT, { fit: "cover" })
    .png()
    .toBuffer();

  const labelOverlay = Buffer.from(`
<svg xmlns="http://www.w3.org/2000/svg" width="${TILE_WIDTH}" height="${LABEL_HEIGHT}" viewBox="0 0 ${TILE_WIDTH} ${LABEL_HEIGHT}">
  <rect x="0" y="0" width="${TILE_WIDTH}" height="${LABEL_HEIGHT}" fill="rgba(2,6,23,0.92)" />
  <text x="50%" y="36" text-anchor="middle" fill="#F8FAFC" font-size="24" font-family="SF Pro Display, Inter, sans-serif" font-weight="700">${escapeXml(label)}</text>
</svg>
`.trim());

  return sharp({
    create: {
      width: TILE_WIDTH,
      height: TILE_HEIGHT + LABEL_HEIGHT,
      channels: 4,
      background: "#020617",
    },
  })
    .composite([
      { input: imageBuffer, top: 0, left: 0 },
      { input: labelOverlay, top: TILE_HEIGHT, left: 0 },
    ])
    .png()
    .toBuffer();
}

async function renderSheetForPreset(presetId: CompanionPresetId): Promise<SheetSummary | null> {
  const preset = COMPANION_PRESETS.find((entry) => entry.id === presetId);
  if (!preset) return null;

  const singleDir = buildSingleOutputDir(presetId);
  const existingCount = ELEMENT_PANEL_ORDER.reduce((count, elementId) => {
    const filePath = path.join(singleDir, path.basename(buildSingleOutputPath(presetId, elementId)));
    return count + (fs.existsSync(filePath) ? 1 : 0);
  }, 0);

  if (existingCount === 0) {
    return null;
  }

  ensureDir(CONTACT_SHEET_DIR);

  const composites: sharp.OverlayOptions[] = [
    { input: sheetHeaderSvg(preset.displayName), top: 0, left: 0 },
  ];

  for (let index = 0; index < ELEMENT_PANEL_ORDER.length; index += 1) {
    const row = Math.floor(index / SHEET_COLUMNS);
    const column = index % SHEET_COLUMNS;
    const top = HEADER_HEIGHT + row * (TILE_HEIGHT + LABEL_HEIGHT);
    const left = column * TILE_WIDTH;
    const tile = await loadTile(presetId, preset.displayName, ELEMENT_PANEL_ORDER[index]);
    composites.push({ input: tile, top, left });
  }

  const outputPath = path.join(CONTACT_SHEET_DIR, buildContactSheetFilename(presetId));
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
    .toFile(outputPath);

  return {
    presetId,
    presetName: preset.displayName,
    imageCount: existingCount,
    contactSheetPath: outputPath,
  };
}

function buildIndexHtml(summary: SheetSummary[]): string {
  const cards = summary
    .map((item) => {
      const relativePath = path.relative(path.dirname(REVIEW_INDEX_PATH), item.contactSheetPath);
      return `
        <article class="card">
          <h2>${escapeXml(item.presetName)}</h2>
          <p>${item.imageCount}/6 element singles available</p>
          <img src="${escapeXml(relativePath)}" alt="${escapeXml(item.presetName)} stage 2 contact sheet" />
        </article>
      `.trim();
    })
    .join("\n");

  return `
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Companion Stage-2 Review</title>
    <style>
      :root {
        color-scheme: dark;
        --bg: #020617;
        --card: #0f172a;
        --text: #f8fafc;
        --muted: #cbd5e1;
        --border: rgba(148, 163, 184, 0.25);
      }
      * { box-sizing: border-box; }
      body {
        margin: 0;
        font-family: Inter, system-ui, sans-serif;
        background: radial-gradient(circle at top, #0f172a, #020617 60%);
        color: var(--text);
        padding: 32px;
      }
      h1 {
        margin: 0 0 12px;
        font-size: 2rem;
      }
      p.lead {
        margin: 0 0 24px;
        color: var(--muted);
      }
      .grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(360px, 1fr));
        gap: 24px;
      }
      .card {
        background: rgba(15, 23, 42, 0.85);
        border: 1px solid var(--border);
        border-radius: 24px;
        padding: 20px;
        backdrop-filter: blur(10px);
      }
      .card h2 {
        margin: 0 0 8px;
        font-size: 1.25rem;
      }
      .card p {
        margin: 0 0 16px;
        color: var(--muted);
      }
      .card img {
        width: 100%;
        display: block;
        border-radius: 18px;
      }
    </style>
  </head>
  <body>
    <h1>Companion Stage-2 Review Sheets</h1>
    <p class="lead">Generated sheets for any species that currently have extracted or created element singles.</p>
    <section class="grid">
      ${cards}
    </section>
  </body>
</html>
`.trim();
}

async function main() {
  const summary: SheetSummary[] = [];

  for (const preset of COMPANION_PRESETS) {
    const sheet = await renderSheetForPreset(preset.id);
    if (sheet) {
      summary.push(sheet);
      console.log(`Rendered ${sheet.presetName} -> ${sheet.contactSheetPath}`);
    }
  }

  if (summary.length === 0) {
    throw new Error("No companion singles found. Extract at least one sheet before rendering contact sheets.");
  }

  writeText(REVIEW_INDEX_PATH, buildIndexHtml(summary));
  console.log(`Wrote review index -> ${REVIEW_INDEX_PATH}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
