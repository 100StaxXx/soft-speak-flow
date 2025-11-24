/**
 * Advanced retry logic with exponential backoff
 */

interface RetryOptions {
  maxAttempts?: number;
  initialDelay?: number;
  maxDelay?: number;
  backoffFactor?: number;
  shouldRetry?: (error: unknown) => boolean;
}

type RetryableError = {
  message?: string;
  status?: number;
};

const defaultOptions: Required<RetryOptions> = {
  maxAttempts: 3,
  initialDelay: 1000,
  maxDelay: 10000,
  backoffFactor: 2,
  shouldRetry: (error: unknown) => {
    const retryError = error as RetryableError;
    // Retry on network errors and 5xx server errors
    if (retryError.message?.includes('fetch') || retryError.message?.includes('network')) return true;
    if (typeof retryError.status === 'number' && retryError.status >= 500 && retryError.status < 600) {
      return true;
    }
    return false;
  }
};

/**
 * Retry a function with exponential backoff
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const opts = { ...defaultOptions, ...options };
  let lastError: unknown;
  
  for (let attempt = 1; attempt <= opts.maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      
      // Don't retry if we shouldn't or if this is the last attempt
      if (!opts.shouldRetry(error) || attempt === opts.maxAttempts) {
        throw error;
      }
      
      // Calculate delay with exponential backoff
      const delay = Math.min(
        opts.initialDelay * Math.pow(opts.backoffFactor, attempt - 1),
        opts.maxDelay
      );
      
      
      
      // Wait before retrying
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  throw lastError;
}

/**
 * Retry configuration for React Query
 */
export const queryRetryConfig = {
  retry: (failureCount: number, error: unknown) => {
    const retryError = error as RetryableError;
    // Don't retry on 4xx errors (client errors)
    if (typeof retryError.status === 'number' && retryError.status >= 400 && retryError.status < 500) {
      return false;
    }
    // Retry up to 3 times
    return failureCount < 3;
  },
  retryDelay: (attemptIndex: number) => {
    // Exponential backoff: 1s, 2s, 4s
    return Math.min(1000 * Math.pow(2, attemptIndex), 10000);
  }
};
