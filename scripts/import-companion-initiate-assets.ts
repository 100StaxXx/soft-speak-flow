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
import {
  buildPortraitAssetBuffer,
  validatePortraitAsset,
} from "./companion-portrait-pipeline.mjs";
import {
  INITIATE_SOURCE_BOUNDS_OVERRIDES,
  buildInitiateCropOverrideKey,
  type InitiateSourceBoundsOverride,
} from "./companion-initiate-crop-overrides";

interface RawSheet {
  data: Buffer;
  width: number;
  height: number;
  borderColor: [number, number, number];
}

interface SourceBounds {
  left: number;
  top: number;
  width: number;
  height: number;
}

interface LocalPoint {
  x: number;
  y: number;
}

interface ComponentAnalysis {
  pixels: number[];
  area: number;
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  score: number;
}

const GRID_COLUMNS = 3;
const GRID_ROWS = 2;
const BORDER_SAMPLE_STEP = 8;
const BACKGROUND_DISTANCE_THRESHOLD = 28;
const PANEL_PADDING_RATIO = 0.16;
const MASK_DILATION_ITERATIONS = 2;
const COMPONENT_CROP_PADDING_PX = 16;

function rgbaIndex(x: number, y: number, width: number): number {
  return (y * width + x) * 4;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function extractBorderColor(data: Buffer, width: number, height: number): [number, number, number] {
  let totalR = 0;
  let totalG = 0;
  let totalB = 0;
  let count = 0;

  for (let x = 0; x < width; x += BORDER_SAMPLE_STEP) {
    for (const y of [0, height - 1]) {
      const index = rgbaIndex(x, y, width);
      totalR += data[index];
      totalG += data[index + 1];
      totalB += data[index + 2];
      count += 1;
    }
  }

  for (let y = 0; y < height; y += BORDER_SAMPLE_STEP) {
    for (const x of [0, width - 1]) {
      const index = rgbaIndex(x, y, width);
      totalR += data[index];
      totalG += data[index + 1];
      totalB += data[index + 2];
      count += 1;
    }
  }

  const safeCount = Math.max(1, count);
  return [
    totalR / safeCount,
    totalG / safeCount,
    totalB / safeCount,
  ];
}

function toPanelCenter(sheet: RawSheet, row: number, column: number): LocalPoint {
  return {
    x: ((column + 0.5) * sheet.width) / GRID_COLUMNS,
    y: ((row + 0.5) * sheet.height) / GRID_ROWS,
  };
}

function getExpandedPanelBounds(
  sheet: RawSheet,
  row: number,
  column: number,
): SourceBounds {
  const cellWidth = sheet.width / GRID_COLUMNS;
  const cellHeight = sheet.height / GRID_ROWS;
  const left = Math.floor(clamp(column * cellWidth - cellWidth * PANEL_PADDING_RATIO, 0, sheet.width - 1));
  const top = Math.floor(clamp(row * cellHeight - cellHeight * PANEL_PADDING_RATIO, 0, sheet.height - 1));
  const right = Math.ceil(clamp((column + 1) * cellWidth + cellWidth * PANEL_PADDING_RATIO, 1, sheet.width));
  const bottom = Math.ceil(clamp((row + 1) * cellHeight + cellHeight * PANEL_PADDING_RATIO, 1, sheet.height));

  return {
    left,
    top,
    width: right - left,
    height: bottom - top,
  };
}

function buildForegroundMask(sheet: RawSheet, bounds: SourceBounds): Uint8Array {
  const mask = new Uint8Array(bounds.width * bounds.height);

  for (let y = 0; y < bounds.height; y += 1) {
    for (let x = 0; x < bounds.width; x += 1) {
      const sheetX = bounds.left + x;
      const sheetY = bounds.top + y;
      const index = rgbaIndex(sheetX, sheetY, sheet.width);
      const dr = sheet.data[index] - sheet.borderColor[0];
      const dg = sheet.data[index + 1] - sheet.borderColor[1];
      const db = sheet.data[index + 2] - sheet.borderColor[2];
      const distance = Math.sqrt(dr * dr + dg * dg + db * db);

      if (distance > BACKGROUND_DISTANCE_THRESHOLD) {
        mask[y * bounds.width + x] = 1;
      }
    }
  }

  return mask;
}

function analyzeComponents(mask: Uint8Array, width: number, height: number, target: LocalPoint): ComponentAnalysis[] {
  const visited = new Uint8Array(width * height);
  const queue = new Int32Array(width * height);
  const components: ComponentAnalysis[] = [];

  for (let start = 0; start < mask.length; start += 1) {
    if (!mask[start] || visited[start]) continue;

    let head = 0;
    let tail = 0;
    queue[tail] = start;
    tail += 1;
    visited[start] = 1;

    let area = 0;
    let minX = width;
    let minY = height;
    let maxX = -1;
    let maxY = -1;
    let sumX = 0;
    let sumY = 0;
    const pixels: number[] = [];

    while (head < tail) {
      const current = queue[head];
      head += 1;

      const x = current % width;
      const y = Math.floor(current / width);
      pixels.push(current);
      area += 1;
      sumX += x;
      sumY += y;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;

      for (const [nextX, nextY] of [
        [x - 1, y],
        [x + 1, y],
        [x, y - 1],
        [x, y + 1],
      ]) {
        if (nextX < 0 || nextX >= width || nextY < 0 || nextY >= height) continue;
        const nextIndex = nextY * width + nextX;
        if (!mask[nextIndex] || visited[nextIndex]) continue;
        visited[nextIndex] = 1;
        queue[tail] = nextIndex;
        tail += 1;
      }
    }

    const centerX = sumX / Math.max(1, area);
    const centerY = sumY / Math.max(1, area);
    const dx = (centerX - target.x) / Math.max(1, width);
    const dy = (centerY - target.y) / Math.max(1, height);
    const distance = Math.sqrt(dx * dx + dy * dy);
    const score = area * (1.8 - Math.min(1.5, distance * 2.4));

    components.push({
      pixels,
      area,
      minX,
      minY,
      maxX,
      maxY,
      score,
    });
  }

  return components.sort((left, right) => right.score - left.score);
}

function dilateMask(mask: Uint8Array, width: number, height: number, iterations = MASK_DILATION_ITERATIONS): Uint8Array {
  let current = mask;

  for (let iteration = 0; iteration < iterations; iteration += 1) {
    const next = new Uint8Array(width * height);

    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        let fill = 0;

        for (let offsetY = -1; offsetY <= 1 && !fill; offsetY += 1) {
          for (let offsetX = -1; offsetX <= 1; offsetX += 1) {
            const nextX = x + offsetX;
            const nextY = y + offsetY;
            if (nextX < 0 || nextX >= width || nextY < 0 || nextY >= height) continue;
            if (current[nextY * width + nextX]) {
              fill = 1;
              break;
            }
          }
        }

        next[y * width + x] = fill;
      }
    }

    current = next;
  }

  return current;
}

