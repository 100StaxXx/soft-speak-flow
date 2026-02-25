import {
  computeDeterministicJitterMinutes,
  getNotificationPriority,
  isCriticalNotification,
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
