import {
  assertEquals,
  assertStrictEquals,
} from "https://deno.land/std@0.224.0/assert/mod.ts";
import type { PlannerBuildInput } from "./planner.ts";
import { validateAndPrunePlannerContext } from "./plannerContextValidator.ts";

type PlannerContext = PlannerBuildInput["plannerContext"];
type ValidatorSupabase = Parameters<typeof validateAndPrunePlannerContext>[0];
type MockRow = Record<string, unknown> & { id: string; user_id: string };

const EPIC_LIVE_ID = "11111111-1111-4111-8111-111111111111";
const EPIC_DELETED_ID = "22222222-2222-4222-8222-222222222222";
const HABIT_DELETED_ID = "33333333-3333-4333-8333-333333333333";
const HABIT_ACTIVE_ID = "33333333-3333-4333-8333-333333333334";
const TASK_DELETED_ID = "44444444-4444-4444-8444-444444444444";
const TASK_LIVE_ID = "55555555-5555-4555-8555-555555555555";
const TASK_COMPLETED_STALE_ID = "66666666-6666-4666-8666-666666666666";
const TASK_INCOMPLETE_STALE_ID = "77777777-7777-4777-8777-777777777777";
const TASK_HABIT_DELETED_ID = "88888888-8888-4888-8888-888888888888";
const TASK_HABIT_STALE_CLIENT_ID = "99999999-9999-4999-8999-999999999999";
const TASK_PENDING_LOCAL_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const EPIC_LEGACY_LOCAL_ID = "epic-legacy-deleted";
const HABIT_LEGACY_LOCAL_ID = "habit-legacy-deleted";
const TASK_LEGACY_LOCAL_ID = "task-legacy-deleted";

const baseContext = (
  overrides: Partial<PlannerContext> = {},
): PlannerContext => ({
  tasks: [],
  inboxTasks: [],
  recentCompletedTasks: [],
  activeEpics: [],
  rituals: [],
  calendarEvents: [],
  ...overrides,
});

const baseTask = (
  overrides: Partial<PlannerContext["tasks"][number]> = {},
): PlannerContext["tasks"][number] => ({
  id: "task-1",
  title: "Task",
  taskDate: "2026-05-01",
  scheduledTime: null,
  estimatedDuration: null,
  recurrencePattern: null,
  completed: false,
  ...overrides,
});

const taskRow = (overrides: Partial<MockRow> = {}): MockRow => ({
  id: "task-1",
  user_id: "user-1",
  task_text: "Task",
  task_date: "2026-05-01",
  category: null,
  difficulty: null,
  priority: null,
  flexibility: null,
  energy_type: null,
  must_calendar_block: null,
  deadline_at: null,
  completed: false,
  scheduled_time: null,
  completed_at: null,
  estimated_duration: null,
  actual_time_spent: null,
  notes: null,
  recurrence_pattern: null,
  recurrence_end_date: null,
  source: null,
  contact_id: null,
  habit_source_id: null,
  epic_id: null,
  epic_title: null,
  ...overrides,
});

const createMockSupabase = (
  tables: {
    epics?: MockRow[];
    daily_tasks?: MockRow[];
    habits?: MockRow[];
  },
  failTable?: keyof typeof tables,
): ValidatorSupabase => ({
  from: (tableName: keyof typeof tables) => {
    const filters: Record<string, unknown> = {};
    const builder = {
      select: () => builder,
      eq: (column: string, value: unknown) => {
        filters[column] = value;
        return builder;
      },
      in: async (column: string, values: string[]) => {
        if (tableName === failTable) {
          return { data: null, error: new Error(`failed ${tableName}`) };
        }

        const rows = (tables[tableName] ?? []).filter((row) =>
          values.includes(String(row[column])) &&
          Object.entries(filters).every(([key, value]) => row[key] === value)
        );

        return { data: rows, error: null };
      },
    };
    return builder;
  },
} as unknown as ValidatorSupabase);

