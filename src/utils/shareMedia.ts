import { Capacitor } from "@capacitor/core";
import { Directory, Filesystem } from "@capacitor/filesystem";
import { Share } from "@capacitor/share";
import { toPng } from "html-to-image";
import { PRODUCT } from "@/config/product";

import {
  EvolutionShareVideo,
  type RenderEvolutionShareVideoOptions,
  type RenderEvolutionShareVideoResult,
} from "@/plugins/EvolutionShareVideoPlugin";

const PRODUCT_HASHTAG = PRODUCT.mode === "christian" ? "#Graceward" : "#Cosmiq";
export const DEFAULT_EVOLUTION_SHARE_TEXT = `My companion just evolved in ${PRODUCT.name}. ${PRODUCT_HASHTAG}`;
export const DEFAULT_STATS_CARD_SHARE_TEXT = `My current ${PRODUCT.name} companion title. ${PRODUCT_HASHTAG}`;

export type ShareCardFormat = "story" | "square";

export interface RenderShareCardImageOptions {
  element: HTMLElement;
  filename: string;
  format: ShareCardFormat;
}

export interface RenderedNativeMedia {
  uri: string;
  filename: string;
  mimeType: string;
  width?: number;
  height?: number;
  durationMs?: number;
}

export type RenderedShareCardImage = File | RenderedNativeMedia;
export type ShareableRenderedMedia = File | RenderedNativeMedia | string;

export interface ShareRenderedMediaOptions {
  uriOrFile: ShareableRenderedMedia;
  title: string;
  text?: string;
  dialogTitle?: string;
}

export type ShareRenderedMediaStatus = "shared" | "downloaded" | "cancelled";

export interface ShareRenderedMediaResult {
  status: ShareRenderedMediaStatus;
  captionCopied: boolean;
}

const MIME_BY_EXTENSION: Record<string, string> = {
  mp4: "video/mp4",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
};

const CANCEL_PATTERNS = [
  "abort",
  "cancel",
  "canceled",
  "cancelled",
  "dismiss",
  "user did not share",
  "share sheet dismissed",
  "operation was cancelled",
];

export const isShareCancelled = (error: unknown): boolean => {
  if (!error) return false;
  if (error instanceof DOMException && error.name === "AbortError") return true;
  if (error instanceof Error && error.name === "AbortError") return true;

  const message =
    error instanceof Error
      ? `${error.name} ${error.message}`
      : typeof error === "string"
        ? error
        : String(error);

  const normalized = message.toLowerCase();
  return CANCEL_PATTERNS.some((pattern) => normalized.includes(pattern));
};

export const renderEvolutionShareVideo = (
  options: RenderEvolutionShareVideoOptions,
): Promise<RenderEvolutionShareVideoResult> =>
  EvolutionShareVideo.renderEvolutionShareVideo(options);

export const renderShareCardImage = async ({
  element,
  filename,
  format,
}: RenderShareCardImageOptions): Promise<RenderedShareCardImage> => {
  const dataUrl = await toPng(element, {
    cacheBust: true,
    quality: 1,
    pixelRatio: format === "story" ? 3 : 2,
    backgroundColor: "#080a12",
  });
  const base64Data = stripDataUrlPrefix(dataUrl);

  if (Capacitor.isNativePlatform()) {
    const savedFile = await Filesystem.writeFile({
      path: filename,
      data: base64Data,
      directory: Directory.Cache,
      recursive: true,
    });

    return {
      uri: savedFile.uri,
      filename,
      mimeType: "image/png",
      width: format === "story" ? 1080 : 1080,
      height: format === "story" ? 1920 : 1080,
    };
  }

  const blob = await dataUrlToBlob(dataUrl);
  return new File([blob], filename, { type: "image/png" });
};

