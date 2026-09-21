import {
  buildTaskNotificationCandidates,
  buildTaskNotificationScanDateRange,
} from "./taskNotifications.ts";

Deno.test("task notification scan range covers week-long reminders plus timezone buffer", () => {
  const range = buildTaskNotificationScanDateRange(new Date("2026-04-11T12:00:00.000Z"));

  if (range.startDateIso !== "2026-04-10" || range.endDateIso !== "2026-04-19") {
    throw new Error(`Expected scan range to cover yesterday through eight days out, got ${JSON.stringify(range)}`);
  }
});

Deno.test("enqueues only the early reminder before the quest start time", () => {
  const rows = buildTaskNotificationCandidates({
    now: new Date("2026-04-11T21:50:00.000Z"),
    profilesByUser: new Map([
      ["user-1", { id: "user-1", timezone: "UTC", task_reminders_enabled: true }],
    ]),
    tasks: [{
      id: "task-1",
      user_id: "user-1",
      task_text: "Quest",
      xp_reward: 50,
      task_date: "2026-04-11",
      scheduled_time: "22:00:00",
      start_notification_sent: false,
      reminder_enabled: true,
      reminder_sent: false,
      reminder_minutes_before: 15,
      completed: false,
    }],
  });

  if (rows.length !== 1 || rows[0]?.type !== "task_reminder") {
    throw new Error(`Expected only task_reminder before start, got ${JSON.stringify(rows)}`);
  }

  if (rows[0].dedupeKey !== "task_reminder:task-1:15") {
    throw new Error(`Unexpected reminder dedupe key: ${rows[0].dedupeKey}`);
  }

  if (rows[0].payload.url !== "/advanced-planner?taskId=task-1") {
    throw new Error(`Expected reminder payload to route to the quest, got ${JSON.stringify(rows[0].payload)}`);
  }

  if (rows[0].payload.task_date !== "2026-04-11") {
    throw new Error(`Expected reminder payload to carry the quest date, got ${JSON.stringify(rows[0].payload)}`);
  }
});

Deno.test("enqueues both early reminder and quest start after the start time", () => {
  const rows = buildTaskNotificationCandidates({
    now: new Date("2026-04-11T22:05:00.000Z"),
    profilesByUser: new Map([
      ["user-1", { id: "user-1", timezone: "UTC", task_reminders_enabled: true }],
    ]),
    tasks: [{
      id: "task-1",
      user_id: "user-1",
      task_text: "Quest",
      xp_reward: 50,
      task_date: "2026-04-11",
      scheduled_time: "22:00:00",
      start_notification_sent: false,
      reminder_enabled: true,
      reminder_sent: false,
      reminder_minutes_before: 15,
      completed: false,
    }],
  });

  const types = rows.map((row) => row.type).sort();
  if (types.join(",") !== "task_reminder,task_start") {
    throw new Error(`Expected both task notifications after start, got ${JSON.stringify(rows)}`);
  }
});

Deno.test("skips stale quest notifications hours after the scheduled time", () => {
  const rows = buildTaskNotificationCandidates({
    now: new Date("2026-04-11T19:55:00.000Z"),
    profilesByUser: new Map([
      ["user-1", { id: "user-1", timezone: "UTC", task_reminders_enabled: true }],
    ]),
    tasks: [{
      id: "task-1",
      user_id: "user-1",
      task_text: "Workout",
      xp_reward: 50,
      task_date: "2026-04-11",
      scheduled_time: "17:00:00",
      start_notification_sent: false,
      reminder_enabled: true,
      reminder_sent: false,
      reminder_minutes_before: 15,
      completed: false,
    }],
  });

  if (rows.length !== 0) {
    throw new Error(`Expected no stale quest notifications, got ${JSON.stringify(rows)}`);
  }
});