Deno.test("validateAndPrunePlannerContext drops client-only deleted campaign context", async () => {
  const context = baseContext({
    activeEpics: [{
      id: EPIC_DELETED_ID,
      title: "Deleted Campaign",
      endDate: "2026-06-01",
    }],
    tasks: [baseTask({
      id: TASK_DELETED_ID,
      title: "Deleted Quest",
      epicId: EPIC_DELETED_ID,
      epicTitle: "Deleted Campaign",
    })],
    rituals: [{
      id: HABIT_DELETED_ID,
      epicId: EPIC_DELETED_ID,
      epicTitle: "Deleted Campaign",
      title: "Deleted Ritual",
      frequency: "daily",
      preferredTime: null,
    }],
  });

  const result = await validateAndPrunePlannerContext(
    createMockSupabase({ epics: [], daily_tasks: [], habits: [] }),
    "user-1",
    context,
  );

  assertEquals(result.activeEpics, []);
  assertEquals(result.tasks, []);
  assertEquals(result.rituals, []);
  assertEquals(result.activeHabitIds, []);
});

Deno.test("validateAndPrunePlannerContext drops non-UUID local rows unless they are explicitly pending", async () => {
  const context = baseContext({
    activeEpics: [{
      id: EPIC_LEGACY_LOCAL_ID,
      title: "Legacy Deleted Campaign",
      endDate: null,
    }],
    tasks: [baseTask({
      id: TASK_LEGACY_LOCAL_ID,
      title: "Legacy Deleted Quest",
      habitSourceId: HABIT_LEGACY_LOCAL_ID,
      epicId: EPIC_LEGACY_LOCAL_ID,
      epicTitle: "Legacy Deleted Campaign",
    })],
    rituals: [{
      id: HABIT_LEGACY_LOCAL_ID,
      epicId: EPIC_LEGACY_LOCAL_ID,
      epicTitle: "Legacy Deleted Campaign",
      title: "Legacy Deleted Ritual",
      frequency: "daily",
      preferredTime: null,
    }],
  });

  const result = await validateAndPrunePlannerContext(
    createMockSupabase({ epics: [], daily_tasks: [], habits: [] }),
    "user-1",
    context,
  );

  assertEquals(result.activeEpics, []);
  assertEquals(result.tasks, []);
  assertEquals(result.rituals, []);
  assertEquals(result.activeHabitIds, []);
});

Deno.test("validateAndPrunePlannerContext passes through unchanged on validation failure", async () => {
  const context = baseContext({
    activeEpics: [{
      id: EPIC_LIVE_ID,
      title: "Keep Me",
      endDate: null,
    }],
  });

  const result = await validateAndPrunePlannerContext(
    createMockSupabase({ epics: [] }, "epics"),
    "user-1",
    context,
  );

  assertStrictEquals(result, context);
});

Deno.test("validateAndPrunePlannerContext uses fresh DB campaign titles and detaches completed stale tasks", async () => {
  const context = baseContext({
    activeEpics: [
      {
        id: EPIC_LIVE_ID,
        title: "Old Title",
        endDate: null,
        progressPercentage: 7,
        daysRemaining: 11,
        habitCount: 3,
      },
      { id: EPIC_DELETED_ID, title: "Deleted Campaign", endDate: null },
    ],
    tasks: [
      baseTask({
        id: TASK_LIVE_ID,
        title: "Old Task Title",
        epicId: EPIC_LIVE_ID,
        epicTitle: "Old Title",
      }),
      baseTask({
        id: TASK_COMPLETED_STALE_ID,
        title: "Completed History",
        epicId: EPIC_DELETED_ID,
        epicTitle: "Deleted Campaign",
        completed: true,
        completedAt: "2026-04-30T12:00:00.000Z",
      }),
      baseTask({
        id: TASK_INCOMPLETE_STALE_ID,
        title: "Should Disappear",
        epicId: EPIC_DELETED_ID,
        epicTitle: "Deleted Campaign",
      }),
    ],
    priorityScores: [
      {
        id: `epic:${EPIC_LIVE_ID}`,
        kind: "epic",
        title: "Old Title",
        score: 81,
        reasons: ["client stale title"],
        epicId: EPIC_LIVE_ID,
      },
      {
        id: `task:${TASK_LIVE_ID}`,
        kind: "task",
        title: "Old Task Title",
        score: 72,
        reasons: ["client stale task title"],
        taskId: TASK_LIVE_ID,
        epicId: EPIC_LIVE_ID,
      },
    ],
  });

  const result = await validateAndPrunePlannerContext(
    createMockSupabase({
      epics: [{
        id: EPIC_LIVE_ID,
        user_id: "user-1",
        title: "Fresh Campaign",
        end_date: "2026-06-01",
        progress_percentage: 42,
        status: "active",
      }],
      daily_tasks: [
        taskRow({
          id: TASK_LIVE_ID,
          task_text: "Fresh Task Title",
          epic_id: EPIC_LIVE_ID,
          epic_title: "Stale Denormalized Campaign Title",
        }),
        taskRow({
          id: TASK_COMPLETED_STALE_ID,
          task_text: "Completed History",
          completed: null,
          completed_at: "2026-04-30T12:00:00.000Z",
          epic_id: EPIC_DELETED_ID,
          epic_title: "Deleted Campaign",
        }),
        taskRow({
          id: TASK_INCOMPLETE_STALE_ID,
          task_text: "Should Disappear",
          completed: false,
          epic_id: EPIC_DELETED_ID,
          epic_title: "Deleted Campaign",
        }),
      ],
      habits: [],
    }),
    "user-1",
    context,
  );

  assertEquals(result.activeEpics, [{
    id: EPIC_LIVE_ID,
    title: "Fresh Campaign",
    endDate: "2026-06-01",
    progressPercentage: 7,
    daysRemaining: 11,
    habitCount: 3,
  }]);
  assertEquals(result.tasks.map((task) => task.id), [
    TASK_LIVE_ID,
    TASK_COMPLETED_STALE_ID,
  ]);
  assertEquals(result.tasks[0]?.title, "Fresh Task Title");
  assertEquals(result.tasks[0]?.epicTitle, "Fresh Campaign");
  assertEquals(result.tasks[1]?.completed, true);
  assertEquals(result.tasks[1]?.epicId, null);
  assertEquals(result.tasks[1]?.epicTitle, null);
  assertEquals(result.priorityScores?.map((score) => score.title), [
    "Fresh Campaign",
    "Fresh Task Title",
  ]);
});

