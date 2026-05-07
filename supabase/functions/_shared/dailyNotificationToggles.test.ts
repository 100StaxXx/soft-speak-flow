import {
  getDisabledDailyNotificationReason,
  isDailyNotificationType,
} from "./dailyNotificationToggles.ts";

Deno.test("daily notification toggles block disabled daily pep and quote rows", () => {
  const disabledPepReason = getDisabledDailyNotificationReason("daily_pep", {
    daily_push_enabled: false,
    daily_quote_push_enabled: true,
  });
  if (disabledPepReason !== "daily_push_disabled") {
    throw new Error(`Expected daily_push_disabled, got ${disabledPepReason}`);
  }

  const disabledQuoteReason = getDisabledDailyNotificationReason(
    "daily_quote",
    {
      daily_push_enabled: true,
      daily_quote_push_enabled: null,
    },
  );
  if (disabledQuoteReason !== "daily_quote_disabled") {
    throw new Error(
      `Expected daily_quote_disabled, got ${disabledQuoteReason}`,
    );
  }
});

Deno.test("daily notification toggles allow enabled daily content and ignore non-daily rows", () => {
  const enabledPepReason = getDisabledDailyNotificationReason("daily_pep", {
    daily_push_enabled: true,
  });
  if (enabledPepReason !== null) {
    throw new Error(`Expected enabled daily pep, got ${enabledPepReason}`);
  }

  const taskReason = getDisabledDailyNotificationReason("task_start", null);
  if (taskReason !== null) {
    throw new Error(
      `Expected task_start to ignore daily toggles, got ${taskReason}`,
    );
  }

  if (
    !isDailyNotificationType("daily_quote") ||
    isDailyNotificationType("task_reminder")
  ) {
    throw new Error(
      "Expected only daily notification types to be classified as daily",
    );
  }
});
