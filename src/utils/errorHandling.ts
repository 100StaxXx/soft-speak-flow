import { toast } from "sonner";
import { logger } from "./logger";

/**
 * Centralized error handling utility
 */

export interface AppError {
  message: string;
  code?: string;
  details?: any;
}

export const handleError = (error: any, context?: string): AppError => {
  logger.error(`Error${context ? ` in ${context}` : ''}:`, error);

  let errorMessage = "An unexpected error occurred";
  let errorCode = "UNKNOWN_ERROR";

  // Supabase errors
  if (error?.message) {
    errorMessage = error.message;
    errorCode = error.code || "SUPABASE_ERROR";
  }

  // Network errors
  if (error?.name === "NetworkError" || !navigator.onLine) {
    errorMessage = "Network connection lost. Please check your internet.";
    errorCode = "NETWORK_ERROR";
  }

  // Auth errors
  if (error?.status === 401) {
    errorMessage = "Authentication failed. Please log in again.";
    errorCode = "AUTH_ERROR";
  }

  return {
    message: errorMessage,
    code: errorCode,
    details: error,
  };
};

export const showErrorToast = (error: any, context?: string) => {
  const appError = handleError(error, context);
  toast.error(appError.message);
};

export const isNetworkError = (error: any): boolean => {
  return (
    error?.name === "NetworkError" ||
    error?.message?.includes("network") ||
    !navigator.onLine
  );
};

// NOTE: Use retryWithBackoff from @/utils/retry for proper retry logic with shouldRetry callbacks
