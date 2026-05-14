import { Image, decode } from "https://deno.land/x/imagescript@1.2.17/mod.ts";

const ALPHA_TRANSPARENT_THRESHOLD = 10;
const ALPHA_SUBJECT_THRESHOLD = 24;
const MIN_TRANSPARENT_RATIO = 0.08;
const MIN_BORDER_TRANSPARENT_RATIO = 0.82;
const MIN_SUBJECT_RATIO = 0.01;
const MAX_SUBJECT_RATIO = 0.82;
const MIN_BOUNDS_RATIO = 0.08;
const MAX_FULL_CANVAS_BOUNDS_RATIO = 0.94;
const NORMALIZED_PADDING_RATIO = 0.16;
const MIN_NORMALIZED_EDGE_PX = 64;
const MAX_NORMALIZED_EDGE_PX = 1024;

export interface CompanionLauncherCutoutBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface CompanionLauncherAlphaStats {
  width: number;
  height: number;
  transparentPixelRatio: number;
  opaquePixelRatio: number;
  subjectPixelRatio: number;
  borderTransparentPixelRatio: number;
  bounds: CompanionLauncherCutoutBounds;
}

export interface NormalizedCompanionLauncherCutout {
  pngBytes: Uint8Array;
  alphaStats: CompanionLauncherAlphaStats;
}

export class CompanionLauncherCutoutValidationError extends Error {
  readonly reason: string;
  readonly alphaStats?: CompanionLauncherAlphaStats;

  constructor(
    reason: string,
    message: string,
    alphaStats?: CompanionLauncherAlphaStats,
  ) {
    super(message);
    this.name = "CompanionLauncherCutoutValidationError";
    this.reason = reason;
    this.alphaStats = alphaStats;
  }
}

interface DecodedImage {
  width: number;
  height: number;
  bitmap: Uint8ClampedArray;
  clone(): DecodedImage;
  crop(x: number, y: number, width: number, height: number): DecodedImage;
  composite(source: DecodedImage, x?: number, y?: number): DecodedImage;
  fill(color: number): DecodedImage;
  resize(width: number, height: number, mode?: string): DecodedImage;
  encode(compression?: number): Promise<Uint8Array>;
}

const roundRatio = (value: number): number => Math.round(value * 10000) / 10000;

const asDecodedImage = (value: unknown): DecodedImage => {
  const candidate = value as Partial<DecodedImage> | null;
  if (
    !candidate ||
    typeof candidate.width !== "number" ||
    typeof candidate.height !== "number" ||
    !(candidate.bitmap instanceof Uint8ClampedArray)
  ) {
    throw new CompanionLauncherCutoutValidationError(
      "decode_failed",
      "PhotoRoom cutout could not be decoded as an image",
    );
  }

  return candidate as DecodedImage;
};

const decodeCutoutImage = async (pngBytes: Uint8Array): Promise<DecodedImage> => {
  try {
    return asDecodedImage(await decode(pngBytes, true));
  } catch (error) {
    if (error instanceof CompanionLauncherCutoutValidationError) {
      throw error;
    }
    throw new CompanionLauncherCutoutValidationError(
      "decode_failed",
      "PhotoRoom cutout could not be decoded as a PNG",
    );
  }
};

const analyzeImageAlpha = (image: DecodedImage): CompanionLauncherAlphaStats => {
  const { width, height, bitmap } = image;
  const totalPixels = width * height;
  if (
    width < MIN_NORMALIZED_EDGE_PX / 2 ||
    height < MIN_NORMALIZED_EDGE_PX / 2 ||
    bitmap.length < totalPixels * 4
  ) {
    throw new CompanionLauncherCutoutValidationError(
      "invalid_canvas",
      "PhotoRoom cutout canvas is too small or malformed",
    );
  }

  const borderSize = Math.max(1, Math.floor(Math.min(width, height) * 0.04));
  let transparentPixels = 0;
  let opaquePixels = 0;
  let subjectPixels = 0;
  let borderPixels = 0;
  let transparentBorderPixels = 0;
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const alpha = bitmap[((y * width + x) * 4) + 3] ?? 255;
      const isTransparent = alpha <= ALPHA_TRANSPARENT_THRESHOLD;
      const isSubject = alpha > ALPHA_SUBJECT_THRESHOLD;

      if (isTransparent) transparentPixels += 1;
      if (alpha >= 240) opaquePixels += 1;
      if (isSubject) {
        subjectPixels += 1;
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x);
        maxY = Math.max(maxY, y);
      }

      if (
        x < borderSize ||
        y < borderSize ||
        x >= width - borderSize ||
        y >= height - borderSize
      ) {
        borderPixels += 1;
        if (isTransparent) transparentBorderPixels += 1;
      }
    }
  }

  if (subjectPixels === 0 || maxX < minX || maxY < minY) {
    throw new CompanionLauncherCutoutValidationError(
      "empty_mask",
      "PhotoRoom cutout did not contain an opaque subject",
    );
  }

  return {
    width,
    height,
    transparentPixelRatio: roundRatio(transparentPixels / totalPixels),
    opaquePixelRatio: roundRatio(opaquePixels / totalPixels),
    subjectPixelRatio: roundRatio(subjectPixels / totalPixels),
    borderTransparentPixelRatio: roundRatio(
      transparentBorderPixels / Math.max(1, borderPixels),
    ),
    bounds: {
      x: minX,
      y: minY,
      width: maxX - minX + 1,
      height: maxY - minY + 1,
    },
  };
};

