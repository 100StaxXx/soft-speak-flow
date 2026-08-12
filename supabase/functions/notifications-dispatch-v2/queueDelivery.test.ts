import { shouldApplyEngagementBudget, decideEngagementBudget } from "../_shared/notificationsV2.ts";
import {
  buildTaskReminderDeliveryUpdate,
  buildNoDeviceTokenFailureUpdate,
  resolveDeliveryCopy,
  resolveSourceAcknowledgement,
  resolveTaskReminderOffsetMinutes,
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

Deno.test("acknowledges the correct daily task field for quest start sends", () => {
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
    payload: { reminder_offset_minutes: 10 },
  }, "2026-04-11T21:45:00.000Z");

  if (JSON.stringify(startAck?.updates) !== JSON.stringify({ start_notification_sent: true })) {
    throw new Error(`Expected task_start to update start_notification_sent, got ${JSON.stringify(startAck)}`);
  }

  if (reminderAck !== null) {
    throw new Error(`Expected task_reminder acknowledgement to use offset-specific handling, got ${JSON.stringify(reminderAck)}`);
  }
});

Deno.test("builds offset-specific quest reminder acknowledgement updates", () => {
  const parsedOffset = resolveTaskReminderOffsetMinutes({
    reminder_minutes_before: 10,
    reminder_offset_minutes: 60,
  });

  if (parsedOffset !== 60) {
    throw new Error(`Expected reminder_offset_minutes to win, got ${parsedOffset}`);
  }

  const firstUpdate = buildTaskReminderDeliveryUpdate({
    configuredOffsets: [10, 60],
    sentOffsets: [],
    legacyReminderMinutesBefore: 10,
    deliveredOffsetMinutes: 10,
  });

  if (JSON.stringify(firstUpdate) !== JSON.stringify({
    reminder_sent_offsets_minutes: [10],
    reminder_sent: false,
  })) {
    throw new Error(`Expected first reminder to append offset without completing, got ${JSON.stringify(firstUpdate)}`);
  }

  const finalUpdate = buildTaskReminderDeliveryUpdate({
    configuredOffsets: [10, 60],
    sentOffsets: [10],
    legacyReminderMinutesBefore: 10,
    deliveredOffsetMinutes: 60,
  });

  if (JSON.stringify(finalUpdate) !== JSON.stringify({
    reminder_sent_offsets_minutes: [10, 60],
    reminder_sent: true,
  })) {
    throw new Error(`Expected final reminder to complete the reminder set, got ${JSON.stringify(finalUpdate)}`);
  }
});

Deno.test("uses failed_terminal with no_device_tokens when no iOS token exists", () => {
  const update = buildNoDeviceTokenFailureUpdate(3, "2026-04-11T21:45:00.000Z");

  if (update.status !== "failed_terminal" || update.last_error !== TERMINAL_NO_DEVICE_ERROR) {
    throw new Error(`Expected failed_terminal no_device_tokens update, got ${JSON.stringify(update)}`);
  }
});

Deno.test("keeps daily encouragement notifications focused on the Guide reflection", () => {
  const copy = resolveDeliveryCopy({
    notification_type: "daily_pep",
    title: "Leviathan has a message for you",
    body: "Build unshakeable confidence and step into your power with clarity and purpose.",
    payload: {
      summary: "Build unshakeable confidence and step into your power with clarity and purpose.",
    },
  }, {
    displayName: "Aetherion",
    cachedCreatureName: "Aetherion",
    spiritAnimal: "Leviathan",
  });

  if (copy.title !== "Your daily encouragement is ready") {
    throw new Error(`Expected Graceward daily encouragement title, got ${copy.title}`);
  }

  if (copy.body !== "Build unshakeable confidence and step into your power with clarity and purpose.") {
    throw new Error(`Expected body to stay stable, got ${copy.body}`);
  }
});
