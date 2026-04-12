import {
  NOTIFICATION_COMPANION_FALLBACK_NAME,
  getNotificationSafeCompanionName,
} from "./companionName.ts";

export interface MentorNudgeNotificationTitleInput {
  mentorName?: string | null;
  nudgeType?: string | null;
  concernLevel?: string | null;
  companionName?: string | null;
  spiritAnimal?: string | null;
}

export function buildMentorNudgeNotificationTitle(
  input: MentorNudgeNotificationTitleInput,
): string {
  const mentorName = input.mentorName?.trim() || "Your mentor";

  if (input.nudgeType !== "companion_concern") {
    return `${mentorName} says:`;
  }

  const companionName = getNotificationSafeCompanionName(
    input.companionName,
    input.spiritAnimal,
  );

  if (input.concernLevel === "dormancy_warning") {
    return `${companionName} is fading... 🌑`;
  }

  if (input.concernLevel === "dormancy_imminent") {
    return `${companionName} needs you now ⚠️`;
  }

  return `${companionName} misses you 💔`;
}

export { NOTIFICATION_COMPANION_FALLBACK_NAME };
