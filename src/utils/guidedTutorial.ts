import type { GuidedTutorialProgress } from "@/types/profile";

// Data schema version: bump when the persisted shape changes.
export const GUIDED_TUTORIAL_VERSION = 2;
// User-facing route/step graph version: bump when active steps or milestones change.
export const GUIDED_TUTORIAL_FLOW_VERSION = 10;

export const getGuidedTutorialLocalProgressKey = (userId: string) =>
  `guided_tutorial_progress_${userId}`;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const hasStringEntry = (value: unknown, expected: string): boolean =>
  Array.isArray(value) && value.includes(expected);

export const hasCompletedFinalTutorialCloseout = (guidedTutorial: unknown): boolean => {
  if (!isRecord(guidedTutorial)) return false;
  if (guidedTutorial.completed !== true) return false;

  return (
    hasStringEntry(guidedTutorial.milestonesCompleted, "mentor_closeout_message") ||
    hasStringEntry(guidedTutorial.completedSteps, "mentor_closeout")
  );
};

export const createInitialGuidedTutorialProgress = (
  nowIso: string = new Date().toISOString(),
): GuidedTutorialProgress => ({
  version: GUIDED_TUTORIAL_VERSION,
  flowVersion: GUIDED_TUTORIAL_FLOW_VERSION,
  eligible: true,
  completedSteps: [],
  xpAwardedSteps: [],
  milestonesCompleted: [],
  dismissed: false,
  completed: false,
  lastUpdatedAt: nowIso,
});
