import {
  assertEquals,
  assertRejects,
} from "https://deno.land/std@0.224.0/assert/mod.ts";

import { executeAction } from "./executor.ts";
import type { PendingActionRow } from "./types.ts";

const buildPendingAction = (
  overrides: Partial<PendingActionRow> = {},
): PendingActionRow => ({
  id: "action-1",
  thread_id: "thread-1",
  session_id: "session-1",
  user_id: "user-1",
  companion_id: "companion-1",
  status: "pending",
  intent: "goal_setting",
  action_type: "campaign_adjust",
  normalized_payload: {
    campaign_id: "epic-1",
    adjustment_type: "extend_deadline",
    reason: "Need more time",
  },
  summary: "Adjust campaign",
  affected_entities: null,
  confirmation_message: "Want me to adjust that campaign?",
  created_at: "2026-04-22T00:00:00.000Z",
  expires_at: "2026-04-23T00:00:00.000Z",
  confirmed_at: null,
  cancelled_at: null,
  executed_at: null,
  execution_result: null,
  execution_error: null,
  idempotency_key: "session-1:action-1",
  replaced_by_action_id: null,
  metadata: null,
  ...overrides,
});

Deno.test("executeAction runs campaign adjustments through the frozen legacy functions", async () => {
  const invokeCalls: Array<{ name: string; body: unknown }> = [];
  const supabase = {
    functions: {
      invoke: async (name: string, options: { body: unknown }) => {
        invokeCalls.push({ name, body: options.body });

        if (name === "adjust-epic-plan") {
          return {
            data: {
              suggestions: [
                {
                  id: "suggestion-1",
                  type: "timeline_change",
                  action: "modify",
                  title: "Extend deadline",
                },
              ],
            },
            error: null,
          };
        }

        if (name === "apply-epic-adjustments") {
          return {
            data: {
              appliedChanges: ["Extended deadline to 2026-07-01"],
              message: "Successfully applied 1 adjustment to your plan",
            },
            error: null,
          };
        }

        throw new Error(`Unexpected function invoke: ${name}`);
      },
    },
  };

  const result = await executeAction({
    supabase,
    userId: "user-1",
    action: buildPendingAction(),
  });

  assertEquals(invokeCalls.length, 2);
  assertEquals(invokeCalls[0], {
    name: "adjust-epic-plan",
    body: {
      epicId: "epic-1",
      adjustmentType: "extend_deadline",
      reason: "Need more time",
      customRequest: "Need more time",
    },
  });
  assertEquals(invokeCalls[1], {
    name: "apply-epic-adjustments",
    body: {
      epicId: "epic-1",
      adjustments: [
        {
          id: "suggestion-1",
          type: "timeline_change",
          action: "modify",
          title: "Extend deadline",
        },
      ],
      adjustmentType: "extend_deadline",
      reason: "Need more time",
    },
  });
  assertEquals(
    result.receiptMessage,
    "Got it — successfully applied 1 adjustment to your plan.",
  );
  assertEquals(result.executionResult?.campaign_id, "epic-1");
  assertEquals(result.executionResult?.adjustment_type, "extend_deadline");
  assertEquals(result.executionResult?.applied_changes, [
    "Extended deadline to 2026-07-01",
  ]);
});

Deno.test("executeAction rejects campaign adjustments when no suggestions are generated", async () => {
  const supabase = {
    functions: {
      invoke: async (name: string) => {
        if (name === "adjust-epic-plan") {
          return {
            data: { suggestions: [] },
            error: null,
          };
        }

        return {
          data: null,
          error: null,
        };
      },
    },
  };

  await assertRejects(
    () =>
      executeAction({
        supabase,
        userId: "user-1",
        action: buildPendingAction(),
      }),
    Error,
    "No campaign adjustments were generated.",
  );
});

