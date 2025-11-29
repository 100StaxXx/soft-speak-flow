import { toast } from "sonner";
import { logger } from "./logger";

/**
 * Centralized error handling utility
 */

export interface AppError {
  message: string;
  code?: string;
  details?: unknown;
}

type ErrorDetails = {
  message?: string;
  code?: string;
  status?: number;
  name?: string;
};

const extractErrorDetails = (error: unknown): ErrorDetails => {
  if (typeof error === "string") {
    return { message: error };
  }

  if (error && typeof error === "object") {
    const record = error as Record<string, unknown>;
    return {
      message: typeof record.message === "string" ? record.message : undefined,
      code: typeof record.code === "string" ? record.code : undefined,
      status: typeof record.status === "number" ? record.status : undefined,
      name: typeof record.name === "string" ? record.name : undefined,
    };
  }

  return {};
};

export const handleError = (error: unknown, context?: string): AppError => {
  logger.error(`Error${context ? ` in ${context}` : ''}:`, error);

  const details = extractErrorDetails(error);

  let errorMessage = details.message || "An unexpected error occurred";
  let errorCode = details.code || "UNKNOWN_ERROR";

  // Network errors
  if (details.name === "NetworkError" || !navigator.onLine) {
    errorMessage = "Network connection lost. Please check your internet.";
    errorCode = "NETWORK_ERROR";
  }

  // Auth errors
  if (details.status === 401) {
    errorMessage = "Authentication failed. Please log in again.";
    errorCode = "AUTH_ERROR";
  }

  return {
    message: errorMessage,
    code: errorCode,
    details: error,
  };
};

export const showErrorToast = (error: unknown, context?: string) => {
  const appError = handleError(error, context);
  toast.error(appError.message);
};

export const isNetworkError = (error: unknown): boolean => {
  const details = extractErrorDetails(error);
  return Boolean(
    details.name === "NetworkError" ||
      details.message?.toLowerCase().includes("network") ||
      !navigator.onLine
  );
};

/**
 * Helper to safely get error message from unknown type
 * Use this in catch blocks: catch (error) { const msg = getErrorMessage(error); }
 */
export const getErrorMessage = (error: unknown): string => {
  const details = extractErrorDetails(error);
  return details.message || "An unexpected error occurred";
};

// NOTE: Use retryWithBackoff from @/utils/retry for proper retry logic with shouldRetry callbacks
