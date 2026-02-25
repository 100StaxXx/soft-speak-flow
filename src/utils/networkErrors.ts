export type ErrorWithStatus = {
  status?: number;
  code?: string;
  message?: string;
};

const NETWORK_PATTERNS = [
  "load failed",
  "failed to fetch",
  "network request failed",
  "typeerror: failed to fetch",
  "networkerror",
  "timeout",
  "connection",
  "fetch",
];

export function extractErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  if (error && typeof error === "object" && "message" in error && typeof (error as { message: unknown }).message === "string") {
    return (error as { message: string }).message;
  }
  return "Unknown error";
}

export function getErrorStatus(error: unknown): number | null {
  if (!error || typeof error !== "object") return null;
  if ("status" in error && typeof (error as ErrorWithStatus).status === "number") {
    return (error as ErrorWithStatus).status ?? null;
  }
  return null;
}

export function isNetworkLikeError(error: unknown): boolean {
  const message = extractErrorMessage(error).toLowerCase();
  return NETWORK_PATTERNS.some((pattern) => message.includes(pattern));
}

export function isQueueableWriteError(error: unknown): boolean {
  if (typeof navigator !== "undefined" && !navigator.onLine) return true;
  const status = getErrorStatus(error);
  if (typeof status === "number" && status >= 500) return true;
  return isNetworkLikeError(error);
}
