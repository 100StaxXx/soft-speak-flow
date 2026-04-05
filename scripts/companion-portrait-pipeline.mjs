import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";

export const DEFAULT_PORTRAIT_CANVAS_SIZE = 512;
export const DEFAULT_PORTRAIT_COLUMNS = 3;
export const DEFAULT_PORTRAIT_ROWS = 2;

const BORDER_SAMPLE_STEP = 6;
const ALPHA_THRESHOLD = 10;
const PORTRAIT_PROFILE = {
  blurSigma: 5.5,
  edgeThreshold: 26,
  absBorderTolerance: 58,
  stepTolerance: 18,
  borderToleranceExtra: 22,
  maskBlurSigma: 1.05,
  flatKeyHardThreshold: 16,
  flatKeySoftThreshold: 44,
};

function clampChannel(value) {
  return Math.max(0, Math.min(255, Math.round(value)));
}

function rgbaIndex(x, y, width) {
  return (y * width + x) * 4;
}

function colorDistance(buffer, indexA, indexB) {
  const dr = buffer[indexA] - buffer[indexB];
  const dg = buffer[indexA + 1] - buffer[indexB + 1];
  const db = buffer[indexA + 2] - buffer[indexB + 2];
  return Math.sqrt(dr * dr + dg * dg + db * db);
}

function collectBorderSamples(width, height) {
  const samples = [];

  for (let x = 0; x < width; x += BORDER_SAMPLE_STEP) {
    samples.push(rgbaIndex(x, 0, width));
    samples.push(rgbaIndex(x, height - 1, width));
  }

  for (let y = 0; y < height; y += BORDER_SAMPLE_STEP) {
    samples.push(rgbaIndex(0, y, width));
    samples.push(rgbaIndex(width - 1, y, width));
  }

  return samples;
}

function estimateBorderColor(buffer, borderSamples) {
  let totalR = 0;
  let totalG = 0;
  let totalB = 0;

  for (const sampleIndex of borderSamples) {
    totalR += buffer[sampleIndex];
    totalG += buffer[sampleIndex + 1];
    totalB += buffer[sampleIndex + 2];
  }

  const count = Math.max(1, borderSamples.length);
  return [
    totalR / count,
    totalG / count,
    totalB / count,
  ];
}

function estimateEdgeStrength(buffer, x, y, width, height) {
  const center = rgbaIndex(x, y, width);
  let strongest = 0;

  const compare = (nextX, nextY) => {
    if (nextX < 0 || nextX >= width || nextY < 0 || nextY >= height) return;
    const nextIndex = rgbaIndex(nextX, nextY, width);
    const delta = colorDistance(buffer, center, nextIndex);
    if (delta > strongest) strongest = delta;
  };

  compare(x - 1, y);
  compare(x + 1, y);
  compare(x, y - 1);
  compare(x, y + 1);

  return strongest;
}

function nearestBorderDistance(buffer, pixelIndex, borderSamples) {
  let best = Number.POSITIVE_INFINITY;

  for (const borderIndex of borderSamples) {
    const distance = colorDistance(buffer, pixelIndex, borderIndex);
    if (distance < best) best = distance;
    if (best <= 4) return best;
  }

  return best;
}

async function loadRawImage(input, blurSigma = 0) {
  let pipeline = sharp(input).ensureAlpha();
  if (blurSigma > 0) pipeline = pipeline.blur(blurSigma);
  return pipeline.raw().toBuffer({ resolveWithObject: true });
}

