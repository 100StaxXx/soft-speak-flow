import {
  computeDeterministicJitterMinutes,
  decideEngagementBudget,
  getNotificationPriority,
  isCriticalNotification,
  pickDeterministicDailyQuote,
  resolveDueHabitReminder,
  resolveDispatchMode,
  shouldApplyEngagementBudget,
  toDailyScheduledDateTime,
  toScheduledDateTime,
} from "./notificationsV2.ts";
import { composeNotificationCopy } from "./notificationComposer.ts";

Deno.test("computeDeterministicJitterMinutes is stable and bounded", async () => {
  const one = await computeDeterministicJitterMinutes("user-123", "2026-02-25", "morning", 60);
  const two = await computeDeterministicJitterMinutes("user-123", "2026-02-25", "morning", 60);

  if (one !== two) {
    throw new Error(`Expected deterministic jitter, got ${one} and ${two}`);
  }

  if (one < -60 || one > 60) {
    throw new Error(`Expected jitter in [-60, 60], got ${one}`);
  }
});

Deno.test("priority and critical classification are aligned", () => {
  if (!isCriticalNotification("task_start")) {
    throw new Error("task_start should be critical");
  }

  if (isCriticalNotification("daily_pep")) {
    throw new Error("daily_pep should not be critical");
  }

  const criticalPriority = getNotificationPriority("task_start");
  const nonCriticalPriority = getNotificationPriority("checkin_evening_reminder");

  if (criticalPriority <= nonCriticalPriority) {
    throw new Error("Critical notification should have higher priority");
  }
});

Deno.test("scheduled reminders bypass engagement budget while daily content stays budgeted", () => {
  if (shouldApplyEngagementBudget("task_reminder")) {
    throw new Error("task_reminder should bypass the engagement budget");
  }

  if (!shouldApplyEngagementBudget("daily_pep")) {
    throw new Error("daily_pep should count toward the engagement budget");
  }

  const blockedDailyPep = decideEngagementBudget({
    notificationType: "daily_pep",
    state: { sentTodayCount: 2, lastSentAt: new Date("2026-03-27T10:00:00.000Z") },
    now: new Date("2026-03-27T16:00:00.000Z"),
  });

  if (blockedDailyPep.allow || blockedDailyPep.reason !== "daily_cap_reached") {
    throw new Error(`Expected daily_pep to be blocked by daily cap, got ${JSON.stringify(blockedDailyPep)}`);
  }

  const spacedDailyPep = decideEngagementBudget({
    notificationType: "daily_pep",
    state: {
      sentTodayCount: 1,
      lastSentAt: new Date("2026-03-27T10:00:00.000Z"),
    },
    now: new Date("2026-03-27T14:01:00.000Z"),
  });

  if (!spacedDailyPep.allow) {
    throw new Error(`Expected daily_pep to be allowed after spacing guard clears, got ${JSON.stringify(spacedDailyPep)}`);
  }

  const allowedTaskReminder = decideEngagementBudget({
    notificationType: "task_reminder",
    state: {
      sentTodayCount: 2,
      lastSentAt: new Date("2026-03-27T15:00:00.000Z"),
    },
    now: new Date("2026-03-27T16:00:00.000Z"),
  });

  if (!allowedTaskReminder.allow) {
    throw new Error(`Expected task_reminder to bypass engagement budget, got ${JSON.stringify(allowedTaskReminder)}`);
  }
});

Deno.test("daily quote selection is deterministic per mentor and local date", async () => {
  const quotes = [{ id: "quote-c" }, { id: "quote-a" }, { id: "quote-b" }];

  const one = await pickDeterministicDailyQuote(quotes, "nova", "2026-03-27");
  const two = await pickDeterministicDailyQuote(quotes, "nova", "2026-03-27");
  const differentDay = await pickDeterministicDailyQuote(quotes, "nova", "2026-03-28");

  if (!one || !two || !differentDay) {
    throw new Error("Expected a quote to be selected");
  }

  if (one.id !== two.id) {
    throw new Error(`Expected stable selection, got ${one.id} and ${two.id}`);
  }

  if (!quotes.some((quote) => quote.id === differentDay.id)) {
    throw new Error(`Expected selected quote to come from the provided list, got ${differentDay.id}`);
  }
});

Deno.test("daily schedule conversion honors exact local time", () => {
  const scheduled = toDailyScheduledDateTime(
    "2026-03-27",
    "08:30:00",
    "evening",
    "America/Los_Angeles",
    "morning",
  );

  if (!scheduled) {
    throw new Error("Expected a scheduled date");
  }

  if (scheduled.toISOString() !== "2026-03-27T15:30:00.000Z") {
    throw new Error(`Expected 2026-03-27T15:30:00.000Z, got ${scheduled.toISOString()}`);
  }
});

Deno.test("daily schedule conversion falls back to the configured window", () => {
  const scheduled = toDailyScheduledDateTime(
    "2026-03-27",
    null,
    "evening",
    "America/Los_Angeles",
    "morning",
  );

  if (!scheduled) {
    throw new Error("Expected a scheduled date");
  }

  if (scheduled.toISOString() !== "2026-03-28T02:00:00.000Z") {
    throw new Error(`Expected 2026-03-28T02:00:00.000Z, got ${scheduled.toISOString()}`);
  }
});

