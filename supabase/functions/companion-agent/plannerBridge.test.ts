import { assertEquals, assertGreater, assertMatch } from "https://deno.land/std@0.224.0/assert/mod.ts";

import { consultPlannerForAgent } from "./plannerBridge.ts";
import type { LoadedCompanionAgentContext } from "./types.ts";

const buildContext = (
  overrides: Partial<LoadedCompanionAgentContext> = {},
): LoadedCompanionAgentContext => ({
  thread: null,
  messages: [],
  tasks: [],
  rituals: [],
  campaigns: [],
  calendarEvents: [],
  reminders: [],
  goals: [],
  recentMemory: {},
  reflections: [],
  activePendingAction: null,
  companionMode: "alpha",
  companionModeAdaptationEnabled: true,
  visibleDateStart: "2026-04-18",
  visibleDateEnd: "2026-04-24",
  currentDateTime: "2026-04-18T08:00:00-07:00",
  timezone: "-07:00",
  ...overrides,
});

Deno.test("consultPlannerForAgent returns a schedule read for schedule questions", () => {
  const result = consultPlannerForAgent({
    message: "What's on tomorrow?",
    currentDateTime: "2026-04-18T08:00:00-07:00",
    surface: "journeys",
    horizon: "week",
    context: buildContext({
      tasks: [
        {
          id: "task-1",
          task_text: "Workout",
          task_date: "2026-04-19",
          scheduled_time: "07:00",
          estimated_duration: 45,
          completed: false,
          reminder_enabled: true,
          reminder_minutes_before: 10,
        },
      ],
      calendarEvents: [
        {
          id: "event-1",
          title: "Team sync",
          start_time: "2026-04-19T10:00:00-07:00",
          end_time: "2026-04-19T10:30:00-07:00",
          is_all_day: false,
          source: "google",
        },
      ],
    }),
  });

  assertEquals(result.mode, "schedule_read");
  assertEquals(result.actionHints.length, 0);
  assertMatch(result.reply, /tomorrow/i);
});

Deno.test("consultPlannerForAgent converts planner proposals into v1 task action hints", () => {
  const result = consultPlannerForAgent({
    message: "Move my workout to tomorrow at 7am",
    currentDateTime: "2026-04-18T08:00:00-07:00",
    surface: "journeys",
    horizon: "week",
    context: buildContext({
      tasks: [
        {
          id: "task-1",
          task_text: "Workout",
          task_date: "2026-04-18",
          scheduled_time: "09:00",
          estimated_duration: 45,
          completed: false,
        },
      ],
    }),
  });

  assertEquals(result.mode, "proposal");
  assertGreater(result.actionHints.length, 0);
  assertEquals(result.actionHints[0]?.actionType, "task_update");
});
