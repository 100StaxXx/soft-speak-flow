/**
 * Type definitions for profile onboarding data
 */

export interface OnboardingData {
  userName?: string;
  mentorId?: string;
  mentorName?: string;
  walkthrough_completed?: boolean;
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