async function borderFloodTransparent(input, profile = PORTRAIT_PROFILE) {
  const [{ data: source, info }, { data: blurred }] = await Promise.all([
    loadRawImage(input),
    loadRawImage(input, profile.blurSigma),
  ]);

  const width = info.width;
  const height = info.height;
  const totalPixels = width * height;
  const borderSamples = collectBorderSamples(width, height);
  const borderColor = estimateBorderColor(blurred, borderSamples);
  const backgroundMask = new Uint8Array(totalPixels);
  const queue = new Int32Array(totalPixels);
  let head = 0;
  let tail = 0;

  const push = (x, y) => {
    const index = y * width + x;
    if (backgroundMask[index]) return;
    backgroundMask[index] = 1;
    queue[tail] = index;
    tail += 1;
  };

  for (let x = 0; x < width; x += 1) {
    push(x, 0);
    push(x, height - 1);
  }

  for (let y = 0; y < height; y += 1) {
    push(0, y);
    push(width - 1, y);
  }

  while (head < tail) {
    const current = queue[head];
    head += 1;

    const currentX = current % width;
    const currentY = Math.floor(current / width);
    const currentIndex = rgbaIndex(currentX, currentY, width);

    for (const [nextX, nextY] of [
      [currentX - 1, currentY],
      [currentX + 1, currentY],
      [currentX, currentY - 1],
      [currentX, currentY + 1],
    ]) {
      if (nextX < 0 || nextX >= width || nextY < 0 || nextY >= height) continue;

      const nextMaskIndex = nextY * width + nextX;
      if (backgroundMask[nextMaskIndex]) continue;

      const nextIndex = rgbaIndex(nextX, nextY, width);
      const stepDistance = colorDistance(blurred, currentIndex, nextIndex);
      const borderDistance = nearestBorderDistance(blurred, nextIndex, borderSamples);
      const edgeStrength = estimateEdgeStrength(blurred, nextX, nextY, width, height);
      const dr = blurred[nextIndex] - borderColor[0];
      const dg = blurred[nextIndex + 1] - borderColor[1];
      const db = blurred[nextIndex + 2] - borderColor[2];
      const avgBorderDistance = Math.sqrt(dr * dr + dg * dg + db * db);

      const matchesBorder =
        borderDistance <= profile.absBorderTolerance
        || avgBorderDistance <= profile.absBorderTolerance * 0.9;
      const smoothContinuation =
        stepDistance <= profile.stepTolerance
        && borderDistance <= profile.absBorderTolerance + profile.borderToleranceExtra;

      if ((matchesBorder || smoothContinuation) && edgeStrength <= profile.edgeThreshold) {
        backgroundMask[nextMaskIndex] = 1;
        queue[tail] = nextMaskIndex;
        tail += 1;
      }
    }
  }

  const alphaMask = Buffer.alloc(totalPixels);
  for (let index = 0; index < totalPixels; index += 1) {
    alphaMask[index] = backgroundMask[index] ? 0 : 255;
  }

  const softenedAlpha = await sharp(alphaMask, {
    raw: {
      width,
      height,
      channels: 1,
    },
  })
    .blur(profile.maskBlurSigma)
    .raw()
    .toBuffer();

  for (let pixelIndex = 0; pixelIndex < totalPixels; pixelIndex += 1) {
    const alpha = softenedAlpha[pixelIndex] / 255;
    const sourceIndex = pixelIndex * 4;

    if (alpha > 0 && alpha < 1) {
      source[sourceIndex] = clampChannel((source[sourceIndex] - borderColor[0] * (1 - alpha)) / alpha);
      source[sourceIndex + 1] = clampChannel((source[sourceIndex + 1] - borderColor[1] * (1 - alpha)) / alpha);
      source[sourceIndex + 2] = clampChannel((source[sourceIndex + 2] - borderColor[2] * (1 - alpha)) / alpha);
    }

    source[sourceIndex + 3] = softenedAlpha[pixelIndex];
  }

  return sharp(source, {
    raw: {
      width,
      height,
      channels: 4,
    },
  })
    .png()
    .toBuffer();
}

