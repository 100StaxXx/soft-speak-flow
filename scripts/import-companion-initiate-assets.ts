import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";
import { ensureDir, writeJson } from "./badge-reward-preview-utils";
import { parseArgs } from "./companion-stage2-preview-utils";
import {
  DEFAULT_INITIATE_SOURCE_DIR,
  INITIATE_ART_TIER,
  INITIATE_ASSET_OUTPUT_DIR,
  INITIATE_LOG_DIR,
  INITIATE_MANIFEST_DIR,
  INITIATE_STORAGE_BUCKET,
  INITIATE_VISUAL_STATE,
  buildInitiateSheetPlans,
  countInitiatePlannedAssets,
  type InitiateSheetPlan,
} from "./companion-initiate-import-utils";
import { processSheetPanel } from "./companion-portrait-pipeline.mjs";

interface InspectedSheet {
  width: number;
  height: number;
}

async function inspectSheet(sourcePath: string): Promise<InspectedSheet> {
  if (!fs.existsSync(sourcePath)) {
    throw new Error(`Missing Initiate source sheet: ${sourcePath}`);
  }

  const metadata = await sharp(sourcePath).metadata();
  if (!metadata.width || !metadata.height) {
    throw new Error(`Could not read image dimensions for ${sourcePath}`);
  }

  return {
    width: metadata.width,
    height: metadata.height,
  };
}

async function cropSheet({
  plan,
  width,
  height,
}: {
  plan: InitiateSheetPlan;
  width: number;
  height: number;
}): Promise<Array<{ outputPath: string; width: number; height: number; transparentPixels: number; edgeBleedPixels: number }>> {
  const results = [];

  for (const asset of plan.assets) {
    ensureDir(path.dirname(asset.outputPath));
    const result = await processSheetPanel({
      sourcePath: plan.sourcePath,
      width,
      height,
      row: asset.row,
      column: asset.column,
      outputPath: asset.outputPath,
    });

    results.push({
      outputPath: asset.outputPath,
      width: result.width,
      height: result.height,
      transparentPixels: result.transparentPixels,
      edgeBleedPixels: result.edgeBleedPixels,
    });
  }

  return results;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const dryRun = args["dry-run"] === "true" || "dry-run" in args;
  const sourceDir = args.source ?? DEFAULT_INITIATE_SOURCE_DIR;
  const outputRoot = args.output ?? INITIATE_ASSET_OUTPUT_DIR;
  const manifestPath = path.join(INITIATE_MANIFEST_DIR, "companions.initiate.import.manifest.json");
  const summaryPath = path.join(INITIATE_LOG_DIR, "companions.initiate.import.summary.json");
  const plans = buildInitiateSheetPlans({ sourceDir, outputRoot });
  const totalAssets = countInitiatePlannedAssets(plans);
  const inspectedSheets = [];

  for (const plan of plans) {
    const inspected = await inspectSheet(plan.sourcePath);
    const outputStatsByPath = new Map<
      string,
      { width: number; height: number; transparentPixels: number; edgeBleedPixels: number }
    >();
    if (!dryRun) {
      const outputStats = await cropSheet({
        plan,
        width: inspected.width,
        height: inspected.height,
      });
      for (const item of outputStats) {
        outputStatsByPath.set(item.outputPath, item);
      }
    }

    inspectedSheets.push({
      presetId: plan.presetId,
      sourceFilename: plan.sourceFilename,
      sourcePath: plan.sourcePath,
      width: inspected.width,
      height: inspected.height,
      assets: plan.assets.map((asset) => ({
        presetId: asset.presetId,
        elementId: asset.elementId,
        panelIndex: asset.panelIndex,
        row: asset.row,
        column: asset.column,
        outputFilename: asset.outputFilename,
        outputPath: asset.outputPath,
        storagePath: asset.storagePath,
        cropped: dryRun ? false : fs.existsSync(asset.outputPath),
        outputWidth: outputStatsByPath.get(asset.outputPath)?.width ?? null,
        outputHeight: outputStatsByPath.get(asset.outputPath)?.height ?? null,
        transparentPixels: outputStatsByPath.get(asset.outputPath)?.transparentPixels ?? null,
        edgeBleedPixels: outputStatsByPath.get(asset.outputPath)?.edgeBleedPixels ?? null,
      })),
    });
  }

  const manifest = {
    sourceDir,
    outputRoot,
    bucketName: INITIATE_STORAGE_BUCKET,
    tier: INITIATE_ART_TIER,
    state: INITIATE_VISUAL_STATE,
    dryRun,
    sheetCount: plans.length,
    assetCount: totalAssets,
    sheets: inspectedSheets,
    generatedAt: new Date().toISOString(),
  };

  writeJson(manifestPath, manifest);
  writeJson(summaryPath, {
    sourceDir,
    outputRoot,
    dryRun,
    sheetCount: plans.length,
    assetCount: totalAssets,
    manifestPath,
    generatedAt: manifest.generatedAt,
  });

  console.log(`Prepared ${plans.length} Initiate sheets -> ${totalAssets} planned assets.`);
  console.log(`Wrote manifest -> ${manifestPath}`);
  if (dryRun) {
    console.log("Dry run enabled: no cropped files were written.");
  } else {
    console.log(`Cropped production-ready assets into ${outputRoot}`);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
