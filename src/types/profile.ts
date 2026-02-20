/**
 * Type definitions for profile onboarding data
 */

export type GuidedTutorialStepId =
  | "quests_campaigns_intro"
  | "create_quest"
  | "meet_companion" // legacy step retained for migration compatibility
  | "morning_checkin"
  | "evolve_companion"
  | "post_evolution_companion_intro"
  | "mentor_closeout";
export type CreateQuestSubstepId =
  | "stay_on_quests" // legacy substep retained for migration compatibility
  | "quests_campaigns_intro"
  | "open_add_quest"
  | "enter_title"
  | "select_time"
  | "submit_create_quest";

export type GuidedMilestoneId =
  | "mentor_intro_hello"
  | "stay_on_quests" // legacy
  | "quests_campaigns_intro"
  | "open_add_quest"
  | "enter_title"
  | "select_time"
  | "submit_create_quest"
  | "open_companion_tab" // legacy
  | "confirm_companion_progress" // legacy
  | "open_mentor_tab"
  | "submit_morning_checkin"
  | "tap_evolve_companion"
  | "complete_companion_evolution"
  | "post_evolution_companion_intro"
  | "mentor_closeout_message";

export interface GuidedSubstepProgress {
  create_quest?: {
    current: CreateQuestSubstepId;
    completed: CreateQuestSubstepId[];
    startedAt?: string;
    completedAt?: string;
  };
}

export interface GuidedTutorialProgress {
  version: number;
  flowVersion?: number;
  eligible: boolean;
  completedSteps: GuidedTutorialStepId[];
  xpAwardedSteps: GuidedTutorialStepId[];
  milestonesCompleted?: GuidedMilestoneId[];
  evolutionInFlight?: boolean;
  evolutionStartedAt?: string;
  evolutionCompletedAt?: string;
  introEnabled?: boolean;
  introSeen?: boolean;
  introSeenAt?: string;
  substeps?: GuidedSubstepProgress;
  dismissed: boolean;
  completed: boolean;
  completedAt?: string;
  lastUpdatedAt?: string;
}

export interface OnboardingData {
  userName?: string;
  mentorId?: string;
  mentorName?: string;
  mentorEnergyPreference?: string;
  walkthrough_completed?: boolean;
  quests_tutorial_seen?: boolean;
  guided_tutorial?: GuidedTutorialProgress;
  birthdate?: string;
  zodiacSign?: string;
  explanation?: {
    title: string;
    subtitle: string;
    paragraph: string;
    bullets: string[];
  };
  [key: string]: unknown; // Allow additional fields
}

export interface ProfilePreferences {
  [key: string]: unknown;
}
