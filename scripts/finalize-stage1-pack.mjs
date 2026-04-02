import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";

const FILE_MAP = [
  { source: "Stage1Dragon.png", target: "dragonstage1.png", mode: "checker" },
  { source: "stage1wolf.png", target: "wolfstage1.png", mode: "checker" },
  { source: "stage1kitsune.png", target: "kitsunestage1.png", mode: "copy" },
  { source: "stage1owl.png", target: "owlstage1.png", mode: "dark" },
  { source: "stage1lion.png", target: "lionstage1.png", mode: "dark" },
  { source: "stage1phoenix.png", target: "phoenixstage1.png", mode: "copy" },
  { source: "stage1pegasus.png", target: "pegasusstage1.png", mode: "dark" },
  { source: "Stage1Griffin.png", target: "griffinstage1.png", mode: "copy" },
  { source: "stage1sphinx.png", target: "sphinxstage1.png", mode: "light" },
  { source: "stage1leviathan.png", target: "leviathanstage1.png", mode: "copy" },
  { source: "stage1mechanicaldragon.png", target: "mechanicaldragonstage1.png", mode: "checker" },
  { source: "stage1tanuki.png", target: "tanukistage1.png", mode: "checker" },
  { source: "Stage1Buttercat.png", target: "buttercatstage1.png", mode: "dark" },
];

