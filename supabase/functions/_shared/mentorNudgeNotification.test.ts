import {
  NOTIFICATION_COMPANION_FALLBACK_NAME,
  buildMentorNudgeNotificationTitle,
} from "./mentorNudgeNotification.ts";

Deno.test("buildMentorNudgeNotificationTitle uses mentor branding for non-companion nudges", () => {
  const title = buildMentorNudgeNotificationTitle({
    mentorName: "The Sage",
    nudgeType: "check_in",
  });

  if (title !== "The Sage says:") {
    throw new Error(`Expected mentor title, got ${title}`);
  }
});

Deno.test("buildMentorNudgeNotificationTitle uses the resolved proper companion name", () => {
  const title = buildMentorNudgeNotificationTitle({
    nudgeType: "companion_concern",
    concernLevel: "dormancy_warning",
    companionName: "Nova",
    spiritAnimal: "Phoenix",
  });

  if (title !== "Nova is fading... 🌑") {
    throw new Error(`Expected Nova dormancy warning title, got ${title}`);
  }
});

Deno.test("buildMentorNudgeNotificationTitle falls back to generic companion text instead of species", () => {
  const title = buildMentorNudgeNotificationTitle({
    nudgeType: "companion_concern",
    concernLevel: "dormancy_imminent",
    companionName: "Phoenix",
    spiritAnimal: "Phoenix",
  });

  const expected = `${NOTIFICATION_COMPANION_FALLBACK_NAME} needs you now ⚠️`;
  if (title !== expected) {
    throw new Error(`Expected ${expected}, got ${title}`);
  }
});
