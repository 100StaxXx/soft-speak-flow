import path from "node:path";
import {
  listPortraitAssetFiles,
  processPortraitFile,
} from "./companion-portrait-pipeline.mjs";

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
  const roots = (args.roots
    ? args.roots.split(",")
    : [
        path.join(process.cwd(), "public", "companion-presets"),
        path.join(process.cwd(), "output", "companion-initiate-import", "assets"),
      ]).filter(Boolean);

  const files = roots.flatMap((root) => listPortraitAssetFiles(root));
  const processed = [];

  for (const filePath of files) {
    const result = await processPortraitFile({
      inputPath: filePath,
      outputPath: filePath,
    });
    processed.push({
      filePath,
      width: result.width,
      height: result.height,
      transparentPixels: result.transparentPixels,
      edgeBleedPixels: result.edgeBleedPixels,
    });
    console.log(`Refreshed ${filePath}`);
  }

  console.log(JSON.stringify({
    roots,
    fileCount: processed.length,
    processed,
  }, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack ?? error.message : error);
  process.exit(1);
});