Deno.test("validateAndPrunePlannerContext validates active epic ids from DB task rows", async () => {
  const context = baseContext({
    tasks: [baseTask({
      id: TASK_LIVE_ID,
      title: "Client Task",
      epicId: null,
      epicTitle: null,
    })],
  });

  const result = await validateAndPrunePlannerContext(
    createMockSupabase({
      epics: [{
        id: EPIC_LIVE_ID,
        user_id: "user-1",
        title: "Fresh Campaign From Task",
        end_date: "2026-06-10",
        progress_percentage: 17,
        status: "active",
      }],
      daily_tasks: [
        taskRow({
          id: TASK_LIVE_ID,
          task_text: "Server Task",
          epic_id: EPIC_LIVE_ID,
          epic_title: "Stale Task Epic Title",
        }),
      ],
      habits: [],
    }),
    "user-1",
    context,
  );

  assertEquals(result.activeEpics.map((epic) => epic.id), [EPIC_LIVE_ID]);
  assertEquals(result.tasks.map((task) => task.id), [TASK_LIVE_ID]);
  assertEquals(result.tasks[0]?.epicId, EPIC_LIVE_ID);
  assertEquals(result.tasks[0]?.epicTitle, "Fresh Campaign From Task");
});

Deno.test("validateAndPrunePlannerContext prunes stale schedule insights after task validation", async () => {
  const context = baseContext({
    tasks: [
      baseTask({
        id: TASK_LIVE_ID,
        title: "Live Quest",
        scheduledTime: "09:00",
        estimatedDuration: 30,
      }),
      baseTask({
        id: TASK_DELETED_ID,
        title: "Deleted Quest",
        scheduledTime: "09:15",
        estimatedDuration: 90,
      }),
    ],
    scheduleInsights: {
      horizon: "day",
      selectedDate: "2026-05-01",
      dayLoads: [{
        date: "2026-05-01",
        totalMinutes: 999,
        taskCount: 8,
        status: "overloaded",
      }],
      overloadedDates: ["2026-05-01"],
      emptyDates: [],
      conflicts: [{
        date: "2026-05-01",
        taskAId: TASK_DELETED_ID,
        taskATitle: "Deleted Quest",
        taskBId: TASK_LIVE_ID,
        taskBTitle: "Live Quest",
        overlapMinutes: 15,
      }],
      suggestedSlots: [{
        date: "2026-05-01",
        time: "11:00",
        endTime: "11:30",
        score: 80,
        reason: "Deleted Quest left this window open.",
      }],
      moveSuggestions: [{
        fromDate: "2026-05-01",
        toDate: "2026-05-02",
        taskId: TASK_DELETED_ID,
        taskTitle: "Deleted Quest",
        suggestedTime: null,
        reason: "Stale overload.",
      }],
      summary: "Deleted Quest is crowding the day.",
    },
    priorityScores: [
      {
        id: "task:orphan",
        kind: "task",
        title: "Deleted Quest",
        score: 92,
        reasons: ["stale orphan score"],
      },
      {
        id: `task:${TASK_LIVE_ID}`,
        kind: "task",
        title: "Deleted Quest",
        score: 61,
        reasons: ["live score"],
        taskId: TASK_LIVE_ID,
      },
    ],
  });

  const result = await validateAndPrunePlannerContext(
    createMockSupabase({
      epics: [],
      daily_tasks: [
        taskRow({
          id: TASK_LIVE_ID,
          task_text: "Live Quest",
          scheduled_time: "09:00",
          estimated_duration: 30,
        }),
      ],
      habits: [],
    }),
    "user-1",
    context,
  );

  assertEquals(result.tasks.map((task) => task.id), [TASK_LIVE_ID]);
  assertEquals(result.scheduleInsights?.conflicts, []);
  assertEquals(result.scheduleInsights?.moveSuggestions, []);
  assertEquals(result.scheduleInsights?.dayLoads, [{
    date: "2026-05-01",
    totalMinutes: 30,
    taskCount: 1,
    status: "balanced",
  }]);
  assertEquals(result.scheduleInsights?.overloadedDates, []);
  assertEquals(result.scheduleInsights?.emptyDates, []);
  assertEquals(result.scheduleInsights?.suggestedSlots[0]?.reason, "Open time in your schedule.");
  assertEquals(result.scheduleInsights?.summary, undefined);
  assertEquals(result.priorityScores?.map((score) => score.id), [`task:${TASK_LIVE_ID}`]);
  assertEquals(result.priorityScores?.[0]?.title, "Live Quest");
  assertEquals(JSON.stringify(result.scheduleInsights).includes("Deleted Quest"), false);
  assertEquals(JSON.stringify(result.priorityScores).includes("Deleted Quest"), false);
});