Deno.test("executeAction preserves rich task creation metadata and subtasks", async () => {
  const dailyTaskInserts: Array<Record<string, unknown>> = [];
  const subtaskInserts: Array<Record<string, unknown>> = [];
  const supabase = {
    from: (table: string) => {
      if (table === "daily_tasks") {
        return {
          select: (
            _query: string,
            options?: { count?: string; head?: boolean },
          ) => {
            if (options?.count === "exact" && options?.head === true) {
              return {
                eq: (_column: string, _userId: string) => ({
                  eq: async (_dateColumn: string, _taskDate: string) => ({
                    count: 2,
                    error: null,
                  }),
                }),
              };
            }

            throw new Error("Unexpected daily_tasks select call");
          },
          insert: (payload: Record<string, unknown>) => {
            dailyTaskInserts.push(payload);
            return {
              select: () => ({
                single: async () => ({
                  data: {
                    id: "task-1",
                    task_text: payload.task_text,
                    task_date: payload.task_date,
                    scheduled_time: payload.scheduled_time,
                  },
                  error: null,
                }),
              }),
            };
          },
        };
      }

      if (table === "subtasks") {
        return {
          insert: async (payload: Array<Record<string, unknown>>) => {
            subtaskInserts.push(...payload);
            return { error: null };
          },
        };
      }

      throw new Error(`Unexpected table access: ${table}`);
    },
  };

  const result = await executeAction({
    supabase,
    userId: "user-1",
    action: buildPendingAction({
      action_type: "task_create",
      intent: "schedule_task",
      normalized_payload: {
        title: "Focus Sprint",
        task_date: "2026-04-23",
        scheduled_time: "09:00",
        difficulty: "hard",
        estimated_duration: 90,
        recurrence_pattern: "custom",
        recurrence_days: [0, 2, 4],
        recurrence_custom_period: "week",
        recurrence_end_date: "2026-05-23",
        notes: "Protect the block",
        location: "Studio",
        category: "mind",
        epic_id: "epic-1",
        priority: "high",
        contact_id: "contact-1",
        auto_log_interaction: false,
        image_url: "https://cdn.example.com/focus.png",
        source: "manual",
        subtasks: ["Warm up", "Ship draft"],
        reminder_enabled: true,
        reminder_minutes_before: 20,
      },
    }),
  });

  assertEquals(dailyTaskInserts.length, 1);
  assertEquals(dailyTaskInserts[0], {
    user_id: "user-1",
    task_text: "Focus Sprint",
    difficulty: "hard",
    xp_reward: 22,
    task_date: "2026-04-23",
    scheduled_time: "09:00",
    estimated_duration: 90,
    recurrence_pattern: "custom",
    recurrence_days: [0, 2, 4],
    recurrence_month_days: null,
    recurrence_custom_period: "week",
    recurrence_end_date: "2026-05-23",
    is_recurring: true,
    notes: "Protect the block",
    location: "Studio",
    category: "mind",
    epic_id: "epic-1",
    priority: "high",
    contact_id: "contact-1",
    auto_log_interaction: false,
    image_url: "https://cdn.example.com/focus.png",
    reminder_enabled: true,
    reminder_minutes_before: 20,
    source: "manual",
  });
  assertEquals(subtaskInserts, [
    {
      user_id: "user-1",
      task_id: "task-1",
      title: "Warm up",
      completed: false,
      completed_at: null,
      sort_order: 0,
    },
    {
      user_id: "user-1",
      task_id: "task-1",
      title: "Ship draft",
      completed: false,
      completed_at: null,
      sort_order: 1,
    },
  ]);
  assertEquals(result.executionResult?.task_id, "task-1");
  assertEquals(result.executionResult?.subtasks_created, 2);
  assertEquals(result.executionResult?.subtask_persist_warning, false);
});

Deno.test("executeAction links ritual creation to a campaign when epic_id is present", async () => {
  const epicHabitInserts: Array<Record<string, unknown>> = [];
  const supabase = {
    from: (table: string) => {
      if (table === "habits") {
        return {
          insert: (_payload: Record<string, unknown>) => ({
            select: () => ({
              single: async () => ({
                data: { id: "habit-1", title: "Morning Pages" },
                error: null,
              }),
            }),
          }),
        };
      }

      if (table === "epic_habits") {
        return {
          insert: async (payload: Record<string, unknown>) => {
            epicHabitInserts.push(payload);
            return { error: null };
          },
        };
      }

      throw new Error(`Unexpected table access: ${table}`);
    },
  };

  const result = await executeAction({
    supabase,
    userId: "user-1",
    action: buildPendingAction({
      action_type: "ritual_create",
      intent: "goal_setting",
      normalized_payload: {
        title: "Morning Pages",
        frequency: "daily",
        epic_id: "epic-1",
      },
    }),
  });

  assertEquals(epicHabitInserts, [{
    epic_id: "epic-1",
    habit_id: "habit-1",
  }]);
  assertEquals(result.executionResult?.epic_id, "epic-1");
});

