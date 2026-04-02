import fs from "node:fs";
import path from "node:path";
import {
  REFERENCE_SHEET_DIR,
  STAGE2,
  buildReferenceSheetFilename,
  coercePresetId,
  ensureDir,
  extractReferenceSheetToSingles,
  parseArgs,
} from "./companion-stage2-preview-utils";

function extnameOrDefault(filePath: string): string {
  const extension = path.extname(filePath);
  return extension || ".png";
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const inputPath = args.input;
  const presetId = coercePresetId(args.preset);
  const stage = Number(args.stage ?? STAGE2);

  if (!inputPath) {
    throw new Error("Missing required --input argument.");
  }

  if (stage !== STAGE2) {
    throw new Error(`This extractor is locked to stage ${STAGE2} reference sheets.`);
  }

  if (!fs.existsSync(inputPath)) {
    throw new Error(`Input file not found: ${inputPath}`);
  }

  ensureDir(REFERENCE_SHEET_DIR);

  const extension = extnameOrDefault(inputPath);
  const normalizedReferencePath = path.join(
    REFERENCE_SHEET_DIR,
    buildReferenceSheetFilename(presetId, extension),
  );

  fs.copyFileSync(inputPath, normalizedReferencePath);

  const extracted = await extractReferenceSheetToSingles({
    inputPath: normalizedReferencePath,
    presetId,
    stage,
  });

  for (const outputPath of extracted) {
    console.log(`Extracted -> ${outputPath}`);
  }

  console.log(`Copied reference sheet -> ${normalizedReferencePath}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
