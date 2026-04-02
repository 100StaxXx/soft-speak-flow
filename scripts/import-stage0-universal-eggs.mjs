import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";

const ELEMENT_ORDER = ["fire", "ice", "storm", "nature", "void", "light"];
const DEFAULT_SOURCE_PATH = "/Users/macbookair/Documents/Stage 0/Stage0Eggs.png";

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

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const sourcePath = args.source ?? DEFAULT_SOURCE_PATH;
  const outputRoot = args.output ?? path.join(process.cwd(), "public", "companion-eggs");

  if (!fs.existsSync(sourcePath)) {
    throw new Error(`Missing source sheet: ${sourcePath}`);
  }

  const metadata = await sharp(sourcePath).metadata();
  const width = metadata.width ?? 0;
  const height = metadata.height ?? 0;
  if (!width || !height) {
    throw new Error(`Could not read dimensions for ${sourcePath}`);
  }

  const tileWidth = Math.floor(width / 3);
  const tileHeight = Math.floor(height / 2);
  ensureDir(outputRoot);

  for (let index = 0; index < ELEMENT_ORDER.length; index += 1) {
    const element = ELEMENT_ORDER[index];
    const column = index % 3;
    const row = Math.floor(index / 3);
    const left = column * tileWidth;
    const top = row * tileHeight;
    const outputPath = path.join(outputRoot, `egg__t0_egg__normal__${element}.png`);

    await sharp(sourcePath)
      .extract({ left, top, width: tileWidth, height: tileHeight })
      .png()
      .toFile(outputPath);
  }

  console.log(
    JSON.stringify(
      {
        sourcePath,
        outputRoot,
        importedElements: ELEMENT_ORDER,
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
