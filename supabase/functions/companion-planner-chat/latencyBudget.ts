import { TimeoutError, withTimeout } from "../../../src/utils/asyncTimeout.ts";

export const PLAN_DAY_AI_TIMEOUT_MS = 5_000;
export const UPCOMING_AI_TIMEOUT_MS = 3_000;
export const QUEST_ENRICHMENT_TIMEOUT_MS = 3_000;
export const PLANNER_ORCHESTRATION_TIMEOUT_MS = 3_000;

interface RunPlannerStageWithTimeoutOptions<T> {
  work: () => Promise<T>;
  timeoutMs: number;
  operation: string;
  timeoutCode: string;
  fallbackValue: T | (() => T);
  onTimeout?: (error: TimeoutError) => void;
}

export async function runPlannerStageWithTimeout<T>(
  options: RunPlannerStageWithTimeoutOptions<T>,
): Promise<T> {
  try {
    return await withTimeout(options.work, {
      timeoutMs: options.timeoutMs,
      operation: options.operation,
      timeoutCode: options.timeoutCode,
    });
  } catch (error) {
    if (error instanceof TimeoutError) {
      options.onTimeout?.(error);
      return typeof options.fallbackValue === "function"
        ? (options.fallbackValue as () => T)()
        : options.fallbackValue;
    }

    throw error;
  }
}