async function keyFlatBackgroundTransparent(input, profile = PORTRAIT_PROFILE) {
  const [{ data: source, info }, { data: blurred }] = await Promise.all([
    loadRawImage(input),
    loadRawImage(input, profile.blurSigma / 2),
  ]);

  const width = info.width;
  const height = info.height;
  const borderSamples = collectBorderSamples(width, height);
  const borderColor = estimateBorderColor(blurred, borderSamples);
  const hardThreshold = Math.max(0, profile.flatKeyHardThreshold);
  const softThreshold = Math.max(hardThreshold + 1, profile.flatKeySoftThreshold);

  for (let pixelIndex = 0; pixelIndex < width * height; pixelIndex += 1) {
    const sourceIndex = pixelIndex * 4;
    const dr = source[sourceIndex] - borderColor[0];
    const dg = source[sourceIndex + 1] - borderColor[1];
    const db = source[sourceIndex + 2] - borderColor[2];
    const distance = Math.sqrt(dr * dr + dg * dg + db * db);

    let alpha = 255;
    if (distance <= hardThreshold) {
      alpha = 0;
    } else if (distance < softThreshold) {
      alpha = clampChannel(((distance - hardThreshold) / (softThreshold - hardThreshold)) * 255);
    }

    if (alpha > 0 && alpha < 255) {
      const alphaRatio = alpha / 255;
      source[sourceIndex] = clampChannel((source[sourceIndex] - borderColor[0] * (1 - alphaRatio)) / alphaRatio);
      source[sourceIndex + 1] = clampChannel((source[sourceIndex + 1] - borderColor[1] * (1 - alphaRatio)) / alphaRatio);
      source[sourceIndex + 2] = clampChannel((source[sourceIndex + 2] - borderColor[2] * (1 - alphaRatio)) / alphaRatio);
    }

    source[sourceIndex + 3] = alpha;
  }

  return sharp(source, {
    raw: {
      width,
      height,
      channels: 4,
    },
  })
    .png()
    .toBuffer();
}

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function toPngBuffer(input) {
  return sharp(input)
    .ensureAlpha()
    .png()
    .toBuffer();
}

export async function getAlphaBounds(input) {
  const { data, info } = await sharp(input)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  let minX = info.width;
  let minY = info.height;
  let maxX = -1;
  let maxY = -1;
  let transparentPixels = 0;
  let nonOpaquePixels = 0;
  let edgeBleedPixels = 0;

  for (let y = 0; y < info.height; y += 1) {
    for (let x = 0; x < info.width; x += 1) {
      const alphaIndex = (y * info.width + x) * info.channels + 3;
      const alpha = data[alphaIndex];

      if (alpha === 0) transparentPixels += 1;
      if (alpha < 255) nonOpaquePixels += 1;
      if (alpha < ALPHA_THRESHOLD) continue;

      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
      if (x === 0 || y === 0 || x === info.width - 1 || y === info.height - 1) {
        edgeBleedPixels += 1;
      }
    }
  }

  if (maxX < minX || maxY < minY) {
    return {
      width: info.width,
      height: info.height,
      transparentPixels,
      nonOpaquePixels,
      edgeBleedPixels,
      bounds: null,
    };
  }

  return {
    width: info.width,
    height: info.height,
    transparentPixels,
    nonOpaquePixels,
    edgeBleedPixels,
    bounds: {
      minX,
      minY,
      maxX,
      maxY,
      width: maxX - minX + 1,
      height: maxY - minY + 1,
    },
  };
}

function buildBinaryMask(data, width, height, channels, threshold = ALPHA_THRESHOLD) {
  const mask = new Uint8Array(width * height);

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const alphaIndex = (y * width + x) * channels + 3;
      mask[y * width + x] = data[alphaIndex] >= threshold ? 1 : 0;
    }
  }

  return mask;
}

function erodeMask(mask, width, height, iterations = 1) {
  let current = mask;

  for (let iteration = 0; iteration < iterations; iteration += 1) {
    const next = new Uint8Array(width * height);

    for (let y = 1; y < height - 1; y += 1) {
      for (let x = 1; x < width - 1; x += 1) {
        let keep = 1;

        for (let offsetY = -1; offsetY <= 1 && keep; offsetY += 1) {
          for (let offsetX = -1; offsetX <= 1; offsetX += 1) {
            if (!current[(y + offsetY) * width + (x + offsetX)]) {
              keep = 0;
              break;
            }
          }
        }

        next[y * width + x] = keep;
      }
    }

    current = next;
  }

  return current;
}