Deno.test("executeAction preserves ritual creation schedule metadata", async () => {
  const habitInserts: Array<Record<string, unknown>> = [];
  const supabase = {
    from: (table: string) => {
      if (table === "habits") {
        return {
          insert: (payload: Record<string, unknown>) => {
            habitInserts.push(payload);
            return {
              select: () => ({
                single: async () => ({
                  data: { id: "habit-1", title: "Morning Pages" },
                  error: null,
                }),
              }),
            };
          },
        };
      }

      if (table === "epic_habits") {
        return {
          insert: async (_payload: Record<string, unknown>) => ({
            error: null,
          }),
        };
      }

      throw new Error(`Unexpected table access: ${table}`);
    },
  };

  const result = await executeAction({
    supabase,
    userId: "user-1",
    action: buildPendingAction({
      action_type: "ritual_create",
      intent: "goal_setting",
      normalized_payload: {
        title: "Morning Pages",
        frequency: "custom",
        difficulty: "hard",
        preferred_time: "07:00",
        estimated_minutes: 20,
        description: "Three pages",
        category: "mind",
        custom_days: [0, 2, 4],
        reminder_enabled: true,
        epic_id: "epic-1",
      },
    }),
  });

  assertEquals(habitInserts, [{
    user_id: "user-1",
    title: "Morning Pages",
    difficulty: "hard",
    frequency: "custom",
    preferred_time: "07:00",
    estimated_minutes: 20,
    description: "Three pages",
    category: "mind",
    custom_days: [0, 2, 4],
    custom_month_days: null,
    reminder_enabled: true,
    reminder_minutes_before: 15,
    is_active: true,
  }]);
  assertEquals(result.executionResult?.normalized_schedule, {
    frequency: "custom",
    custom_days: [0, 2, 4],
    custom_month_days: null,
    customPeriod: "week",
  });
});

