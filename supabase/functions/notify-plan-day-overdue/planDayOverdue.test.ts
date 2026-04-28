import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  buildOverduePushes,
  type DailyPlanRow,
  findOverdueBlocks,
  formatTimeOfDay,
  type OverdueProfile,
} from "./planDayOverdue.ts";

const samplePlan = (
  overrides: Partial<DailyPlanRow> = {},
): DailyPlanRow => ({
  id: "plan-1",
  user_id: "user-1",
  plan_date: "2026-04-28",
  status: "committed",
  updated_at: "2026-04-28T09:00:00.000Z",
  blocks: [
    {
      id: "block-1",
      questId: "task-1",
      title: "Outline launch email",
      startTime: "10:00",
      durationMinutes: 45,
      source: "optimization",
    },
    {
      id: "block-2",
      questId: "task-2",
      title: "Reply to inbox",
      startTime: "13:00",
      durationMinutes: 20,
      source: "optimization",
    },
  ],
  ...overrides,
});

Deno.test("findOverdueBlocks returns blocks past their end time", () => {
  const overdue = findOverdueBlocks(
    samplePlan(),
    new Set<string>(),
    14 * 60,
    "2026-04-28",
  );
  assertEquals(overdue.length, 2);
  assertEquals(overdue[0].block.id, "block-1");
});

Deno.test("findOverdueBlocks ignores completed blocks", () => {
  const overdue = findOverdueBlocks(
    samplePlan(),
    new Set(["task-1"]),
    14 * 60,
    "2026-04-28",
  );
  assertEquals(overdue.length, 1);
  assertEquals(overdue[0].block.id, "block-2");
});

Deno.test("findOverdueBlocks returns empty when nothing has elapsed", () => {
  const overdue = findOverdueBlocks(
    samplePlan(),
    new Set<string>(),
    9 * 60,
    "2026-04-28",
  );
  assertEquals(overdue.length, 0);
});

Deno.test("findOverdueBlocks ignores draft plans", () => {
  const overdue = findOverdueBlocks(
    samplePlan({ status: "draft" }),
    new Set<string>(),
    14 * 60,
    "2026-04-28",
  );
  assertEquals(overdue.length, 0);
});

Deno.test("findOverdueBlocks ignores blocks without questId", () => {
  const plan = samplePlan({
    blocks: [
      {
        id: "block-flex",
        questId: null,
        title: "Plan tomorrow",
        startTime: "10:00",
        durationMinutes: 30,
      },
    ],
  });
  const overdue = findOverdueBlocks(
    plan,
    new Set<string>(),
    14 * 60,
    "2026-04-28",
  );
  assertEquals(overdue.length, 0);
});

Deno.test("findOverdueBlocks ignores blocks without startTime", () => {
  const plan = samplePlan({
    blocks: [
      {
        id: "block-flex",
        questId: "task-flex",
        title: "Flex quest",
        startTime: null,
        durationMinutes: 30,
      },
    ],
  });
  const overdue = findOverdueBlocks(
    plan,
    new Set<string>(),
    14 * 60,
    "2026-04-28",
  );
  assertEquals(overdue.length, 0);
});

Deno.test("findOverdueBlocks ignores plans for a different local date", () => {
  const overdue = findOverdueBlocks(
    samplePlan({ plan_date: "2026-04-27" }),
    new Set<string>(),
    14 * 60,
    "2026-04-28",
  );
  assertEquals(overdue.length, 0);
});

Deno.test("formatTimeOfDay produces friendly am/pm labels", () => {
  assertEquals(formatTimeOfDay(0), "12 am");
  assertEquals(formatTimeOfDay(8 * 60), "8 am");
  assertEquals(formatTimeOfDay(10 * 60 + 30), "10:30 am");
  assertEquals(formatTimeOfDay(13 * 60), "1 pm");
  assertEquals(formatTimeOfDay(13 * 60 + 5), "1:05 pm");
});

Deno.test("buildOverduePushes queues one row per user with overdue blocks", () => {
  const profiles = new Map<string, OverdueProfile>([[
    "user-1",
    { id: "user-1", timezone: "UTC", task_reminders_enabled: true },
  ]]);
  const now = new Date("2026-04-28T14:00:00.000Z");
  const rows = buildOverduePushes({
    plans: [samplePlan()],
    profiles,
    completedQuestIds: new Set<string>(),
    now,
  });
  assertEquals(rows.length, 1);
  assertEquals(rows[0].user_id, "user-1");
  assertEquals(rows[0].notification_type, "plan_day_overdue");
  assertEquals(rows[0].source_table, "daily_plans");
  assertEquals(rows[0].source_id, "plan-1");
  assertEquals(
    rows[0].dedupe_key,
    "plan_day_overdue:user-1:2026-04-28",
  );
});

Deno.test("buildOverduePushes skips users with task reminders disabled", () => {
  const profiles = new Map<string, OverdueProfile>([[
    "user-1",
    { id: "user-1", timezone: "UTC", task_reminders_enabled: false },
  ]]);
  const now = new Date("2026-04-28T14:00:00.000Z");
  const rows = buildOverduePushes({
    plans: [samplePlan()],
    profiles,
    completedQuestIds: new Set<string>(),
    now,
  });
  assertEquals(rows.length, 0);
});

Deno.test("buildOverduePushes skips when no profile exists", () => {
  const profiles = new Map<string, OverdueProfile>();
  const now = new Date("2026-04-28T14:00:00.000Z");
  const rows = buildOverduePushes({
    plans: [samplePlan()],
    profiles,
    completedQuestIds: new Set<string>(),
    now,
  });
  assertEquals(rows.length, 0);
});

Deno.test("buildOverduePushes only queues for the earliest overdue block", () => {
  const profiles = new Map<string, OverdueProfile>([[
    "user-1",
    { id: "user-1", timezone: "UTC", task_reminders_enabled: true },
  ]]);
  const now = new Date("2026-04-28T14:00:00.000Z");
  const rows = buildOverduePushes({
    plans: [samplePlan()],
    profiles,
    completedQuestIds: new Set<string>(),
    now,
  });
  assertEquals(rows.length, 1);
  assertEquals(
    rows[0].dedupe_key,
    "plan_day_overdue:user-1:2026-04-28",
  );
  const body = rows[0].body;
  assertEquals(body.includes("Outline launch email"), true);
  assertEquals(body.includes("10 am"), true);
});
