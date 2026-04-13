import {
  EVENING_REFLECTION_NOTIFICATION_URL,
  getCheckinReminderUrl,
} from "./reflectionNavigation.ts";

Deno.test("routes evening reminders to the canonical mentor reflection URL", () => {
  if (getCheckinReminderUrl("evening") !== EVENING_REFLECTION_NOTIFICATION_URL) {
    throw new Error(
      `Expected evening reminder URL to be ${EVENING_REFLECTION_NOTIFICATION_URL}`,
    );
  }
});

Deno.test("keeps morning reminders on the home route", () => {
  if (getCheckinReminderUrl("morning") !== "/") {
    throw new Error('Expected morning reminder URL to stay on "/"');
  }
});
