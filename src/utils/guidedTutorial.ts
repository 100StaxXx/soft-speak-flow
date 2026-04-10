import type { GuidedTutorialProgress } from "@/types/profile";

export const GUIDED_TUTORIAL_VERSION = 2;
export const GUIDED_TUTORIAL_FLOW_VERSION = 4;

export const getGuidedTutorialLocalProgressKey = (userId: string) =>
  `guided_tutorial_progress_${userId}`;

export const getGuidedTutorialGateDeferralSessionKey = (userId: string) =>
  `guided_tutorial_gate_deferred_${userId}`;

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
  softDismissed: false,
  completed: false,
  lastActiveAt: nowIso,
  lastUpdatedAt: nowIso,
});