Deno.test("validateAndPrunePlannerContext drops incomplete tasks for deleted standalone habits", async () => {
  const context = baseContext({
    tasks: [baseTask({
      id: TASK_HABIT_DELETED_ID,
      title: "Daily Hydration",
      habitSourceId: HABIT_DELETED_ID,
    })],
  });

  const result = await validateAndPrunePlannerContext(
    createMockSupabase({
      epics: [],
      daily_tasks: [
        taskRow({
          id: TASK_HABIT_DELETED_ID,
          task_text: "Daily Hydration",
          habit_source_id: HABIT_DELETED_ID,
        }),
      ],
      habits: [],
    }),
    "user-1",
    context,
  );

  assertEquals(result.tasks, []);
  assertEquals(result.activeHabitIds, []);
});

Deno.test("validateAndPrunePlannerContext keeps an active habit task even when the client omitted habitSourceId", async () => {
  const context = baseContext({
    tasks: [baseTask({
      id: TASK_HABIT_STALE_CLIENT_ID,
      title: "Daily Stretching",
      habitSourceId: null,
    })],
  });

  const result = await validateAndPrunePlannerContext(
    createMockSupabase({
      epics: [],
      daily_tasks: [
        taskRow({
          id: TASK_HABIT_STALE_CLIENT_ID,
          task_text: "Daily Stretching",
          habit_source_id: HABIT_ACTIVE_ID,
        }),
      ],
      habits: [{
        id: HABIT_ACTIVE_ID,
        user_id: "user-1",
        is_active: true,
      }],
    }),
    "user-1",
    context,
  );

  assertEquals(result.tasks.map((task) => task.id), [TASK_HABIT_STALE_CLIENT_ID]);
  assertEquals(result.tasks[0]?.habitSourceId, HABIT_ACTIVE_ID);
  assertEquals(result.activeHabitIds, [HABIT_ACTIVE_ID]);
});

Deno.test("validateAndPrunePlannerContext preserves explicitly pending local task ids", async () => {
  const context = baseContext({
    pendingLocalTaskIds: [TASK_PENDING_LOCAL_ID],
    tasks: [baseTask({
      id: TASK_PENDING_LOCAL_ID,
      title: "Queued offline quest",
    })],
  });

  const result = await validateAndPrunePlannerContext(
    createMockSupabase({
      epics: [],
      daily_tasks: [],
      habits: [],
    }),
    "user-1",
    context,
  );

  assertEquals(result.tasks.map((task) => task.id), [TASK_PENDING_LOCAL_ID]);
});