Deno.test("scheduled date conversion rejects nonexistent spring-forward times", () => {
  const scheduled = toScheduledDateTime(
    "2026-03-08",
    "02:30:00",
    "America/Los_Angeles",
  );

  if (scheduled !== null) {
    throw new Error(`Expected nonexistent DST time to resolve to null, got ${scheduled.toISOString()}`);
  }
});

Deno.test("habit reminder resolution works for same-day timezones like Tokyo", () => {
  const due = resolveDueHabitReminder({
    now: new Date("2026-03-26T23:20:00.000Z"),
    localDate: "2026-03-27",
    timezone: "Asia/Tokyo",
    preferredTime: "08:30:00",
    reminderMinutesBefore: 15,
    frequency: "daily",
    customDays: null,
    lastSentForDate: null,
  });

  if (!due) {
    throw new Error("Expected a Tokyo habit reminder to be due");
  }

  if (due.habitLocalDate !== "2026-03-27") {
    throw new Error(`Expected habitLocalDate 2026-03-27, got ${due.habitLocalDate}`);
  }

  if (due.reminderAt.toISOString() !== "2026-03-26T23:15:00.000Z") {
    throw new Error(`Unexpected Tokyo reminderAt: ${due.reminderAt.toISOString()}`);
  }
});

Deno.test("habit reminder resolution handles pre-midnight reminders for the next local day", () => {
  const due = resolveDueHabitReminder({
    now: new Date("2026-03-28T06:58:00.000Z"),
    localDate: "2026-03-27",
    timezone: "America/Los_Angeles",
    preferredTime: "00:10:00",
    reminderMinutesBefore: 15,
    frequency: "daily",
    customDays: null,
    lastSentForDate: null,
  });

  if (!due) {
    throw new Error("Expected a Los Angeles near-midnight habit reminder to be due");
  }

  if (due.habitLocalDate !== "2026-03-28") {
    throw new Error(`Expected habitLocalDate 2026-03-28, got ${due.habitLocalDate}`);
  }

  if (due.reminderAt.toISOString() !== "2026-03-28T06:55:00.000Z") {
    throw new Error(`Unexpected Los Angeles reminderAt: ${due.reminderAt.toISOString()}`);
  }
});

Deno.test("habit reminder resolution allows the next local day after a prior send", () => {
  const due = resolveDueHabitReminder({
    now: new Date("2026-03-28T15:20:00.000Z"),
    localDate: "2026-03-28",
    timezone: "America/Los_Angeles",
    preferredTime: "08:30:00",
    reminderMinutesBefore: 15,
    frequency: "daily",
    customDays: null,
    lastSentForDate: "2026-03-27",
  });

  if (!due) {
    throw new Error("Expected the next local day to be eligible after the previous date was already sent");
  }

  if (due.habitLocalDate !== "2026-03-28") {
    throw new Error(`Expected habitLocalDate 2026-03-28, got ${due.habitLocalDate}`);
  }
});

Deno.test("composer applies companion context only to companion-led types", () => {
  const dailyPep = composeNotificationCopy({
    type: "daily_pep",
    payload: { summary: "Your pep talk is ready." },
    companion: { cachedCreatureName: "Nova" },
  });

  if (!dailyPep.title.includes("Nova")) {
    throw new Error(`Expected companion name in daily pep title, got ${dailyPep.title}`);
  }

  const morningCheckin = composeNotificationCopy({
    type: "checkin_morning_reminder",
    payload: {},
    companion: { cachedCreatureName: "Nova" },
  });

  if (morningCheckin.title.includes("Nova")) {
    throw new Error("Check-in reminders should remain non-companion branded");
  }
});

Deno.test("composer never surfaces the species label as a companion push title", () => {
  const dailyPep = composeNotificationCopy({
    type: "daily_pep",
    payload: { summary: "Your pep talk is ready." },
    companion: {
      cachedCreatureName: "Phoenix",
      spiritAnimal: "Phoenix",
    },
  });

  if (dailyPep.title.includes("Phoenix")) {
    throw new Error(`Expected species label to be suppressed, got ${dailyPep.title}`);
  }

  if (!dailyPep.title.startsWith("Your companion")) {
    throw new Error(`Expected generic fallback title, got ${dailyPep.title}`);
  }
});

Deno.test("composer formats daily quote copy", () => {
  const dailyQuote = composeNotificationCopy({
    type: "daily_quote",
    payload: { quote_text: "Stay steady.", author: "Atlas" },
  });

  if (dailyQuote.title !== "Daily quote") {
    throw new Error(`Expected daily quote title, got ${dailyQuote.title}`);
  }

  if (dailyQuote.body !== "\"Stay steady.\" - Atlas") {
    throw new Error(`Unexpected daily quote body: ${dailyQuote.body}`);
  }
});

Deno.test("dispatch mode defaults to send and rejects invalid values", () => {
  if (resolveDispatchMode(undefined) !== "send") {
    throw new Error("Expected undefined mode to default to send");
  }

  if (resolveDispatchMode("shadow") !== "shadow") {
    throw new Error("Expected explicit shadow mode to be preserved");
  }

  let threw = false;
  try {
    resolveDispatchMode("bogus");
  } catch {
    threw = true;
  }

  if (!threw) {
    throw new Error("Expected invalid mode to throw");
  }
});