function getMaskBounds(mask: Uint8Array, width: number, height: number): SourceBounds | null {
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (!mask[y * width + x]) continue;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  }

  if (maxX < minX || maxY < minY) {
    return null;
  }

  return {
    left: minX,
    top: minY,
    width: maxX - minX + 1,
    height: maxY - minY + 1,
  };
}

function expandLocalBounds(bounds: SourceBounds, width: number, height: number): SourceBounds {
  const left = Math.max(0, bounds.left - COMPONENT_CROP_PADDING_PX);
  const top = Math.max(0, bounds.top - COMPONENT_CROP_PADDING_PX);
  const right = Math.min(width, bounds.left + bounds.width + COMPONENT_CROP_PADDING_PX);
  const bottom = Math.min(height, bounds.top + bounds.height + COMPONENT_CROP_PADDING_PX);

  return {
    left,
    top,
    width: right - left,
    height: bottom - top,
  };
}

function toSheetBounds(localBounds: SourceBounds, parentBounds: SourceBounds): SourceBounds {
  return {
    left: parentBounds.left + localBounds.left,
    top: parentBounds.top + localBounds.top,
    width: localBounds.width,
    height: localBounds.height,
  };
}

async function loadSheet(sourcePath: string): Promise<RawSheet> {
  if (!fs.existsSync(sourcePath)) {
    throw new Error(`Missing Initiate source sheet: ${sourcePath}`);
  }

  const { data, info } = await sharp(sourcePath)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  if (!info.width || !info.height || !info.channels) {
    throw new Error(`Could not read image dimensions for ${sourcePath}`);
  }

  return {
    data,
    width: info.width,
    height: info.height,
    borderColor: extractBorderColor(data, info.width, info.height),
  };
}