const DEFAULT_SOURCE_DIR = "/Users/macbookair/Documents/Stage 1";
const BORDER_SAMPLE_STEP = 6;
const CHECKER_PROFILE = {
  blurSigma: 8,
  edgeThreshold: 28,
  absBorderTolerance: 56,
  stepTolerance: 22,
  borderToleranceExtra: 24,
  maskBlurSigma: 1.1,
};
const DARK_PROFILE = {
  blurSigma: 6,
  edgeThreshold: 24,
  absBorderTolerance: 26,
  stepTolerance: 16,
  borderToleranceExtra: 14,
  maskBlurSigma: 0.9,
};
const LIGHT_PROFILE = {
  blurSigma: 6,
  edgeThreshold: 24,
  absBorderTolerance: 28,
  stepTolerance: 16,
  borderToleranceExtra: 14,
  maskBlurSigma: 0.9,
};

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

  const compare = (nx, ny) => {
    if (nx < 0 || nx >= width || ny < 0 || ny >= height) return;
    const other = rgbaIndex(nx, ny, width);
    const delta = colorDistance(buffer, center, other);
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

function clampChannel(value) {
  return Math.max(0, Math.min(255, Math.round(value)));
}

async function borderFloodTransparent(input, profile) {
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

async function renderFinalBuffer(sourcePath, mode) {
  switch (mode) {
    case "copy":
      return fs.readFileSync(sourcePath);
    case "checker":
      return borderFloodTransparent(sourcePath, CHECKER_PROFILE);
    case "dark":
      return borderFloodTransparent(sourcePath, DARK_PROFILE);
    case "light":
      return borderFloodTransparent(sourcePath, LIGHT_PROFILE);
    default:
      throw new Error(`Unsupported mode: ${mode}`);
  }
}

async function computeImageStats(inputPath) {
  const { data, info } = await sharp(inputPath).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  let nonOpaque = 0;
  let transparent = 0;
  for (let index = 3; index < data.length; index += 4) {
    const alpha = data[index];
    if (alpha < 255) nonOpaque += 1;
    if (alpha === 0) transparent += 1;
  }
  return {
    width: info.width,
    height: info.height,
    hasAlpha: nonOpaque > 0,
    nonOpaque,
    transparent,
  };
}

function svgLabelMarkup(text, width, height) {
  return Buffer.from(`
    <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      <rect width="100%" height="100%" rx="12" ry="12" fill="rgba(15,23,42,0.92)" />
      <text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle"
        fill="#f8fafc" font-family="Arial, Helvetica, sans-serif" font-size="20" font-weight="700">${text}</text>
    </svg>
  `);
}

function checkerboardSvg(width, height, size = 24) {
  return Buffer.from(`
    <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <pattern id="checker" width="${size}" height="${size}" patternUnits="userSpaceOnUse">
          <rect width="${size}" height="${size}" fill="#f3f4f6" />
          <rect width="${size / 2}" height="${size / 2}" fill="#d1d5db" />
          <rect x="${size / 2}" y="${size / 2}" width="${size / 2}" height="${size / 2}" fill="#d1d5db" />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#checker)" />
    </svg>
  `);
}

async function renderPreview(files, outputPath) {
  const thumbWidth = 220;
  const thumbHeight = 220;
  const labelHeight = 34;
  const gutter = 20;
  const panelGap = 32;
  const cols = 3;
  const rows = Math.ceil(files.length / cols);
  const panelWidth = cols * thumbWidth + (cols + 1) * gutter;
  const panelHeight = rows * (thumbHeight + labelHeight) + (rows + 1) * gutter + 72;
  const width = panelWidth * 2 + panelGap + 40;
  const height = panelHeight;

  const composites = [
    {
      input: Buffer.from(`
        <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
          <rect width="100%" height="100%" fill="#020617" />
          <rect x="20" y="64" width="${panelWidth}" height="${panelHeight - 84}" rx="18" ry="18" fill="#ffffff" />
          <rect x="${20 + panelWidth + panelGap}" y="64" width="${panelWidth}" height="${panelHeight - 84}" rx="18" ry="18" fill="#020617" />
          <text x="${20 + panelWidth / 2}" y="42" fill="#e2e8f0" font-family="Arial, Helvetica, sans-serif" font-size="28" font-weight="700" text-anchor="middle">Light Background</text>
          <text x="${20 + panelWidth + panelGap + panelWidth / 2}" y="42" fill="#e2e8f0" font-family="Arial, Helvetica, sans-serif" font-size="28" font-weight="700" text-anchor="middle">Dark Background</text>
        </svg>
      `),
      left: 0,
      top: 0,
    },
  ];

  for (let index = 0; index < files.length; index += 1) {
    const filePath = files[index];
    const column = index % cols;
    const row = Math.floor(index / cols);
    const innerLeft = gutter + column * (thumbWidth + gutter);
    const top = 76 + gutter + row * (thumbHeight + labelHeight + gutter);

    const resized = await sharp(filePath)
      .resize(thumbWidth, thumbHeight, { fit: "contain" })
      .png()
      .toBuffer();

    const checkerThumb = await sharp(checkerboardSvg(thumbWidth, thumbHeight))
      .composite([{ input: resized }])
      .png()
      .toBuffer();

    const darkThumb = await sharp({
      create: {
        width: thumbWidth,
        height: thumbHeight,
        channels: 4,
        background: "#020617",
      },
    })
      .composite([{ input: resized }])
      .png()
      .toBuffer();

    composites.push({
      input: checkerThumb,
      left: 20 + innerLeft,
      top,
    });
    composites.push({
      input: svgLabelMarkup(path.basename(filePath), thumbWidth, labelHeight),
      left: 20 + innerLeft,
      top: top + thumbHeight,
    });

    composites.push({
      input: darkThumb,
      left: 20 + panelWidth + panelGap + innerLeft,
      top,
    });
    composites.push({
      input: svgLabelMarkup(path.basename(filePath), thumbWidth, labelHeight),
      left: 20 + panelWidth + panelGap + innerLeft,
      top: top + thumbHeight,
    });
  }

  await sharp({
    create: {
      width,
      height,
      channels: 4,
      background: "#020617",
    },
  })
    .composite(composites)
    .png()
    .toFile(outputPath);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const sourceDir = args.source ?? DEFAULT_SOURCE_DIR;
  const outputDir = args.output ?? sourceDir;
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const backupDir = args.backup ?? path.join(sourceDir, `_backup_${timestamp}`);
  const qaDir = args.qa ?? path.join(outputDir, "_qa");
  const replaceRoot = args["replace-root"] === "true" || args["replace-root"] === "1";

  ensureDir(outputDir);
  ensureDir(backupDir);
  ensureDir(qaDir);

  const finalFiles = [];
  const summary = [];

  for (const mapping of FILE_MAP) {
    const sourcePath = path.join(sourceDir, mapping.source);
    if (!fs.existsSync(sourcePath)) {
      throw new Error(`Missing source file: ${sourcePath}`);
    }

    const backupPath = path.join(backupDir, mapping.source);
    if (!fs.existsSync(backupPath)) {
      fs.copyFileSync(sourcePath, backupPath);
    }

    const outputPath = path.join(outputDir, mapping.target);
    const finalBuffer = await renderFinalBuffer(sourcePath, mapping.mode);
    await sharp(finalBuffer).png().toFile(outputPath);

    if (replaceRoot && sourceDir === outputDir) {
      const finalSourcePath = path.join(sourceDir, mapping.source);
      if (fs.existsSync(finalSourcePath) && finalSourcePath !== outputPath) {
        fs.unlinkSync(finalSourcePath);
      }
    }

    const stats = await computeImageStats(outputPath);
    finalFiles.push(outputPath);
    summary.push({
      source: mapping.source,
      target: mapping.target,
      mode: mapping.mode,
      width: stats.width,
      height: stats.height,
      hasAlpha: stats.hasAlpha,
      transparentPixels: stats.transparent,
      nonOpaquePixels: stats.nonOpaque,
    });
  }

  await renderPreview(finalFiles, path.join(qaDir, "stage1_final_dark_light.png"));
  fs.writeFileSync(path.join(qaDir, "stage1_final_summary.json"), `${JSON.stringify(summary, null, 2)}\n`);

  console.log(JSON.stringify({
    sourceDir,
    outputDir,
    backupDir,
    qaDir,
    replaceRoot,
    finalizedFiles: summary.map((entry) => entry.target),
  }, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack || error.message : error);
  process.exit(1);
});
