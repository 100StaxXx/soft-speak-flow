export interface CompanionImagePixels {
  data: Uint8ClampedArray;
  width: number;
  height: number;
}

export interface CompanionImageBackgroundRemovalResult extends CompanionImagePixels {
  removedPixels: number;
}

const BORDER_LIGHT_MIN_AVERAGE = 226;
const BORDER_LIGHT_MIN_CHANNEL = 210;
const BORDER_LIGHT_MAX_SPREAD = 32;
const BACKGROUND_DISTANCE_THRESHOLD = 76;
const EDGE_SOFTEN_DISTANCE_THRESHOLD = 102;

const getPixelOffset = (pixelIndex: number) => pixelIndex * 4;

const clampChannel = (value: number) => Math.max(0, Math.min(255, Math.round(value)));

const getColorDistance = (
  data: Uint8ClampedArray,
  pixelIndex: number,
  backgroundColor: readonly [number, number, number],
) => {
  const offset = getPixelOffset(pixelIndex);
  const redDelta = data[offset] - backgroundColor[0];
  const greenDelta = data[offset + 1] - backgroundColor[1];
  const blueDelta = data[offset + 2] - backgroundColor[2];
  return Math.sqrt((redDelta * redDelta) + (greenDelta * greenDelta) + (blueDelta * blueDelta));
};

export const isLightCompanionImageBackgroundPixel = (
  red: number,
  green: number,
  blue: number,
  alpha = 255,
) => {
  if (alpha < 24) return false;

  const maxChannel = Math.max(red, green, blue);
  const minChannel = Math.min(red, green, blue);
  const average = (red + green + blue) / 3;
  const spread = maxChannel - minChannel;

  return average >= BORDER_LIGHT_MIN_AVERAGE
    && minChannel >= BORDER_LIGHT_MIN_CHANNEL
    && spread <= BORDER_LIGHT_MAX_SPREAD;
};

const isLightPixelAt = (data: Uint8ClampedArray, pixelIndex: number) => {
  const offset = getPixelOffset(pixelIndex);
  return isLightCompanionImageBackgroundPixel(
    data[offset],
    data[offset + 1],
    data[offset + 2],
    data[offset + 3],
  );
};

const estimateLightBorderColor = ({
  data,
  width,
  height,
}: CompanionImagePixels): [number, number, number] | null => {
  let redTotal = 0;
  let greenTotal = 0;
  let blueTotal = 0;
  let sampleCount = 0;

  const collect = (pixelIndex: number) => {
    if (!isLightPixelAt(data, pixelIndex)) return;

    const offset = getPixelOffset(pixelIndex);
    redTotal += data[offset];
    greenTotal += data[offset + 1];
    blueTotal += data[offset + 2];
    sampleCount += 1;
  };

  for (let x = 0; x < width; x += 1) {
    collect(x);
    collect(((height - 1) * width) + x);
  }

  for (let y = 1; y < height - 1; y += 1) {
    collect(y * width);
    collect((y * width) + width - 1);
  }

  if (sampleCount === 0) return null;

  return [
    redTotal / sampleCount,
    greenTotal / sampleCount,
    blueTotal / sampleCount,
  ];
};

const matchesBorderBackground = (
  data: Uint8ClampedArray,
  pixelIndex: number,
  backgroundColor: readonly [number, number, number],
) => {
  if (!isLightPixelAt(data, pixelIndex)) return false;
  return getColorDistance(data, pixelIndex, backgroundColor) <= BACKGROUND_DISTANCE_THRESHOLD;
};

const hasRemovedNeighbor = (
  mask: Uint8Array,
  x: number,
  y: number,
  width: number,
  height: number,
) => (
  (x > 0 && mask[(y * width) + x - 1] === 1)
  || (x < width - 1 && mask[(y * width) + x + 1] === 1)
  || (y > 0 && mask[((y - 1) * width) + x] === 1)
  || (y < height - 1 && mask[((y + 1) * width) + x] === 1)
);