function detectAutoSourceBounds(sheet: RawSheet, row: number, column: number): SourceBounds {
  const searchBounds = getExpandedPanelBounds(sheet, row, column);
  const targetCenter = toPanelCenter(sheet, row, column);
  const localTarget = {
    x: targetCenter.x - searchBounds.left,
    y: targetCenter.y - searchBounds.top,
  };
  const mask = buildForegroundMask(sheet, searchBounds);
  const chosen = analyzeComponents(mask, searchBounds.width, searchBounds.height, localTarget)[0];

  if (!chosen) {
    return searchBounds;
  }

  const componentMask = new Uint8Array(searchBounds.width * searchBounds.height);
  for (const pixelIndex of chosen.pixels) {
    componentMask[pixelIndex] = 1;
  }

  const expandedMask = dilateMask(componentMask, searchBounds.width, searchBounds.height);
  const localBounds = getMaskBounds(expandedMask, searchBounds.width, searchBounds.height);

  if (!localBounds) {
    return searchBounds;
  }

  return toSheetBounds(
    expandLocalBounds(localBounds, searchBounds.width, searchBounds.height),
    searchBounds,
  );
}

function resolveSourceBounds(
  sheet: RawSheet,
  plan: InitiateSheetPlan,
): Map<string, { sourceBounds: SourceBounds; overrideBounds: InitiateSourceBoundsOverride | null }> {
  const sourceBoundsByOutputPath = new Map<
    string,
    { sourceBounds: SourceBounds; overrideBounds: InitiateSourceBoundsOverride | null }
  >();

  for (const asset of plan.assets) {
    const overrideKey = buildInitiateCropOverrideKey(asset.presetId, asset.elementId);
    const overrideBounds = INITIATE_SOURCE_BOUNDS_OVERRIDES[overrideKey] ?? null;
    sourceBoundsByOutputPath.set(asset.outputPath, {
      sourceBounds: overrideBounds ?? detectAutoSourceBounds(sheet, asset.row, asset.column),
      overrideBounds,
    });
  }

  return sourceBoundsByOutputPath;
}

