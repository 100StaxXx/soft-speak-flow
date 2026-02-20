/**
 * Type definitions for profile onboarding data
 */

export type GuidedTutorialStepId = "create_quest" | "meet_companion" | "morning_checkin";
export type CreateQuestSubstepId =
  | "stay_on_quests"
  | "open_add_quest"
  | "enter_title"
  | "select_time"
  | "submit_create_quest";

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
  eligible: boolean;
  completedSteps: GuidedTutorialStepId[];
  xpAwardedSteps: GuidedTutorialStepId[];
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