function dilateMask(mask, width, height, iterations = 1) {
  let current = mask;

  for (let iteration = 0; iteration < iterations; iteration += 1) {
    const next = new Uint8Array(width * height);

    for (let y = 1; y < height - 1; y += 1) {
      for (let x = 1; x < width - 1; x += 1) {
        let fill = 0;

        for (let offsetY = -1; offsetY <= 1 && !fill; offsetY += 1) {
          for (let offsetX = -1; offsetX <= 1; offsetX += 1) {
            if (current[(y + offsetY) * width + (x + offsetX)]) {
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

function analyzeComponents(mask, width, height) {
  const visited = new Uint8Array(width * height);
  const queue = new Int32Array(width * height);
  let best = null;
  let count = 0;
  let totalArea = 0;

  for (let start = 0; start < mask.length; start += 1) {
    if (!mask[start] || visited[start]) continue;
    count += 1;

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

    const pixels = [];

    while (head < tail) {
      const current = queue[head];
      head += 1;
      pixels.push(current);
      area += 1;

      const x = current % width;
      const y = Math.floor(current / width);
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

    totalArea += area;

    const bboxWidth = maxX - minX + 1;
    const bboxHeight = maxY - minY + 1;
    const bboxArea = Math.max(1, bboxWidth * bboxHeight);
    const compactness = area / bboxArea;
    const centerX = minX + bboxWidth / 2;
    const centerY = minY + bboxHeight / 2;
    const normDx = (centerX - width / 2) / (width / 2);
    const normDy = (centerY - height / 2) / (height / 2);
    const centerDistance = Math.sqrt(normDx * normDx + normDy * normDy);
    const score = area * (1.25 - Math.min(centerDistance, 1)) * (0.75 + compactness);

    if (!best || score > best.score) {
      best = { pixels, score, area };
    }
  }

  return {
    best,
    count,
    totalArea,
  };
}

async function cleanupSubjectMask(input) {
  const { data, info } = await sharp(input)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const originalMask = buildBinaryMask(data, info.width, info.height, info.channels);
  const originalAnalysis = analyzeComponents(originalMask, info.width, info.height);

  if (!originalAnalysis.best) {
    return sharp(input).ensureAlpha().png().toBuffer();
  }

  let chosenComponent = originalAnalysis.best;

  if (originalAnalysis.count === 1) {
    const openedMask = dilateMask(
      erodeMask(originalMask, info.width, info.height, 1),
      info.width,
      info.height,
      1,
    );
    const openedAnalysis = analyzeComponents(openedMask, info.width, info.height);

    if (
      openedAnalysis.best
      && originalAnalysis.totalArea > 0
      && openedAnalysis.best.area / originalAnalysis.totalArea >= 0.45
    ) {
      chosenComponent = openedAnalysis.best;
    }
  }

  const subjectMask = new Uint8Array(info.width * info.height);
  for (const pixelIndex of chosenComponent.pixels) {
    subjectMask[pixelIndex] = 1;
  }

  const expandedMask = dilateMask(subjectMask, info.width, info.height, 2);

  for (let y = 0; y < info.height; y += 1) {
    for (let x = 0; x < info.width; x += 1) {
      const pixelIndex = y * info.width + x;
      const alphaIndex = pixelIndex * info.channels + 3;
      if (!expandedMask[pixelIndex]) {
        data[alphaIndex] = 0;
      }
    }
  }

  return sharp(data, {
    raw: {
      width: info.width,
      height: info.height,
      channels: info.channels,
    },
  })
    .png()
    .toBuffer();
}

function scoreIsolationCandidate(stats) {
  if (!stats.bounds) return Number.NEGATIVE_INFINITY;

  const totalPixels = stats.width * stats.height;
  const transparentRatio = totalPixels > 0 ? stats.transparentPixels / totalPixels : 0;
  const subjectAreaRatio = totalPixels > 0
    ? (stats.bounds.width * stats.bounds.height) / totalPixels
    : 0;
  const subjectWidthRatio = stats.bounds.width / Math.max(stats.width, 1);
  const subjectHeightRatio = stats.bounds.height / Math.max(stats.height, 1);
  const subjectCenterY = (stats.bounds.minY + stats.bounds.maxY + 1) / (2 * Math.max(stats.height, 1));
  const margin = Math.min(
    stats.bounds.minX,
    stats.bounds.minY,
    stats.width - 1 - stats.bounds.maxX,
    stats.height - 1 - stats.bounds.maxY,
  );
  const transparencyPenalty = transparentRatio < 0.08 ? (0.08 - transparentRatio) * 12 : 0;
  const heightPenalty = subjectHeightRatio < 0.45 ? (0.45 - subjectHeightRatio) * 8 : 0;
  const centerPenalty = Math.abs(subjectCenterY - 0.5) * 2.5;

  return (
    transparentRatio * 2.5
    + subjectAreaRatio * 2
    + Math.min(subjectWidthRatio, 1)
    + Math.min(subjectHeightRatio, 1)
    + Math.max(0, margin / Math.max(stats.width, stats.height))
    - transparencyPenalty
    - heightPenalty
    - centerPenalty
    - stats.edgeBleedPixels * 0.02
  );
}

async function isolatePortraitSource(input) {
  const originalBuffer = await toPngBuffer(input);
  const candidates = [];

  const pushCandidate = async (label, bufferPromise) => {
    try {
      const cleaned = await cleanupSubjectMask(await bufferPromise);
      const stats = await getAlphaBounds(cleaned);
      candidates.push({
        label,
        buffer: cleaned,
        stats,
        score: scoreIsolationCandidate(stats),
      });
    } catch {
      // Ignore failed candidate and fall through to the others.
    }
  };

  await pushCandidate("original", Promise.resolve(originalBuffer));
  await pushCandidate("border-flood", borderFloodTransparent(originalBuffer));
  await pushCandidate("flat-key", keyFlatBackgroundTransparent(originalBuffer));

  const best = candidates.sort((left, right) => right.score - left.score)[0];
  return best?.buffer ?? originalBuffer;
}

async function polishPortraitBuffer(input) {
  const polishedBuffer = await sharp(input)
    .ensureAlpha()
    .modulate({
      brightness: 1.03,
      saturation: 1.08,
    })
    .linear(1.02, -2)
    .sharpen({
      sigma: 0.95,
      m1: 0.6,
      m2: 1.8,
      x1: 2,
      y2: 8,
      y3: 14,
    })
    .png()
    .toBuffer();

  const metadata = await sharp(polishedBuffer).metadata();
  const width = metadata.width ?? 0;
  const height = metadata.height ?? 0;

  const glowBuffer = await sharp(polishedBuffer)
    .ensureAlpha()
    .blur(8)
    .modulate({
      brightness: 1.04,
      saturation: 1.08,
    })
    .png()
    .toBuffer();

  return sharp({
    create: {
      width,
      height,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite([
      { input: glowBuffer, blend: "screen", opacity: 0.12 },
      { input: polishedBuffer },
    ])
    .png()
    .toBuffer();
}

export async function buildPortraitAssetBuffer(input, options = {}) {
  const {
    canvasSize = DEFAULT_PORTRAIT_CANVAS_SIZE,
    subjectScale = 0.82,
    minPaddingPx = Math.round(canvasSize * 0.06),
    verticalLiftPx = Math.round(canvasSize * 0.03),
  } = options;

  const isolatedBuffer = await isolatePortraitSource(input);
  const polishedBuffer = await polishPortraitBuffer(isolatedBuffer);
  const polishedStats = await getAlphaBounds(polishedBuffer);

  if (!polishedStats.bounds) {
    throw new Error("Unable to locate a visible portrait subject after isolation.");
  }

  const subject = polishedStats.bounds;
  const croppedBuffer = await sharp(polishedBuffer)
    .extract({
      left: subject.minX,
      top: subject.minY,
      width: subject.width,
      height: subject.height,
    })
    .png()
    .toBuffer();

  const maxContentSize = Math.max(1, Math.round(canvasSize * subjectScale));
  const fittedBuffer = await sharp(croppedBuffer)
    .resize(maxContentSize, maxContentSize, {
      fit: "inside",
      withoutEnlargement: false,
    })
    .png()
    .toBuffer();

  const fittedMetadata = await sharp(fittedBuffer).metadata();
  const fittedWidth = fittedMetadata.width ?? maxContentSize;
  const fittedHeight = fittedMetadata.height ?? maxContentSize;
  const left = Math.max(minPaddingPx, Math.round((canvasSize - fittedWidth) / 2));
  const idealTop = Math.round((canvasSize - fittedHeight) / 2) - verticalLiftPx;
  const top = Math.max(
    minPaddingPx,
    Math.min(canvasSize - minPaddingPx - fittedHeight, idealTop),
  );

  return sharp({
    create: {
      width: canvasSize,
      height: canvasSize,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite([
      {
        input: fittedBuffer,
        left,
        top,
      },
    ])
    .png()
    .toBuffer();
}

export async function validatePortraitAsset(input, options = {}) {
  const {
    minTransparentRatio = 0.08,
    minMarginPx = 16,
    maxEdgeBleedPixels = 0,
  } = options;
  const stats = await getAlphaBounds(input);
  const errors = [];

  if (stats.width !== stats.height) {
    errors.push(`Portrait output must be square, received ${stats.width}x${stats.height}.`);
  }

  const totalPixels = stats.width * stats.height;
  const transparentRatio = totalPixels > 0 ? stats.transparentPixels / totalPixels : 0;

  if (transparentRatio < minTransparentRatio || stats.nonOpaquePixels === 0) {
    errors.push("Portrait output must retain transparent background padding.");
  }

  if (!stats.bounds) {
    errors.push("Portrait output has no visible subject bounds.");
    return { ...stats, errors };
  }

  const margins = {
    left: stats.bounds.minX,
    top: stats.bounds.minY,
    right: stats.width - 1 - stats.bounds.maxX,
    bottom: stats.height - 1 - stats.bounds.maxY,
  };

  if (Object.values(margins).some((margin) => margin < minMarginPx)) {
    errors.push(
      `Portrait subject is too close to the frame (${JSON.stringify(margins)}).`,
    );
  }

  if (stats.edgeBleedPixels > maxEdgeBleedPixels) {
    errors.push(`Portrait subject touches the outer frame (${stats.edgeBleedPixels} edge pixels).`);
  }

  return {
    ...stats,
    margins,
    errors,
  };
}

export async function processPortraitFile({
  inputPath,
  outputPath = inputPath,
  canvasSize = DEFAULT_PORTRAIT_CANVAS_SIZE,
  validation = {},
} = {}) {
  const outputBuffer = await buildPortraitAssetBuffer(inputPath, { canvasSize });
  const result = await validatePortraitAsset(outputBuffer, validation);

  if (result.errors.length > 0) {
    throw new Error(`${path.basename(inputPath)} failed portrait validation: ${result.errors.join(" ")}`);
  }

  ensureDir(path.dirname(outputPath));
  fs.writeFileSync(outputPath, outputBuffer);

  return {
    inputPath,
    outputPath,
    ...result,
  };
}

export function getSliceBounds(total, segments, index) {
  const start = Math.round((total * index) / segments);
  const end = Math.round((total * (index + 1)) / segments);

  return {
    start,
    size: end - start,
  };
}

export async function extractPanelBuffer({
  sourcePath,
  width,
  height,
  row,
  column,
  columns = DEFAULT_PORTRAIT_COLUMNS,
  rows = DEFAULT_PORTRAIT_ROWS,
}) {
  const xBounds = getSliceBounds(width, columns, column);
  const yBounds = getSliceBounds(height, rows, row);

  return sharp(sourcePath)
    .extract({
      left: xBounds.start,
      top: yBounds.start,
      width: xBounds.size,
      height: yBounds.size,
    })
    .png()
    .toBuffer();
}

export async function processSheetPanel({
  sourcePath,
  width,
  height,
  row,
  column,
  outputPath,
  canvasSize = DEFAULT_PORTRAIT_CANVAS_SIZE,
  validation = {},
  columns = DEFAULT_PORTRAIT_COLUMNS,
  rows = DEFAULT_PORTRAIT_ROWS,
}) {
  const panelBuffer = await extractPanelBuffer({
    sourcePath,
    width,
    height,
    row,
    column,
    columns,
    rows,
  });

  const outputBuffer = await buildPortraitAssetBuffer(panelBuffer, { canvasSize });
  const result = await validatePortraitAsset(outputBuffer, validation);

  if (result.errors.length > 0) {
    throw new Error(`${path.basename(outputPath)} failed portrait validation: ${result.errors.join(" ")}`);
  }

  ensureDir(path.dirname(outputPath));
  fs.writeFileSync(outputPath, outputBuffer);

  return {
    outputPath,
    row,
    column,
    ...result,
  };
}

function walk(dirPath) {
  return fs.readdirSync(dirPath, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) return walk(entryPath);
    return [entryPath];
  });
}

export function listPortraitAssetFiles(rootDir) {
  if (!fs.existsSync(rootDir)) return [];
  return walk(rootDir)
    .filter((filePath) => filePath.endsWith(".png"))
    .sort((left, right) => left.localeCompare(right));
}