export const shareRenderedMedia = async ({
  uriOrFile,
  title,
  text = "",
  dialogTitle,
}: ShareRenderedMediaOptions): Promise<ShareRenderedMediaResult> => {
  const captionCopied = await copyShareCaption(text);

  try {
    if (Capacitor.isNativePlatform()) {
      const canShare = await getNativeCanShare();
      if (!canShare) {
        return {
          status: await downloadRenderedMedia(uriOrFile),
          captionCopied,
        };
      }

      const media = normalizeShareableMedia(uriOrFile);
      const isNativeFileUri = media.uri.startsWith("file:");
      await Share.share({
        title,
        text,
        url: media.uri && !isNativeFileUri ? media.uri : undefined,
        files: media.uri && isNativeFileUri ? [media.uri] : undefined,
        dialogTitle,
      });

      return { status: "shared", captionCopied };
    }

    const media = normalizeShareableMedia(uriOrFile);
    if (media.file && canWebShareFiles([media.file])) {
      await navigator.share({
        files: [media.file],
        title,
        text,
      });
      return { status: "shared", captionCopied };
    }

    if (media.uri && canWebShareUrl()) {
      await navigator.share({
        title,
        text,
        url: media.uri,
      });
      return { status: "shared", captionCopied };
    }

    return {
      status: await downloadRenderedMedia(uriOrFile),
      captionCopied,
    };
  } catch (error) {
    if (isShareCancelled(error)) {
      return { status: "cancelled", captionCopied };
    }

    return {
      status: await downloadRenderedMedia(uriOrFile),
      captionCopied,
    };
  }
};

export const copyShareCaption = async (text: string | undefined): Promise<boolean> => {
  const caption = text?.trim();
  if (!caption || typeof navigator === "undefined" || !navigator.clipboard?.writeText) {
    return false;
  }

  try {
    await navigator.clipboard.writeText(caption);
    return true;
  } catch {
    return false;
  }
};

const getNativeCanShare = async () => {
  try {
    const result = await Share.canShare();
    return result.value;
  } catch {
    return true;
  }
};

const normalizeShareableMedia = (media: ShareableRenderedMedia) => {
  if (typeof media === "string") {
    return {
      uri: media,
      filename: filenameFromUri(media),
      mimeType: mimeTypeFromFilename(media),
    };
  }

  if (typeof File !== "undefined" && media instanceof File) {
    return {
      file: media,
      uri: "",
      filename: media.name,
      mimeType: media.type || mimeTypeFromFilename(media.name),
    };
  }

  const nativeMedia = media as RenderedNativeMedia;
  return {
    uri: nativeMedia.uri,
    filename: nativeMedia.filename,
    mimeType: nativeMedia.mimeType,
  };
};

const canWebShareFiles = (files: File[]): boolean =>
  typeof navigator !== "undefined" &&
  typeof navigator.share === "function" &&
  typeof navigator.canShare === "function" &&
  navigator.canShare({ files });

const canWebShareUrl = (): boolean =>
  typeof navigator !== "undefined" && typeof navigator.share === "function";

const downloadRenderedMedia = async (
  media: ShareableRenderedMedia,
): Promise<"downloaded"> => {
  const normalized = normalizeShareableMedia(media);
  const link = document.createElement("a");
  const href = normalized.file
    ? URL.createObjectURL(normalized.file)
    : normalized.uri;

  link.href = href;
  link.download = normalized.filename;
  document.body.appendChild(link);
  link.click();
  link.remove();

  if (normalized.file) {
    window.setTimeout(() => URL.revokeObjectURL(href), 250);
  }

  return "downloaded";
};

const stripDataUrlPrefix = (dataUrl: string) => {
  const [, base64Data] = dataUrl.split(",");
  return base64Data ?? dataUrl;
};

const dataUrlToBlob = async (dataUrl: string) => {
  const response = await fetch(dataUrl);
  return response.blob();
};

const filenameFromUri = (uri: string) => {
  const path = uri.split("?")[0] ?? uri;
  const filename = path.split("/").filter(Boolean).pop();
  return filename || `${PRODUCT.name.toLowerCase()}-share`;
};

const mimeTypeFromFilename = (filename: string) => {
  const extension = filename.split(".").pop()?.toLowerCase() ?? "";
  return MIME_BY_EXTENSION[extension] ?? "application/octet-stream";
};