Deno.test("executeAction updates rituals and reconciles future linked quests", async () => {
  const habitUpdates: Array<Record<string, unknown>> = [];
  const taskUpdates: Array<Record<string, unknown>> = [];
  const taskInserts: Array<Record<string, unknown>> = [];
  const taskDeletes: string[] = [];
  const futureTasks = [
    {
      id: "task-mon",
      user_id: "user-1",
      task_text: "Old Practice",
      difficulty: "easy",
      xp_reward: 10,
      task_date: "2026-04-27",
      completed: false,
      completed_at: null,
      is_main_quest: false,
      scheduled_time: "09:00",
      estimated_duration: 15,
      recurrence_pattern: null,
      recurrence_days: null,
      recurrence_month_days: null,
      recurrence_custom_period: null,
      recurrence_end_date: null,
      is_recurring: false,
      reminder_enabled: false,
      reminder_minutes_before: 15,
      category: "mind",
      is_bonus: false,
      created_at: "2026-04-20T00:00:00.000Z",
      priority: null,
      is_top_three: null,
      actual_time_spent: null,
      ai_generated: null,
      context_id: null,
      source: "recurring",
      habit_source_id: "habit-1",
      epic_id: "epic-1",
      epic_title: "Campaign Aurora",
      sort_order: 1,
      contact_id: null,
      auto_log_interaction: true,
      image_url: null,
      notes: null,
      location: null,
      parent_template_id: null,
    },
    {
      id: "task-thu",
      user_id: "user-1",
      task_text: "Old Practice",
      difficulty: "easy",
      xp_reward: 10,
      task_date: "2026-04-23",
      completed: false,
      completed_at: null,
      is_main_quest: false,
      scheduled_time: "09:00",
      estimated_duration: 15,
      recurrence_pattern: null,
      recurrence_days: null,
      recurrence_month_days: null,
      recurrence_custom_period: null,
      recurrence_end_date: null,
      is_recurring: false,
      reminder_enabled: false,
      reminder_minutes_before: 15,
      category: "mind",
      is_bonus: false,
      created_at: "2026-04-20T00:00:00.000Z",
      priority: null,
      is_top_three: null,
      actual_time_spent: null,
      ai_generated: null,
      context_id: null,
      source: "recurring",
      habit_source_id: "habit-1",
      epic_id: "epic-1",
      epic_title: "Campaign Aurora",
      sort_order: 2,
      contact_id: null,
      auto_log_interaction: true,
      image_url: null,
      notes: null,
      location: null,
      parent_template_id: null,
    },
  ];

  const supabase = {
    from: (table: string) => {
      if (table === "habits") {
        return {
          update: (payload: Record<string, unknown>) => ({
            eq: (_column: string, _value: string) => ({
              eq: async (_userColumn: string, _userValue: string) => {
                habitUpdates.push(payload);
                return { error: null };
              },
            }),
          }),
        };
      }

      if (table === "daily_tasks") {
        return {
          select: (_query: string) => ({
            eq: (_column: string, _value: string) => ({
              gte: (_dateColumn: string, _today: string) => ({
                lte: async (_endColumn: string, _endDate: string) => ({
                  data: futureTasks,
                  error: null,
                }),
              }),
            }),
          }),
          update: (payload: Record<string, unknown>) => ({
            eq: (_column: string, taskId: string) => ({
              eq: async (_userColumn: string, _userValue: string) => {
                taskUpdates.push({ taskId, updates: payload });
                return { error: null };
              },
            }),
          }),
          insert: async (payload: Record<string, unknown>) => {
            taskInserts.push(payload);
            return { error: null };
          },
          delete: () => ({
            eq: (_column: string, taskId: string) => ({
              eq: async (_userColumn: string, _userValue: string) => {
                taskDeletes.push(taskId);
                return { error: null };
              },
            }),
          }),
        };
      }

      if (table === "epic_habits") {
        return {
          select: (_query: string) => ({
            eq: async (_column: string, _habitId: string) => ({
              data: [{ epic_id: "epic-1" }],
              error: null,
            }),
          }),
        };
      }

      if (table === "epics") {
        return {
          select: (_query: string) => ({
            in: (_column: string, _ids: string[]) => ({
              eq: (_userColumn: string, _userId: string) => ({
                eq: (_statusColumn: string, _status: string) => ({
                  limit: async (_limit: number) => ({
                    data: [{ id: "epic-1", title: "Campaign Aurora" }],
                    error: null,
                  }),
                }),
              }),
            }),
          }),
        };
      }

      throw new Error(`Unexpected table access: ${table}`);
    },
  };

  const result = await executeAction({
    supabase,
    userId: "user-1",
    action: buildPendingAction({
      action_type: "ritual_update",
      intent: "update_existing_plan",
      normalized_payload: {
        habit_id: "habit-1",
        title: "Practice Guitar",
        difficulty: "hard",
        frequency: "weekly",
        custom_days: [0],
        estimated_minutes: 25,
        preferred_time: "07:00",
        reminder_enabled: true,
        reminder_minutes_before: 10,
      },
      metadata: {
        currentDateTime: "2026-04-22T10:00:00-07:00",
      },
    }),
  });

  assertEquals(habitUpdates.length, 1);
  assertEquals(taskUpdates.length, 1);
  assertEquals(taskUpdates[0], {
    taskId: "task-mon",
    updates: {
      task_text: "Practice Guitar",
      difficulty: "hard",
      xp_reward: 20,
      scheduled_time: "07:00",
      estimated_duration: 25,
      reminder_enabled: true,
      reminder_minutes_before: 10,
    },
  });
  assertEquals(taskDeletes, ["task-thu"]);
  assertEquals(taskInserts.length, 3);
  assertEquals(taskInserts[0]?.habit_source_id, "habit-1");
  assertEquals(taskInserts[0]?.epic_id, "epic-1");
  assertEquals(taskInserts[0]?.category, "mind");
  assertEquals(result.executionResult?.created_count, 3);
  assertEquals(result.executionResult?.updated_count, 1);
  assertEquals(result.executionResult?.deleted_count, 1);
});
