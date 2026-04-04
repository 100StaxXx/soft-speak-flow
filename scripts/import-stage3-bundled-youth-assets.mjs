import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";
import { processSheetPanel } from "./companion-portrait-pipeline.mjs";

const ELEMENT_ORDER = ["fire", "ice", "storm", "nature", "void", "light"];

const SHEET_SOURCES = [
  { presetId: "dragon", filename: "dragonstage3.png" },
  { presetId: "wolf", filename: "wolfstage3.png" },
  { presetId: "fox", filename: "kitsunestage3.png" },
  { presetId: "owl", filename: "owlstage3.png" },
  { presetId: "lion", filename: "lionstage3.png" },
  { presetId: "phoenix", filename: "phoenixstage3.png" },
  { presetId: "pegasus", filename: "pegasusstage3.png" },
  { presetId: "griffin", filename: "griffinstage3.png" },
  { presetId: "sphinx", filename: "sphinxstage3.png" },
  { presetId: "leviathan", filename: "leviathanstage3.png" },
  { presetId: "mechanicaldragon", filename: "mechanicaldragonstage3.png" },
  { presetId: "tanuki", filename: "tanukistage3.png" },
  { presetId: "buttercat", filename: "buttercatstage3.png" },
];

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function parseArgs(argv) {
  const result = {};
  for (let index = 0; index < argv.length; index += 1) {
    const current = argv[index];
    if (!current.startsWith("--")) continue;
    const key = current.slice(2);
    const next = argv[index + 1];
    if (!next || next.startsWith("--")) {
      result[key] = "true";
      continue;
    }
    result[key] = next;
    index += 1;
  }
  return result;
}

async function cropSheet(sourcePath, outputRoot, presetId) {
  const metadata = await sharp(sourcePath).metadata();
  const width = metadata.width ?? 0;
  const height = metadata.height ?? 0;
  if (!width || !height) {
    throw new Error(`Could not read dimensions for ${sourcePath}`);
  }

  for (let index = 0; index < ELEMENT_ORDER.length; index += 1) {
    const element = ELEMENT_ORDER[index];
    const column = index % 3;
    const row = Math.floor(index / 3);
    const outputDir = path.join(outputRoot, presetId, "t1_youth", "normal");
    const outputPath = path.join(
      outputDir,
      `${presetId}__t1_youth__normal__${element}.png`,
    );

    ensureDir(outputDir);
    await processSheetPanel({
      sourcePath,
      width,
      height,
      row,
      column,
      outputPath,
    });
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const sourceDir = args.source ?? "/Users/macbookair/Documents/Stage 3";
  const outputRoot = args.output ?? path.join(process.cwd(), "public", "companion-presets");

  for (const sheet of SHEET_SOURCES) {
    const sourcePath = path.join(sourceDir, sheet.filename);
    if (!fs.existsSync(sourcePath)) {
      throw new Error(`Missing source sheet: ${sourcePath}`);
    }
    await cropSheet(sourcePath, outputRoot, sheet.presetId);
  }

  console.log(
    JSON.stringify(
      {
        sourceDir,
        outputRoot,
        importedPresets: SHEET_SOURCES.map((sheet) => sheet.presetId),
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
