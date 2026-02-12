import { useOnboardingTaskCleanup } from "@/hooks/useOnboardingTaskCleanup";

/**
 * Legacy onboarding pseudo-quests were removed.
 *
 * Keep this file as a compatibility surface for older imports/tests while routing
 * callers to cleanup-only behavior.
 */
export const ONBOARDING_TASKS: ReadonlyArray<{ task_text: string }> = [];

/**
 * @deprecated Use useOnboardingTaskCleanup directly.
 */
export function useOnboardingSchedule(
  userId: string | undefined,
  hasCompletedWalkthrough: boolean,
  isProfileLoading = false
) {
  useOnboardingTaskCleanup(userId, hasCompletedWalkthrough, isProfileLoading);
}

/**
 * @deprecated Onboarding pseudo-quests are no longer created.
 */
export function isOnboardingTask(_taskText: string): boolean {
  return false;
}

/**
 * @deprecated Onboarding pseudo-quests are no longer created.
 */
export const ONBOARDING_TASK_TEXTS: string[] = [];
