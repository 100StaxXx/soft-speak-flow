import type { GuidedTutorialProgress } from "@/types/profile";

// Data schema version: bump when the persisted shape changes.
export const GUIDED_TUTORIAL_VERSION = 2;
// User-facing route/step graph version: bump when active steps or milestones change.
export const GUIDED_TUTORIAL_FLOW_VERSION = 9;

export const getGuidedTutorialLocalProgressKey = (userId: string) =>
  `guided_tutorial_progress_${userId}`;

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