const validateAlphaStats = (stats: CompanionLauncherAlphaStats): void => {
  const boundsWidthRatio = stats.bounds.width / stats.width;
  const boundsHeightRatio = stats.bounds.height / stats.height;

  if (stats.transparentPixelRatio < MIN_TRANSPARENT_RATIO) {
    throw new CompanionLauncherCutoutValidationError(
      "missing_alpha",
      "PhotoRoom cutout does not contain enough transparent pixels",
      stats,
    );
  }

  if (stats.borderTransparentPixelRatio < MIN_BORDER_TRANSPARENT_RATIO) {
    throw new CompanionLauncherCutoutValidationError(
      "opaque_borders",
      "PhotoRoom cutout borders are not mostly transparent",
      stats,
    );
  }

  if (stats.subjectPixelRatio < MIN_SUBJECT_RATIO) {
    throw new CompanionLauncherCutoutValidationError(
      "tiny_subject",
      "PhotoRoom cutout subject is too small",
      stats,
    );
  }

  if (stats.subjectPixelRatio > MAX_SUBJECT_RATIO) {
    throw new CompanionLauncherCutoutValidationError(
      "opaque_rectangle",
      "PhotoRoom cutout looks like an opaque rectangle",
      stats,
    );
  }

  if (
    boundsWidthRatio < MIN_BOUNDS_RATIO ||
    boundsHeightRatio < MIN_BOUNDS_RATIO
  ) {
    throw new CompanionLauncherCutoutValidationError(
      "tiny_subject_bounds",
      "PhotoRoom cutout subject bounds are too small",
      stats,
    );
  }

  if (
    boundsWidthRatio > MAX_FULL_CANVAS_BOUNDS_RATIO &&
    boundsHeightRatio > MAX_FULL_CANVAS_BOUNDS_RATIO
  ) {
    throw new CompanionLauncherCutoutValidationError(
      "full_canvas_subject",
      "PhotoRoom cutout subject fills the canvas",
      stats,
    );
  }
};

const validateImageAlpha = (image: DecodedImage): CompanionLauncherAlphaStats => {
  const stats = analyzeImageAlpha(image);
  validateAlphaStats(stats);
  return stats;
};

export const validateAndNormalizeCompanionLauncherCutout = async (
  pngBytes: Uint8Array,
): Promise<NormalizedCompanionLauncherCutout> => {
  const sourceImage = await decodeCutoutImage(pngBytes);
  const sourceStats = validateImageAlpha(sourceImage);
  const longestSubjectEdge = Math.max(
    sourceStats.bounds.width,
    sourceStats.bounds.height,
  );
  const padding = Math.max(
    1,
    Math.round(longestSubjectEdge * NORMALIZED_PADDING_RATIO),
  );
  let squareSize = Math.max(
    MIN_NORMALIZED_EDGE_PX,
    longestSubjectEdge + (padding * 2),
  );
  const centerX = sourceStats.bounds.x + (sourceStats.bounds.width / 2);
  const centerY = sourceStats.bounds.y + (sourceStats.bounds.height / 2);
  const cropLeft = Math.floor(centerX - (squareSize / 2));
  const cropTop = Math.floor(centerY - (squareSize / 2));
  const sourceLeft = Math.max(0, cropLeft);
  const sourceTop = Math.max(0, cropTop);
  const sourceRight = Math.min(sourceImage.width, cropLeft + squareSize);
  const sourceBottom = Math.min(sourceImage.height, cropTop + squareSize);
  const cropWidth = Math.max(1, sourceRight - sourceLeft);
  const cropHeight = Math.max(1, sourceBottom - sourceTop);
  const croppedSource = sourceImage.clone().crop(
    sourceLeft,
    sourceTop,
    cropWidth,
    cropHeight,
  );
  const output = new Image(squareSize, squareSize) as DecodedImage;

  output.fill(0x00000000);
  output.composite(croppedSource, sourceLeft - cropLeft, sourceTop - cropTop);

  if (squareSize > MAX_NORMALIZED_EDGE_PX) {
    output.resize(MAX_NORMALIZED_EDGE_PX, MAX_NORMALIZED_EDGE_PX);
    squareSize = MAX_NORMALIZED_EDGE_PX;
  }

  const normalizedStats = validateImageAlpha(output);
  const normalizedBytes = await output.encode(1);

  return {
    pngBytes: normalizedBytes,
    alphaStats: normalizedStats,
  };
};
