import { shouldApplyEngagementBudget, decideEngagementBudget } from "../_shared/notificationsV2.ts";
import {
  buildNoDeviceTokenFailureUpdate,
  resolveSourceAcknowledgement,
  TERMINAL_NO_DEVICE_ERROR,
} from "./queueDelivery.ts";

Deno.test("task notifications remain exempt from skipped_budget decisions", () => {
  if (shouldApplyEngagementBudget("task_start")) {
    throw new Error("task_start should bypass the engagement budget");
  }

  if (shouldApplyEngagementBudget("task_reminder")) {
    throw new Error("task_reminder should bypass the engagement budget");
  }

  const startDecision = decideEngagementBudget({
    notificationType: "task_start",
    state: {
      sentTodayCount: 2,
      lastSentAt: new Date("2026-04-11T10:00:00.000Z"),
    },
    now: new Date("2026-04-11T11:00:00.000Z"),
  });

  if (!startDecision.allow) {
    throw new Error(`Expected task_start to bypass budget enforcement, got ${JSON.stringify(startDecision)}`);
  }
});

Deno.test("acknowledges the correct daily task field for quest start and reminder sends", () => {
  const startAck = resolveSourceAcknowledgement({
    source_table: "daily_tasks",
    source_id: "task-1",
    notification_type: "task_start",
    payload: null,
  }, "2026-04-11T22:00:00.000Z");

  const reminderAck = resolveSourceAcknowledgement({
    source_table: "daily_tasks",
    source_id: "task-1",
    notification_type: "task_reminder",
    payload: null,
  }, "2026-04-11T21:45:00.000Z");

  if (JSON.stringify(startAck?.updates) !== JSON.stringify({ start_notification_sent: true })) {
    throw new Error(`Expected task_start to update start_notification_sent, got ${JSON.stringify(startAck)}`);
  }

  if (JSON.stringify(reminderAck?.updates) !== JSON.stringify({ reminder_sent: true })) {
    throw new Error(`Expected task_reminder to update reminder_sent, got ${JSON.stringify(reminderAck)}`);
  }
});

Deno.test("uses failed_terminal with no_device_tokens when no iOS token exists", () => {
  const update = buildNoDeviceTokenFailureUpdate(3, "2026-04-11T21:45:00.000Z");

  if (update.status !== "failed_terminal" || update.last_error !== TERMINAL_NO_DEVICE_ERROR) {
    throw new Error(`Expected failed_terminal no_device_tokens update, got ${JSON.stringify(update)}`);
  }
});