Deno.test("enqueues one quest reminder per due configured offset", () => {
  const rows = buildTaskNotificationCandidates({
    now: new Date("2026-04-11T21:50:00.000Z"),
    profilesByUser: new Map([
      ["user-1", { id: "user-1", timezone: "UTC", task_reminders_enabled: true }],
    ]),
    tasks: [{
      id: "task-1",
      user_id: "user-1",
      task_text: "Quest",
      xp_reward: 50,
      task_date: "2026-04-11",
      scheduled_time: "22:00:00",
      start_notification_sent: false,
      reminder_enabled: true,
      reminder_sent: false,
      reminder_minutes_before: 10,
      reminder_offsets_minutes: [10, 60],
      reminder_sent_offsets_minutes: [60],
      completed: false,
    }],
  });

  if (rows.length !== 1 || rows[0]?.dedupeKey !== "task_reminder:task-1:10") {
    throw new Error(`Expected only the unsent 10-minute reminder, got ${JSON.stringify(rows)}`);
  }

  if (rows[0].payload.reminder_offset_minutes !== 10) {
    throw new Error(`Expected reminder payload to carry the delivered offset, got ${JSON.stringify(rows[0].payload)}`);
  }
});

Deno.test("carries ritual source hints for ritual task notifications", () => {
  const rows = buildTaskNotificationCandidates({
    now: new Date("2026-04-11T21:50:00.000Z"),
    profilesByUser: new Map([
      ["user-1", { id: "user-1", timezone: "UTC", task_reminders_enabled: true }],
    ]),
    tasks: [{
      id: "task-1",
      user_id: "user-1",
      task_text: "Ritual",
      xp_reward: 50,
      task_date: "2026-04-11",
      scheduled_time: "22:00:00",
      start_notification_sent: false,
      reminder_enabled: true,
      reminder_sent: false,
      reminder_minutes_before: 15,
      completed: false,
      habit_source_id: "habit-1",
    }],
  });

  if (rows.length !== 1 || rows[0]?.type !== "task_reminder") {
    throw new Error(`Expected one ritual task_reminder, got ${JSON.stringify(rows)}`);
  }

  if (rows[0].payload.habit_source_id !== "habit-1" || rows[0].payload.is_ritual !== true) {
    throw new Error(`Expected ritual payload hints, got ${JSON.stringify(rows[0].payload)}`);
  }
});

Deno.test("skips duplicates when a reminder or start notification was already acknowledged", () => {
  const rows = buildTaskNotificationCandidates({
    now: new Date("2026-04-11T22:05:00.000Z"),
    profilesByUser: new Map([
      ["user-1", { id: "user-1", timezone: "UTC", task_reminders_enabled: true }],
    ]),
    tasks: [{
      id: "task-1",
      user_id: "user-1",
      task_text: "Quest",
      xp_reward: 50,
      task_date: "2026-04-11",
      scheduled_time: "22:00:00",
      start_notification_sent: true,
      reminder_enabled: true,
      reminder_sent: true,
      reminder_minutes_before: 15,
      completed: false,
    }],
  });

  if (rows.length !== 0) {
    throw new Error(`Expected no rows for already-sent quest notifications, got ${JSON.stringify(rows)}`);
  }
});

Deno.test("uses the fallback reminder window for invalid reminder values and respects timezones", () => {
  const rows = buildTaskNotificationCandidates({
    now: new Date("2026-04-11T21:50:00.000Z"),
    profilesByUser: new Map([
      ["user-1", { id: "user-1", timezone: "America/Los_Angeles", task_reminders_enabled: true }],
    ]),
    tasks: [{
      id: "task-1",
      user_id: "user-1",
      task_text: "Quest",
      xp_reward: 50,
      task_date: "2026-04-11",
      scheduled_time: "15:00:00",
      start_notification_sent: false,
      reminder_enabled: true,
      reminder_sent: false,
      reminder_minutes_before: -30,
      completed: false,
    }],
  });

  if (rows.length !== 1 || rows[0]?.dedupeKey !== "task_reminder:task-1:15") {
    throw new Error(`Expected invalid reminder window to fall back to 15 minutes, got ${JSON.stringify(rows)}`);
  }
});
