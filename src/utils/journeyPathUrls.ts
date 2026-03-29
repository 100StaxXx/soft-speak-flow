export interface JourneyPathRenderOptions {
  width?: number;
  height?: number;
  resize?: "cover" | "contain" | "fill";
  quality?: number;
}

const JOURNEY_PATH_PUBLIC_SEGMENT = "/storage/v1/object/public/journey-paths/";
const JOURNEY_PATH_RENDER_SEGMENT = "/storage/v1/render/image/public/journey-paths/";

const toPositiveInteger = (value: number | undefined) => {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
    return null;
  }

  return Math.round(value);
};

const toQuality = (value: number | undefined) => {
  const normalized = toPositiveInteger(value);
  if (normalized === null) return null;
  return Math.min(100, Math.max(20, normalized));
};

export const getJourneyPathRenderUrl = (
  imageUrl: string | null | undefined,
  options: JourneyPathRenderOptions = {},
) => {
  if (typeof imageUrl !== "string" || imageUrl.trim().length === 0) {
    return null;
  }

  try {
    const url = new URL(imageUrl);
    const publicPathIndex = url.pathname.indexOf(JOURNEY_PATH_PUBLIC_SEGMENT);
    const renderPathIndex = url.pathname.indexOf(JOURNEY_PATH_RENDER_SEGMENT);

    if (publicPathIndex === -1 && renderPathIndex === -1) {
      return imageUrl;
    }

    url.pathname = publicPathIndex >= 0
      ? url.pathname.replace(JOURNEY_PATH_PUBLIC_SEGMENT, JOURNEY_PATH_RENDER_SEGMENT)
      : url.pathname;

    const width = toPositiveInteger(options.width);
    const height = toPositiveInteger(options.height);
    const quality = toQuality(options.quality);

    if (width !== null) {
      url.searchParams.set("width", String(width));
    }
    if (height !== null) {
      url.searchParams.set("height", String(height));
    }
    if (options.resize) {
      url.searchParams.set("resize", options.resize);
    }
    if (quality !== null) {
      url.searchParams.set("quality", String(quality));
    }

    return url.toString();
  } catch {
    return imageUrl;
  }
};

export const getJourneyPathCardImageUrl = (imageUrl: string | null | undefined) =>
  getJourneyPathRenderUrl(imageUrl, {
    width: 1200,
    height: 675,
    resize: "cover",
    quality: 70,
  });

export const getJourneyPathDrawerImageUrl = (imageUrl: string | null | undefined) =>
  getJourneyPathRenderUrl(imageUrl, {
    width: 1536,
    height: 864,
    resize: "cover",
    quality: 76,
  });