async function buildIsolatedPanelBuffer(
  sheet: RawSheet,
  sourceBounds: SourceBounds,
  row: number,
  column: number,
): Promise<Buffer> {
  const targetCenter = toPanelCenter(sheet, row, column);
  const localTarget = {
    x: targetCenter.x - sourceBounds.left,
    y: targetCenter.y - sourceBounds.top,
  };
  const mask = buildForegroundMask(sheet, sourceBounds);
  const chosen = analyzeComponents(mask, sourceBounds.width, sourceBounds.height, localTarget)[0];

  if (!chosen) {
    return sharp({
      create: {
        width: sourceBounds.width,
        height: sourceBounds.height,
        channels: 4,
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      },
    })
      .png()
      .toBuffer();
  }

  const componentMask = new Uint8Array(sourceBounds.width * sourceBounds.height);
  for (const pixelIndex of chosen.pixels) {
    componentMask[pixelIndex] = 1;
  }

  const expandedMask = dilateMask(componentMask, sourceBounds.width, sourceBounds.height);
  const localBounds = getMaskBounds(expandedMask, sourceBounds.width, sourceBounds.height);

  if (!localBounds) {
    throw new Error("Unable to derive panel bounds from the selected initiate component.");
  }

  const croppedBounds = expandLocalBounds(localBounds, sourceBounds.width, sourceBounds.height);
  const output = Buffer.alloc(croppedBounds.width * croppedBounds.height * 4);

  for (let y = 0; y < croppedBounds.height; y += 1) {
    for (let x = 0; x < croppedBounds.width; x += 1) {
      const localX = croppedBounds.left + x;
      const localY = croppedBounds.top + y;
      if (!expandedMask[localY * sourceBounds.width + localX]) continue;

      const sheetX = sourceBounds.left + localX;
      const sheetY = sourceBounds.top + localY;
      const sourceIndex = rgbaIndex(sheetX, sheetY, sheet.width);
      const outputIndex = rgbaIndex(x, y, croppedBounds.width);
      output[outputIndex] = sheet.data[sourceIndex];
      output[outputIndex + 1] = sheet.data[sourceIndex + 1];
      output[outputIndex + 2] = sheet.data[sourceIndex + 2];
      output[outputIndex + 3] = 255;
    }
  }

  return sharp(output, {
    raw: {
      width: croppedBounds.width,
      height: croppedBounds.height,
      channels: 4,
    },
  })
    .png()
    .toBuffer();
}

async function cropSheet({
  plan,
  sheet,
}: {
  plan: InitiateSheetPlan;
  sheet: RawSheet;
}): Promise<Array<{
  outputPath: string;
  width: number;
  height: number;
  transparentPixels: number;
  edgeBleedPixels: number;
  sourceBounds: SourceBounds;
  overrideApplied: boolean;
}>> {
  const results = [];
  const sourceBoundsByOutputPath = resolveSourceBounds(sheet, plan);

  for (const asset of plan.assets) {
    const sourceEntry = sourceBoundsByOutputPath.get(asset.outputPath);
    if (!sourceEntry) {
      throw new Error(`Missing initiate source bounds for ${asset.outputPath}`);
    }

    ensureDir(path.dirname(asset.outputPath));
    const isolatedBuffer = await buildIsolatedPanelBuffer(
      sheet,
      sourceEntry.sourceBounds,
      asset.row,
      asset.column,
    );
    const outputBuffer = await buildPortraitAssetBuffer(isolatedBuffer);
    const result = await validatePortraitAsset(outputBuffer);

    if (result.errors.length > 0) {
      throw new Error(`${path.basename(asset.outputPath)} failed portrait validation: ${result.errors.join(" ")}`);
    }

    fs.writeFileSync(asset.outputPath, outputBuffer);
    results.push({
      outputPath: asset.outputPath,
      width: result.width,
      height: result.height,
      transparentPixels: result.transparentPixels,
      edgeBleedPixels: result.edgeBleedPixels,
      sourceBounds: sourceEntry.sourceBounds,
      overrideApplied: Boolean(sourceEntry.overrideBounds),
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
    const sheet = await loadSheet(plan.sourcePath);
    const outputStatsByPath = new Map<
      string,
      {
        width: number;
        height: number;
        transparentPixels: number;
        edgeBleedPixels: number;
        sourceBounds: SourceBounds;
        overrideApplied: boolean;
      }
    >();
    if (!dryRun) {
      const outputStats = await cropSheet({
        plan,
        sheet,
      });
      for (const item of outputStats) {
        outputStatsByPath.set(item.outputPath, item);
      }
    }

    inspectedSheets.push({
      presetId: plan.presetId,
      sourceFilename: plan.sourceFilename,
      sourcePath: plan.sourcePath,
      width: sheet.width,
      height: sheet.height,
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
        sourceBounds: outputStatsByPath.get(asset.outputPath)?.sourceBounds ?? null,
        overrideApplied: outputStatsByPath.get(asset.outputPath)?.overrideApplied ?? false,
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
