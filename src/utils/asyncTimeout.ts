export class TimeoutError extends Error {
  readonly code: string;
  readonly operation: string;
  readonly timeoutMs: number;

  constructor(operation: string, timeoutMs: number, code = "GENERATION_TIMEOUT") {
    super(`${operation} timed out after ${timeoutMs}ms`);
    this.name = "TimeoutError";
    this.code = code;
    this.operation = operation;
    this.timeoutMs = timeoutMs;
  }
}

interface WithTimeoutOptions {
  timeoutMs: number;
  operation: string;
  timeoutCode?: string;
}

export async function withTimeout<T>(
  promiseOrFactory: Promise<T> | (() => Promise<T>),
  options: WithTimeoutOptions,
): Promise<T> {
  const { timeoutMs, operation, timeoutCode } = options;
  let timeoutId: ReturnType<typeof setTimeout> | undefined;

  const timeoutPromise = new Promise<T>((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new TimeoutError(operation, timeoutMs, timeoutCode));
    }, timeoutMs);
  });

  const workPromise =
    typeof promiseOrFactory === "function" ? promiseOrFactory() : promiseOrFactory;

  try {
    return await Promise.race([workPromise, timeoutPromise]);
  } finally {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  }
}

interface PollWithDeadlineOptions<T> {
  task: () => Promise<T | null | undefined>;
  intervalMs: number;
  deadlineMs: number;
  isDone?: (result: T | null | undefined) => result is T;
  onPollError?: (error: unknown) => void;
}

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export async function pollWithDeadline<T>(
  options: PollWithDeadlineOptions<T>,
): Promise<T | null> {
  const { task, intervalMs, deadlineMs, isDone, onPollError } = options;
  const startedAt = Date.now();

  const defaultIsDone = (value: T | null | undefined): value is T =>
    value !== null && value !== undefined;
  const doneCheck = isDone ?? defaultIsDone;

  while (Date.now() - startedAt < deadlineMs) {
    try {
      const result = await task();
      if (doneCheck(result)) {
        return result;
      }
    } catch (error) {
      onPollError?.(error);
    }

    const remaining = deadlineMs - (Date.now() - startedAt);
    if (remaining <= 0) {
      break;
    }
    await wait(Math.min(intervalMs, remaining));
  }

  return null;
}