const despillLightBackground = (
  data: Uint8ClampedArray,
  offset: number,
  alpha: number,
  backgroundColor: readonly [number, number, number],
) => {
  if (alpha <= 0 || alpha >= 255) return;

  const alphaRatio = alpha / 255;
  data[offset] = clampChannel((data[offset] - (backgroundColor[0] * (1 - alphaRatio))) / alphaRatio);
  data[offset + 1] = clampChannel((data[offset + 1] - (backgroundColor[1] * (1 - alphaRatio))) / alphaRatio);
  data[offset + 2] = clampChannel((data[offset + 2] - (backgroundColor[2] * (1 - alphaRatio))) / alphaRatio);
};

export const removeLightBorderBackgroundFromCompanionImage = ({
  data,
  width,
  height,
}: CompanionImagePixels): CompanionImageBackgroundRemovalResult => {
  const output = new Uint8ClampedArray(data);
  const totalPixels = width * height;
  const backgroundColor = estimateLightBorderColor({ data: output, width, height });

  if (!backgroundColor || width <= 0 || height <= 0 || totalPixels <= 0) {
    return { data: output, width, height, removedPixels: 0 };
  }

  const backgroundMask = new Uint8Array(totalPixels);
  const queue = new Int32Array(totalPixels);
  let head = 0;
  let tail = 0;

  const enqueue = (pixelIndex: number) => {
    if (backgroundMask[pixelIndex] === 1) return;
    if (!matchesBorderBackground(output, pixelIndex, backgroundColor)) return;

    backgroundMask[pixelIndex] = 1;
    queue[tail] = pixelIndex;
    tail += 1;
  };

  for (let x = 0; x < width; x += 1) {
    enqueue(x);
    enqueue(((height - 1) * width) + x);
  }

  for (let y = 1; y < height - 1; y += 1) {
    enqueue(y * width);
    enqueue((y * width) + width - 1);
  }

  while (head < tail) {
    const pixelIndex = queue[head];
    head += 1;

    const x = pixelIndex % width;
    const y = Math.floor(pixelIndex / width);

    if (x > 0) enqueue(pixelIndex - 1);
    if (x < width - 1) enqueue(pixelIndex + 1);
    if (y > 0) enqueue(pixelIndex - width);
    if (y < height - 1) enqueue(pixelIndex + width);
  }

  for (let pixelIndex = 0; pixelIndex < totalPixels; pixelIndex += 1) {
    const offset = getPixelOffset(pixelIndex);

    if (backgroundMask[pixelIndex] === 1) {
      output[offset + 3] = 0;
      continue;
    }

    const x = pixelIndex % width;
    const y = Math.floor(pixelIndex / width);
    if (!hasRemovedNeighbor(backgroundMask, x, y, width, height)) continue;

    const distance = getColorDistance(output, pixelIndex, backgroundColor);
    if (distance >= EDGE_SOFTEN_DISTANCE_THRESHOLD) continue;

    const currentAlpha = output[offset + 3];
    const softenedAlpha = clampChannel(
      ((distance - BACKGROUND_DISTANCE_THRESHOLD) / (EDGE_SOFTEN_DISTANCE_THRESHOLD - BACKGROUND_DISTANCE_THRESHOLD)) * 255,
    );
    const nextAlpha = Math.min(currentAlpha, Math.max(0, softenedAlpha));
    output[offset + 3] = nextAlpha;
    despillLightBackground(output, offset, nextAlpha, backgroundColor);
  }

  return {
    data: output,
    width,
    height,
    removedPixels: tail,
  };
};

export const removeLightBorderBackgroundFromCompanionImageData = (
  imageData: ImageData,
): { imageData: ImageData; removedPixels: number } => {
  const result = removeLightBorderBackgroundFromCompanionImage({
    data: imageData.data,
    width: imageData.width,
    height: imageData.height,
  });

  return {
    imageData: new ImageData(result.data, result.width, result.height),
    removedPixels: result.removedPixels,
  };
};
