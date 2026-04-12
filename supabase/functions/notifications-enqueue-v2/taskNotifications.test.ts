import { buildTaskNotificationCandidates } from "./taskNotifications.ts";

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
